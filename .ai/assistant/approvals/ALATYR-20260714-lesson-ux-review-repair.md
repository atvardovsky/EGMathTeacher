# Approval Record

Approval ID: `ALATYR-20260714-lesson-ux-review-repair`
Operation ID: `lesson-ux-review-repair-20260714`
Operation type: `review-fix-implementation`
Plan version: `2026-07-14-lesson-ux-review-repair-v1`
Plan hash: `not available; approval followed the user's review issue list`
Requested by: `programmer`
Approved by: `programmer`
Approved at: `2026-07-14T14:07:01+02:00`
Approval source/message: `User provided seven post-review issues and requested implementation in the active chat.`
Expires at or reuse policy: `single operation only`
Scope invalidation rule: `new external services, live OpenAI spend validation, destructive production data changes, system web server changes, or unrelated product behavior requires fresh approval`

## Approved Scope

Allowed protected changes:

- Repair false lesson-closure review enqueueing by using only confirmed lesson state transitions.
- Prevent repeated explicit finish calls from creating duplicate closure review jobs.
- Prevent voice auto-listening after terminal lesson responses.
- Gate first-meeting profile creation with backend readiness scoring instead of frontend turn count.
- Restore unfinished first-meeting state after page reload.
- Attribute onboarding specialist usage to the meeting conversation and lesson session.
- Lower the default lesson decision timeout for demo responsiveness.
- Update tests, human docs, Alatyr project docs, diagrams, and rendered diagram artifacts for the repaired behavior.

Allowed files or surfaces:

- `apps/api/src/lesson`
- `apps/api/src/tutor`
- `apps/api/src/student-profile`
- `apps/api/src/config`
- `apps/api/test`
- `apps/web/src`
- `apps/web/e2e`
- `README.md`
- `apps/api/README.md`
- `.ai/project`
- `.ai/assistant/approvals`
- `apps/api/.env.example`

Excluded actions:

- No live OpenAI calls or RAG uploads.
- No production deployment, PM2, certificate, Apache, or system web server changes.
- No destructive production database cleanup or migration.
- No new npm dependency or external service.

Allowed actions mode:
`code-and-tests`

## Plan Evidence

Approved plan summary:

```text
Implement the seven review repairs: transition-confirmed lesson closure jobs,
idempotent finish closure review, terminal-safe voice dialog continuation,
backend first-meeting readiness, onboarding usage attribution, active meeting
reload restore, and a shorter lesson decision fallback timeout. Synchronize
project docs, diagrams, validation notes, and approval evidence.
```

Approved validation or manual review:

- User review findings in the active chat.
- Manual logical integrity review against `.ai/project/blueprint.md`,
  `.ai/project/runtime-flows.md`, `.ai/project/architecture.md`,
  `.ai/project/data-model.md`, `.ai/project/ui-tree.md`, and diagrams.

## Use Result

Used by operation/change: `lesson-ux-review-repair-20260714`
Patch changed after approval: `yes; implementation details and E2E timing waits were adjusted during local validation without expanding scope`
Implementation stayed within approved scope: `yes`
Validation run: `2026-07-14T14:07:01+02:00: npm run build; npm test -- --runInBand; npm run lint; npm run e2e; npm run diagrams:render; npm run diagrams:check; npm run alatyr:check; npm run smoke:dev; git diff --check`
Result/evidence: `build passed with existing Vite chunk-size warning; unit tests passed 15 suites / 98 tests; API lint passed; Playwright E2E passed 6 tests; rendered 10 diagrams; diagram drift check passed; Alatyr consistency check passed; dev smoke passed for https://localhost:5137; whitespace check passed`
Residual risk: `No live OpenAI or remote CI validation was run; browser voice behavior remains limited by host browser speech APIs and is covered here through mocked E2E flows`
