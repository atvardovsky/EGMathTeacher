# Approval Record

Approval ID: `ALATYR-20260712-lesson-lifecycle-usage`
Operation ID: `lesson-lifecycle-usage-implementation`
Operation type: `business-change architecture-change data-change ui-change`
Plan version: `2026-07-12-lesson-lifecycle-usage-v1`
Plan hash: `not available; approval was given in conversation for the discussed implementation set`
Requested by: `atvardovsky`
Approved by: `atvardovsky`
Approved at: `2026-07-12T16:34:38+02:00`
Approval source/message: `User: "implement all discussed set"`
Expires at or reuse policy: `single implementation scope only`
Scope invalidation rule: `new lesson policy, pricing policy, privacy policy, external provider, production deployment, or destructive data operation requires fresh approval`

## Approved Scope

Allowed protected changes:

- Add lesson lifecycle state with configurable daily and continuous learning-time heuristics.
- Add goal-based lesson stop behavior.
- Use recent progress/regression signals to guide explanation-strategy adjustment.
- Add user-visible usage/expense transparency for every signed-in user.
- Add SQLite schema, API contracts, web UI, tests, docs, and diagrams required for the accepted behavior.

Allowed files or surfaces:

- `apps/api/src/database`
- `apps/api/src/lesson`
- `apps/api/src/usage`
- `apps/api/src/ai-model`
- `apps/api/src/tutor`
- `apps/api/src/background-ai`
- `apps/api/src/student-profile`
- `apps/api/test`
- `apps/web/src`
- `apps/web/e2e`
- `apps/web/vite.config.ts`
- `README.md`
- `apps/api/README.md`
- `.ai/project`
- `.ai/assistant/approvals`

Excluded actions:

- Live OpenAI calls.
- System web server changes.
- Production service reloads.
- Secret changes or credential exposure.
- Deleting, resetting, or backfilling existing data outside additive POC migrations.

Allowed actions mode:
`code-and-tests`

## Plan Evidence

Approved plan summary:

```text
Implement lesson sessions with time-limit heuristics, goal stop, progress/regression strategy feedback, a local usage ledger, and a user-visible usage bar with safe per-lesson operation details.
```

Approved validation or manual review:

- `npm run build`
- `npm test`
- `npm run lint`
- `npm run e2e`
- `npm run diagrams:render`
- `npm run diagrams:check`
- `npm run alatyr:check`
- manual logical-integrity review

## Use Result

Used by operation/change: `lesson lifecycle, goal stop, strategy signal, and usage transparency implementation`
Patch changed after approval: `yes; implementation details were adjusted during local build/test feedback`
Implementation stayed within approved scope: `yes`
Validation run: `npm run build`; `npm test`; `npm run lint`; `npm run e2e`; `npm run diagrams:render`; `npm run diagrams:check`; `npm run alatyr:check`; `git diff --check`
Result/evidence: `all listed local validation passed for commit 2e00871; build completed with the existing Vite large-chunk warning`
Residual risk: `usage costs remain local estimates unless current provider pricing is configured; production privacy/billing reconciliation remains a gap; follow-up review found lesson-mode, scoped-progress, model-completion, and timing heuristic repairs tracked by ALATYR-20260712-lesson-contract-repair`
