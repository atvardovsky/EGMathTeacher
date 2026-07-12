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
  lessonDailySoftLimitMinutes: parseInt(process.env.LESSON_DAILY_SOFT_LIMIT_MINUTES ?? '90', 10),
  lessonDailyHardLimitMinutes: parseInt(process.env.LESSON_DAILY_HARD_LIMIT_MINUTES ?? '120', 10),
  lessonContinuousSoftLimitMinutes: parseInt(
    process.env.LESSON_CONTINUOUS_SOFT_LIMIT_MINUTES ?? '45',
    10,
  ),
  lessonContinuousHardLimitMinutes: parseInt(
    process.env.LESSON_CONTINUOUS_HARD_LIMIT_MINUTES ?? '60',
    10,
  ),
  lessonMinTurnSeconds: parseInt(process.env.LESSON_MIN_TURN_SECONDS ?? '30', 10),
  lessonMaxTurnGapSeconds: parseInt(process.env.LESSON_MAX_TURN_GAP_SECONDS ?? '900', 10),
}));
