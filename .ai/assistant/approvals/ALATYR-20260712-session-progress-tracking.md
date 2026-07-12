# Approval Record

Approval ID: `ALATYR-20260712-session-progress-tracking`
Operation ID: `session-progress-tracking-20260712`
Operation type: `business-change,data-change,ui-behavior-change`
Plan version: `1`
Plan hash: `not available; approval was given in chat for the discussed implementation`
Requested by: `atvardovsky`
Approved by: `atvardovsky`
Approved at: `2026-07-12`
Approval source/message: `User message: "implement it" after discussion of lesson/session evidence levels and progression/regression tracking.`
Expires at or reuse policy: `single implementation pass only`
Scope invalidation rule: `Changing retention, production privacy policy, live-service validation, external providers, destructive migration behavior, or adding new dependencies requires a new approval.`

## Approved Scope

Allowed protected changes:

- Add lesson-type support to tutor message flow.
- Store teaching-useful session evidence levels in SQLite.
- Store skill-level progression, regression, stability, confidence, support,
  independence, and evidence in SQLite.
- Expose compact read-only session/progress memory through the student profile
  DTO and Settings UI.
- Update background assistant prompts to request layered evidence and
  progression/regression signals.

Allowed files or surfaces:

- `apps/api/src/database/database.service.ts`
- `apps/api/src/tutor`
- `apps/api/src/background-ai`
- `apps/api/src/student-profile`
- `apps/api/test`
- `apps/web/src`
- `apps/web/e2e`
- `README.md`
- `.ai/project`
- `.ai/assistant/approvals`
- `.ai/assistant/infrastructure-index.md`

Excluded actions:

- Live OpenAI calls.
- Production data backfills or destructive data changes.
- System web server, PM2, certificate, or deployment changes.
- New production dependencies or external services.
- Storing non-teaching sensitive personal details.

Allowed actions mode:
`code-and-tests`

## Plan Evidence

Approved plan summary:

```text
Implement lesson type metadata and per-session learning evidence by extending
existing tutor/background/student-profile flows. Store L0-L5 teaching evidence
with compact session summaries and skill progress/regression rows in SQLite.
Expose this memory read-only in Settings and keep background processing
eventually consistent.
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

## Use Result

Used by operation/change: `session-progress-tracking-20260712`
Patch changed after approval: `yes; implementation followed the approved scope`
Implementation stayed within approved scope: `yes`
Validation run: `npm run build; npm test; npm run lint; npm run e2e; npm run diagrams:render; npm run diagrams:check; npm run alatyr:check; git diff --check`
Result/evidence: `all listed local validation passed`
Residual risk: `no live OpenAI validation, no production migration/backfill validation, no accessibility or visual regression command exists`
