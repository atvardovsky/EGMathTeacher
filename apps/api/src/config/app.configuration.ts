import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  transcriptLogDir: process.env.TRANSCRIPT_LOG_DIR ?? './logs',
  sqlitePath: process.env.SQLITE_PATH ?? './data/app.sqlite',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-change-me-egmathteacher',
  authCookieName: process.env.AUTH_COOKIE_NAME ?? 'egmathteacher_session',
  authCookieSecure: ['true', '1', 'yes', 'y', 'on'].includes(
    (process.env.AUTH_COOKIE_SECURE ?? 'false').toLowerCase(),
  ),
  authSessionDays: parseInt(process.env.AUTH_SESSION_DAYS ?? '7', 10),
}));
