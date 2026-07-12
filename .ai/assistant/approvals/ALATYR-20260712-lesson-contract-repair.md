# Approval Record

Approval ID: `ALATYR-20260712-lesson-contract-repair`
Operation ID: `lesson-contract-repair-20260712`
Operation type: `business-change data-change ui-behavior-change documentation-sync`
Plan version: `2026-07-12-review-repair-v1`
Plan hash: `not available; approval was given in conversation for the review realization`
Requested by: `atvardovsky`
Approved by: `atvardovsky`
Approved at: `2026-07-12T17:14:19+02:00`
Approval source/message: `User: "do an realizations" after review of version 4.0 defects and next fixes.`
Expires at or reuse policy: `single repair scope only`
Scope invalidation rule: `new lesson policy, production privacy policy, destructive migration, external provider, live-service validation, or system deployment action requires fresh approval`

## Approved Scope

Allowed protected changes:

- Start a new lesson session when lesson mode changes.
- Add API-side protection for older clients that reuse a conversation id with a different lesson type.
- Scope lesson progress/regression strategy signals to the current conversation, lesson type, or inferred topic hint.
- Prevent raw model-only `goalStatus=reached` from completing a lesson without backend-visible student evidence.
- Reduce the POC active-time heuristic drift by making the first turn zero seconds and lowering the default minimum counted turn to 30 seconds.
- Update implementation, tests, docs, diagram sources, rendered diagram artifacts, and approval evidence required for this repair.

Allowed files or surfaces:

- `apps/api/src/lesson`
- `apps/api/src/tutor`
- `apps/api/src/config`
- `apps/api/test`
- `apps/api/.env.example`
- `apps/web/src`
- `apps/web/e2e`
- `README.md`
- `.ai/project`
- `.ai/assistant/approvals`

Excluded actions:

- Live OpenAI calls.
- Production data backfills or destructive data changes.
- System web server, PM2, certificate, or deployment changes.
- New production dependencies or external services.
- Changing production privacy, billing, auth, or consent policy.

Allowed actions mode:
`code-and-tests`

## Plan Evidence

Approved plan summary:

```text
Repair the review findings by splitting lesson sessions on mode change, scoping
progress/regression signals, treating model completion as pending until
backend evidence exists, reducing active-time drift, and syncing tests/docs.
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
- manual logical-integrity review

## Use Result

Used by operation/change: `lesson-contract-repair-20260712`
Patch changed after approval: `yes; implementation details and E2E selector were adjusted during validation`
Implementation stayed within approved scope: `yes`
Validation run: `npm run build`; `npm test`; `npm run lint`; `npm run e2e`; `npm run diagrams:render`; `npm run diagrams:check`; `npm run alatyr:check`; `git diff --check`
Result/evidence: `all listed local validation passed; build completed with the existing Vite large-chunk warning`
Residual risk: `deterministic math mastery checking and full first-meeting conversational onboarding remain separate product gaps; no live OpenAI or remote CI validation was run`
