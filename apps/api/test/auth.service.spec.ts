import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { tmpdir } from 'os';
import { AuthService } from '../src/auth/auth.service';
import { DatabaseService } from '../src/database/database.service';

function createConfig(sqlitePath: string): ConfigService {
  const values: Record<string, unknown> = {
    'app.sqlitePath': sqlitePath,
    'app.jwtSecret': 'test-secret',
    'app.authCookieName': 'test_session',
    'app.authCookieSecure': false,
    'app.authSessionDays': 7,
  };
  return {
    get: <T>(key: string) => values[key] as T,
  } as ConfigService;
}

describe('AuthService', () => {
  let db: DatabaseService;
  let service: AuthService;

  beforeEach(() => {
    const sqlitePath = join(tmpdir(), `egmathteacher-${randomUUID()}.sqlite`);
    const config = createConfig(sqlitePath);
    db = new DatabaseService(config);
    service = new AuthService(db, config);
  });

  afterEach(() => {
    db.onModuleDestroy();
  });

  it('registers the first user as admin and later users as students', async () => {
    const first = await service.register({ name: 'Анна', password: '1234' });
    const second = await service.register({ name: 'Иван', password: '5678' });

    expect(first.user.role).toBe('admin');
    expect(second.user.role).toBe('student');
  });

  it('logs in and verifies the signed session cookie token', async () => {
    await service.register({ name: 'Мария', password: 'secret' });
    const login = await service.login({ name: 'Мария', password: 'secret' });

    const session = service.getSessionFromRequest({
      headers: {
        cookie: `test_session=${encodeURIComponent(login.token)}`,
      },
    } as any);

    expect(session?.name).toBe('Мария');
    expect(session?.role).toBe('admin');
  });
});
