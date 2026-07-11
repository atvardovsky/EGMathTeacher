# Approval Record

Approval ID: `ALATYR-20260712-background-batching`
Operation ID: `background-windowed-ai-processing`
Operation type: `product-change`
Plan version: `1`
Plan hash: `not-available-user-approved-chat-plan`
Requested by: `atvardovsky`
Approved by: `atvardovsky`
Approved at: `2026-07-12T00:42:55+02:00`
Approval source/message: `User requested: "implement this strtegy and make it optional"`
Expires at or reuse policy: `single implementation pass for optional background batching`
Scope invalidation rule: `New external services, dependencies, live OpenAI validation, destructive data operations, auth changes, system service changes, or broader AI governance changes require separate approval.`

## Approved Scope

Allowed protected changes:

- Add optional windowed background observation storage for tutor-turn signals.
- Add SQLite schema tables/indexes needed for background observation windows.
- Add background job types for grouped learning analysis and combined profile/strategy refresh.
- Add configuration flags for enabling/disabling batching, window size, idle flush, model routing, service tier, and prompt cache keys.
- Update project docs, diagrams, tests, and env examples to match the accepted optional behavior.

Allowed files or surfaces:

- `apps/api/src/background-ai`
- `apps/api/src/database/database.service.ts`
- `apps/api/src/config/ai.configuration.ts`
- `apps/api/.env.example`
- `apps/api/test`
- `README.md`
- `apps/api/README.md`
- `.ai/project`
- `.ai/assistant/approvals`

Excluded actions:

- No live OpenAI calls.
- No production dependency or external service additions.
- No destructive SQLite reset, data deletion, backfill against live data, or production migration execution.
- No auth, authorization, cookie, system web server, PM2, certificate, or deployment changes.
- No assistant gate weakening.

Allowed actions mode:
`code-and-tests`

## Plan Evidence

Approved plan summary:

```text
Implement optional background batching by storing sanitized tutor-turn observations locally, grouping them by count, idle time, or quality trigger, then sending one learning-window model call and one combined profile/strategy refresh where logical. Keep the previous per-turn background behavior available through configuration.
```

Approved validation or manual review:

- `npm run build`
- `npm test`
- `npm run lint`
- `npm run diagrams:render` when diagram sources change
- `npm run diagrams:check` when diagram sources change
- `npm run alatyr:check` after `.ai` changes

## Use Result

Used by operation/change: `optional background learning-window batching`
Patch changed after approval: `yes; implementation stayed within the approved optional batching scope`
Implementation stayed within approved scope: `yes; no live services, dependencies, destructive operations, auth changes, deployment changes, or gate weakening`
Validation run: `npm run lint`; `npm test`; `npm run build`; `npm run diagrams:render`; `npm run diagrams:check`; `npm run alatyr:check`; `npm run e2e`; `git diff --check`
Result/evidence: `all listed checks passed locally on 2026-07-12`
Residual risk: `no live OpenAI validation was run; production rollback/backfill/backup policy remains a documented POC gap`
