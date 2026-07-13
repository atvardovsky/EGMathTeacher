# Approval Record

Approval ID: `ALATYR-20260713-runtime-review-issue-repair`
Operation ID: `runtime-review-issue-repair-20260713`
Operation type: `business-change + architecture-change + data-change`
Plan version: `1`
Plan hash: `not available; plan was provided in chat and implemented in the same task turn`
Requested by: `project owner`
Approved by: `project owner`
Approved at: `2026-07-13T10:20:00+02:00`
Approval source/message: `user message: "implement" after the runtime issue report`
Expires at or reuse policy: `single operation only`
Scope invalidation rule: `new product behavior, live OpenAI side effects, deployment/server changes, or unrelated schema changes require a new approval`

## Approved Scope

Allowed protected changes:

- repair deterministic learning-loop review issues around canonical task identity, cumulative mastery evidence, required mastery criteria, misconception-aware hint routing, stricter curriculum routing, and RAG pending-index recovery
- update SQLite migrations, runtime services, DTO/debug surfaces, unit tests, project documentation, Alatyr documents, and diagrams needed to keep the project logically consistent

Allowed files or surfaces:

- `apps/api/src/config`
- `apps/api/src/database`
- `apps/api/src/lesson`
- `apps/api/src/knowledge`
- `apps/api/src/tutor`
- `apps/api/test`
- `apps/web/src/types.ts`
- `README.md`
- `apps/api/README.md`
- `.ai/project`
- `.ai/assistant/approvals`

Excluded actions:

- no live OpenAI upload, attach, delete, or billing-affecting operation
- no production dependency addition
- no system web server configuration changes
- no commit or push unless separately requested

Allowed actions mode:
`code-and-tests`

## Plan Evidence

Approved plan summary:

```text
Use source_task_id as canonical task identity for lesson tasks and mastery
deduplication. Count required independent mastery evidence cumulatively across
lesson sessions while requiring current deterministic evidence for the active
attempt. Require imported mastery criteria by default for supported verifier
skills. Route hints through imported common_errors/misconceptions before the
generic ladder. Tighten curriculum routing so ambiguous or low-confidence
matches remain unknown. Keep RAG replacements in indexing state on wait-ready
timeout and recover/promote them before removing stale active attachments.
Synchronize tests, docs, and diagrams.
```

Approved validation or manual review:

- targeted unit tests for math verifier, curriculum resolver, and knowledge-pack RAG sync
- full repository validation after implementation

## Use Result

Used by operation/change: `runtime review issue repair implementation and follow-up review-fix hardening`
Patch changed after approval: `yes; follow-up fixes stayed inside the approved review-fix scope`
Implementation stayed within approved scope: `yes`
Validation run: `focused Jest suites for math-verifier, knowledge-pack, curriculum, student-profile, and usage; git diff --check; npm run build; npm test; npm run lint; npm run e2e; npm run diagrams:check; npm run alatyr:check`
Result/evidence: `focused suites passed; whitespace check passed; build passed with existing Vite chunk-size warning; full API tests passed 15 suites / 72 tests with the existing Jest worker teardown warning; lint passed; Playwright E2E passed 3 tests; diagram drift check passed for 10 diagrams; Alatyr consistency check passed`
Residual risk: `live OpenAI RAG sync is still mocked locally and requires credential-backed operator validation; Jest still reports the pre-existing worker teardown warning after the full API suite`
