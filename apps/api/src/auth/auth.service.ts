import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID, createHmac, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { AuthSession, PublicUser, UserRecord, UserRole } from './auth.types';

interface Credentials {
  name?: string;
  password?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly cookieName: string;
  private readonly jwtSecret: string;
  private readonly sessionDays: number;
  private readonly cookieSecure: boolean;

  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    this.cookieName = this.configService.get<string>('app.authCookieName') ?? 'egmathteacher_session';
    this.jwtSecret = this.configService.get<string>('app.jwtSecret') ?? 'dev-change-me-egmathteacher';
    this.sessionDays = this.configService.get<number>('app.authSessionDays') ?? 7;
    this.cookieSecure = this.configService.get<boolean>('app.authCookieSecure') ?? false;

    if (this.jwtSecret === 'dev-change-me-egmathteacher') {
      this.logger.warn('JWT_SECRET is using the development default. Set JWT_SECRET before sharing the app.');
    }
  }

  async register(credentials: Credentials): Promise<{ user: PublicUser; token: string }> {
    const name = this.normalizeName(credentials.name);
    const password = this.normalizePassword(credentials.password);

    const existing = this.findUserByName(name);
    if (existing) {
      throw new ConflictException('User name already exists');
    }

    const role: UserRole = this.countUsers() === 0 ? 'admin' : 'student';
    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(password, 12);
    const id = randomUUID();

    this.db.run(
      'INSERT INTO users (id, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, name, passwordHash, role, now],
    );

    const user = this.toPublicUser({
      id,
      name,
      password_hash: passwordHash,
      role,
      created_at: now,
    });

    return { user, token: this.signSession(user) };
  }

  async login(credentials: Credentials): Promise<{ user: PublicUser; token: string }> {
    const name = this.normalizeName(credentials.name);
    const password = this.normalizePassword(credentials.password);
    const user = this.findUserByName(name);
    if (!user) {
      throw new UnauthorizedException('Invalid name or password');
    }

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      throw new UnauthorizedException('Invalid name or password');
    }

    const publicUser = this.toPublicUser(user);
    return { user: publicUser, token: this.signSession(publicUser) };
  }

  getSessionFromRequest(request: Request): AuthSession | undefined {
    const token = this.getCookie(request.headers.cookie, this.cookieName);
    if (!token) {
      return undefined;
    }
    return this.verifySession(token);
  }

  attachSessionCookie(response: Response, token: string): void {
    response.cookie(this.cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieSecure,
      maxAge: this.getMaxAgeMs(),
      path: '/',
    });
  }

  clearSessionCookie(response: Response): void {
    response.clearCookie(this.cookieName, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieSecure,
      path: '/',
    });
  }

  private normalizeName(raw: string | undefined): string {
    const name = raw?.trim();
    if (!name || name.length < 2 || name.length > 64) {
      throw new BadRequestException('Name must be between 2 and 64 characters');
    }
    return name;
  }

  private normalizePassword(raw: string | undefined): string {
    const password = raw ?? '';
    if (password.length < 4 || password.length > 256) {
      throw new BadRequestException('Password must be between 4 and 256 characters');
    }
    return password;
  }

  private countUsers(): number {
    const row = this.db.get<{ count: number }>('SELECT COUNT(*) AS count FROM users');
    return row?.count ?? 0;
  }

  private findUserByName(name: string): UserRecord | undefined {
    return this.db.get<UserRecord>(
      'SELECT id, name, password_hash, role, created_at FROM users WHERE name = ?',
      [name],
    );
  }

  private signSession(user: PublicUser): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: AuthSession = {
      ...user,
      iat: now,
      exp: now + this.sessionDays * 24 * 60 * 60,
    };
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = this.base64UrlJson(header);
    const encodedPayload = this.base64UrlJson(payload);
    const signature = this.sign(`${encodedHeader}.${encodedPayload}`);
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private verifySession(token: string): AuthSession | undefined {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !signature) {
      return undefined;
    }
    const expectedSignature = this.sign(`${encodedHeader}.${encodedPayload}`);
    if (!this.constantTimeEqual(signature, expectedSignature)) {
      return undefined;
    }
    try {
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as AuthSession;
      if (!payload?.id || !payload.name || !payload.role || !payload.exp) {
        return undefined;
      }
      if (payload.exp <= Math.floor(Date.now() / 1000)) {
        return undefined;
      }
      return payload;
    } catch {
      return undefined;
    }
  }

  private toPublicUser(user: UserRecord): PublicUser {
    return {
      id: user.id,
      name: user.name,
      role: user.role,
      createdAt: user.created_at,
    };
  }

  private getCookie(header: string | undefined, name: string): string | undefined {
    if (!header) {
      return undefined;
    }
    const pairs = header.split(';');
    for (const pair of pairs) {
      const [rawKey, ...rawValue] = pair.trim().split('=');
      if (rawKey === name) {
        return decodeURIComponent(rawValue.join('='));
      }
    }
    return undefined;
  }

  private base64UrlJson(value: unknown): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  private sign(value: string): string {
    return createHmac('sha256', this.jwtSecret).update(value).digest('base64url');
  }

  private constantTimeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.byteLength !== rightBuffer.byteLength) {
      return false;
    }
    return timingSafeEqual(leftBuffer, rightBuffer);
  }

  private getMaxAgeMs(): number {
    return this.sessionDays * 24 * 60 * 60 * 1000;
  }
}
