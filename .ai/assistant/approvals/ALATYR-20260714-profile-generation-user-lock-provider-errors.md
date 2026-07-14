# Approval Record

Approval ID: `ALATYR-20260714-profile-generation-user-lock-provider-errors`
Operation ID: `profile-generation-user-lock-provider-errors-20260714`
Operation type: `data-change,architecture-change,external-boundary,code-and-tests`
Plan version: `profile-generation-user-lock-provider-errors-v1`
Plan hash: `not available; direct implementation request in chat`
Requested by: `project owner`
Approved by: `project owner`
Approved at: `2026-07-14T20:00:28+02:00`
Approval source/message: `User request: "now fix the detected issues by review with an keeping in minde how it suppose to be done"`
Expires at or reuse policy: `single review-fix operation only`
Scope invalidation rule: `Any product behavior beyond profile-generation locking, provider failure typing, failed-attempt usage observability, and approval evidence repair requires a new approval. Live provider calls, destructive data cleanup, dependency changes, system configuration, and production deployment are excluded.`

## Approved Scope

Allowed protected changes:

- Enforce one active conversation-profile generation pipeline per signed-in
  user, matching the one-profile-per-user data model.
- Add a SQLite migration that reconciles older multiple running profile
  creation rows and creates a partial unique user-level running lock.
- Require final profile writes to keep validating the active generation claim.
- Distinguish provider caller abort, timeout, and provider/network failure in
  the OpenAI client.
- Record failed/aborted provider attempts in the local usage ledger with
  zero tokens and `usage_unavailable:*` pricing source so debug usage does
  not silently hide attempted provider work.
- Update tests, docs, diagrams, and Alatyr evidence for the repaired
  invariants and provider boundary scope.

Allowed files or surfaces:

- `apps/api/src/database/database.service.ts`
- `apps/api/src/student-profile/student-profile.service.ts`
- `apps/api/src/ai-model/*`
- `apps/api/src/openai/*`
- `apps/api/src/usage/*`
- `apps/api/test/*`
- `README.md`
- `apps/api/README.md`
- `.ai/project/*`
- `.ai/project/diagrams/*`
- `.ai/project/diagrams/rendered/*`
- `.ai/assistant/approvals/ALATYR-20260714-profile-generation-user-lock-provider-errors.md`

Excluded actions:

- No live OpenAI or other live service calls.
- No dependency changes.
- No system web server, PM2, certificate, or production deployment changes.
- No local user-data deletion or reset.
- No weakening of validation, approval, or documentation-sync gates.

Allowed actions mode:
`code-and-tests`

## Plan Evidence

Approved plan summary:

```text
Repair review findings by moving conversation-profile creation from a
conversation-level running lock to a user-level running lock, adding typed
provider abort/timeout/failure handling, recording failed provider attempts
as usage-unavailable ledger rows, and syncing tests plus owning docs/diagrams.
```

Approved validation or manual review:

- `npm test`
- `npm run lint`
- `npm run build`
- `npm run diagrams:render` when diagram sources change
- `npm run diagrams:check`
- `npm run alatyr:check`
- `git diff --check`

## Use Result

Used by operation/change: `profile-generation-user-lock-provider-errors-20260714`
Patch changed after approval: `yes; stayed inside the approved protected scope`
Implementation stayed within approved scope: `yes`
Validation run:

- `npm run test --workspace @egmathteacher/api -- --runInBand student-profile.service.spec.ts ai-model.service.spec.ts openai-client.service.spec.ts usage.service.spec.ts`
  passed: 4 suites, 36 tests.
- `npm test` passed: 17 suites, 120 tests.
- `npm run lint` passed.
- `npm run build` passed; Vite reported the existing large chunk warning.
- `npm run diagrams:render` passed and refreshed rendered artifacts/source
  hash manifest.
- `npm run diagrams:check` passed for 10 diagrams.
- `npm run alatyr:check` passed.
- `git diff --check` passed.

Result/evidence:

- `student_profile_creation_runs` now has migration
  `015_profile_creation_user_lock`, which reconciles older duplicate running
  rows and adds a partial unique `(user_id) WHERE status='running'` index.
- Conversation-profile generation claim logic now rejects any fresh running
  profile pipeline for the same user, even from another meeting conversation
  or changed transcript hash, and supersedes only stale claims.
- OpenAI requests now distinguish caller abort, request timeout, and
  provider/network failure through separate Nest exceptions.
- `AiModelService` records failed, timed-out, and caller-aborted operation
  attempts with usage context through `UsageService.recordOperationFailure`.
- `ai_usage_ledger` records these failed attempts as zero-token
  `usage_unavailable:<reason>` debug rows, and usage summaries do not count
  those rows as pricing-configured estimates.
- Tests cover user-level profile locking, stale cross-conversation
  supersession, migration 015, provider failure classification, OpenAI
  abort/timeout/provider-failure behavior, and usage-unavailable ledger rows.
- Project docs and onboarding profile sequence diagram were synced with the
  user-level lock and provider-failure observability contract.

Residual risk:

- Abort remains best-effort after a request has reached the provider; local
  rows show attempted work with unavailable usage, but cannot prove provider
  billing did or did not occur.
- No live OpenAI validation was run by design; provider behavior was covered
  with mocked fetch and service tests.
- Browser E2E and dev smoke were not run because this change did not alter web
  UI source or the running dev stack.
