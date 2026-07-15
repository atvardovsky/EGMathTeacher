# EGMathTeacher API Guards

This file records current API guard and authorization facts.

## Guard Sources

- `apps/api/src/auth/auth.guard.ts`
- `apps/api/src/auth/auth.service.ts`
- controller decorators under `apps/api/src`

## Guards

### `AuthGuard`

Current behavior:

- reads signed session cookie through `AuthService`
- rejects missing or invalid sessions with `UnauthorizedException`
- attaches session to `request.user`

Used by:

- `TutorController`
- `StudentProfileController`
- `UsageController`
- `BackgroundAiController`

Protected endpoints:

- `GET /student-profile/me`
- `PUT /student-profile/me`
- `POST /student-profile/me/from-conversation`
- `POST /tutor/message`
- `POST /tutor/image`
- `GET /tutor/lessons`
- `POST /tutor/lessons/:lessonSessionId/finish`
- `GET /usage/me/summary`
- `POST /usage/me/background/recover`

Additional endpoint-specific rules:

- `PUT /student-profile/me` is a legacy structured onboarding fallback.
  Student use is rejected unless
  `ONBOARDING_STRUCTURED_ENDPOINT_ENABLED=true`; the default first-login path
  is `POST /student-profile/me/from-conversation`.

### `AdminGuard`

Current behavior:

- reads signed session cookie through `AuthService`
- rejects missing or invalid sessions
- rejects non-admin sessions
- attaches session to `request.user`

Used by:

- `KnowledgeController`

Protected endpoints:

- `POST /admin/knowledge/files`
- `GET /admin/knowledge/status`

## Unguarded Endpoints In Current Source

These endpoints do not use `AuthGuard` or `AdminGuard` in the current
controller source:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /health`
- `/webrtc/*`

`/webrtc/*` remains unguarded for compatibility with the inherited voice
assistant shape. When a valid signed session cookie is present, the controller
may attach server-only teaching context, session-level usage attribution, and a
post-close background review to the signed-in user. Missing or invalid cookies
must leave the session anonymous instead of exposing another user's context.

This file records current behavior; it does not approve the security model for
production use.

## Approval Rule

Changing guard coverage, auth behavior, roles, cookie semantics, or endpoint
authorization is a protected security/behavior change and requires explicit
programmer approval.

## Gaps

- No rate limiting.
- No CSRF-specific token beyond SameSite cookie behavior.
- No separate authorization policy document for production student data.
- WebRTC endpoints are unguarded in the current controller.
