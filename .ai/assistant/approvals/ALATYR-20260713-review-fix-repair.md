# Approval Record

Approval ID: `ALATYR-20260713-review-fix-repair`
Operation ID: `review-fix-repair-20260713`
Operation type: `business-change architecture-change data-change validation-change`
Plan version: `2026-07-13-review-fix-repair-v1`
Plan hash: `not available; approval followed the user's review issue list and direct implementation request in conversation`
Requested by: `atvardovsky`
Approved by: `atvardovsky`
Approved at: `2026-07-13T00:26:00+02:00`
Approval source/message: `User said "prepare and implment fixes for all issues, after commit and push" after providing review findings.`
Expires at or reuse policy: `single implementation scope only`
Scope invalidation rule: `new external service, live OpenAI RAG sync, production deployment, new npm dependency, broad verifier expansion beyond the current POC vertical, or production privacy/legal behavior requires fresh approval`

## Approved Scope

Allowed protected changes:

- Enforce imported mastery criteria before writing mastery evidence, progress rows, or accepting practice/mistake-review goal completion.
- Keep verifier attempts separate from mastery outcomes and store mastery policy evidence on attempts.
- Use imported task-bank hint ladders and task-bank source semantics in lesson tasks.
- Add explicit task-bank-required mode for demos where fallback must not hide import problems.
- Harden knowledge-pack RAG sync wait-ready, partial-pack reconciliation, and local sync-job claim behavior.
- Update tests, source-of-truth docs, Alatyr project files, and diagrams.

Allowed files or surfaces:

- `apps/api/src/config`
- `apps/api/src/database`
- `apps/api/src/knowledge`
- `apps/api/src/lesson`
- `apps/api/src/tutor`
- `apps/api/test`
- `apps/web/src`
- `apps/api/.env.example`
- `apps/api/README.md`
- `README.md`
- `.ai/project`
- `.ai/assistant/approvals`

Excluded actions:

- Live OpenAI create/upload/attach/delete calls.
- System web server, TLS, PM2, or production deployment changes.
- New production dependency.
- New broad curriculum verifier family beyond the existing POC vertical.
- Production billing, privacy, or legal policy changes.

Allowed actions mode:
`code-and-tests-with-docs`

## Plan Evidence

Approved plan summary:

```text
Repair the post-review issues: enforce curriculum mastery criteria, expose
task-bank hints, improve task reuse/fallback semantics, make RAG wait-ready
and partial reconciliation safe, make local sync claims transactional, update
human/AI project documentation and diagrams, validate locally, then commit and
push.
```

Approved validation or manual review:

- `npm run build`
- `npm test`
- `npm run lint`
- `npm run e2e`
- `npm run diagrams:render`
- `npm run diagrams:check`
- `npm run alatyr:check`
- `git diff --check`
- manual logical integrity review

## Use Result

Used by operation/change: `review-fix-repair-20260713`
Patch changed after approval: `yes; implementation added retry-friendly task status behavior and independent-success observability while staying inside the approved issue scope`
Implementation stayed within approved scope: `yes`
Validation run: `2026-07-13T00:40:34+02:00 through 2026-07-13T00:43:41+02:00: focused Jest verifier/knowledge/profile tests; npm run build; npm test; npm run lint; npm run e2e; npm run diagrams:render; npm run diagrams:check; npm run alatyr:check; git diff --check`
Result/evidence: `all listed local validation passed; E2E uses mocked browser API routes; no live OpenAI calls were made`
Residual risk: `curriculum routing remains text-scored and POC-level, verifier coverage remains limited to the linear-equation numeric vertical, adaptive task selection remains simple prior-use ordering, and live non-dry-run RAG sync was not run`
