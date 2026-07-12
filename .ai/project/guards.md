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

Protected endpoints:

- `GET /student-profile/me`
- `PUT /student-profile/me`
- `POST /tutor/message`
- `POST /tutor/image`
- `GET /usage/me/summary`

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
