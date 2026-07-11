# Approval Record

Approval ID: `ALATYR-20260711-background-assistant-work`
Operation ID: `background-assistant-work-20260711`
Operation type: `product-change`
Plan version: `1`
Plan hash: `not available; approval was given through the active chat request`
Requested by: `atvardovsky`
Approved by: `atvardovsky`
Approved at: `2026-07-11`
Approval source/message: `User request: "implement background support for all assistants where it logical"`
Expires at or reuse policy: `single change scope only`
Scope invalidation rule: `Invalid if adding live validation, new dependencies, external services, system configuration changes, destructive data operations, or broader assistant/tool permissions.`

## Approved Scope

Allowed protected changes:

- Add background support for logical non-immediate assistant work.
- Add local SQLite persistence for background AI jobs and sanitized learning
  signals.
- Hook tutor turns into delayed learning-signal, session-summary,
  profile-refresh, strategy-refresh, and rare quality-review assistants.
- Update project source-of-truth docs, diagrams, tests, and env examples for
  this architecture and business behavior.

Allowed files or surfaces:

- `apps/api/src/background-ai`
- `apps/api/src/tutor`
- `apps/api/src/database`
- `apps/api/src/config`
- `apps/api/test`
- `apps/api/.env.example`
- `README.md`
- `.ai/project`
- `.ai/assistant/approvals`

Excluded actions:

- Live OpenAI calls or spend-affecting validation.
- New production dependencies or external services.
- System web server, PM2, certificate, or production deployment changes.
- Destructive SQLite, transcript, remote OpenAI file, or vector-store
  operations.
- Authentication, authorization, cookie, role, or permission changes.
- Broadening assistant tool, MCP, connector, or plugin permissions.

Allowed actions mode:
`code-and-tests`

## Plan Evidence

Approved plan summary:

```text
Immediate tutor answers remain synchronous. Non-immediate assistant work moves
to a SQLite-backed in-process background worker: learning-signal extraction
after tutor turns, session summaries after a configured conversation interval,
student profile and teaching strategy refresh after a configured user-turn
interval, and rare quality review for suspicious short answers. Background
payloads and results are sanitized to teaching-useful signals only.
```

Approved validation or manual review:

- `npm run build`
- `npm test`
- `npm run lint`
- `npm run diagrams:render`
- `npm run diagrams:check`
- `npm run alatyr:check`
- Manual source-doc and logical-integrity review

## Use Result

Used by operation/change: `background assistant support implementation`
Patch changed after approval: `no; implementation stayed within requested background support scope`
Implementation stayed within approved scope: `yes; no new dependencies, live calls, destructive actions, auth changes, or system service changes`
Validation run: `npm test`, `npm run build`, `npm run lint`,
`npm run diagrams:render`, `npm run diagrams:check`, `npm run alatyr:check`,
and `git diff --check`
Result/evidence: `all listed local checks passed; final assistant response for this task`
Residual risk: `POC in-process worker is not a production queue; no live OpenAI smoke test is run without explicit spend approval`
