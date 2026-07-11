# Approval Record

Approval ID: `ALATYR-20260711-specialist-profile-pipeline`
Operation ID: `EGMT-20260711-specialist-profile-pipeline`
Operation type: `business-change architecture-change data-change security-sensitive`
Plan version: `v1`
Plan hash: `not available; approval was given in chat before patch content existed`
Requested by: `project maintainer`
Approved by: `project maintainer`
Approved at: `2026-07-11T12:12:25+02:00`
Approval source/message: `User: "agrre implement it. Also we need to be able to support not only openai, but we start from an openai"`
Expires at or reuse policy: `single implementation pass only`
Scope invalidation rule: `Approval is invalid if implementation adds production dependencies, live validation calls, destructive operations, system configuration changes, or non-OpenAI provider implementations.`

## Approved Scope

Allowed protected changes:

- Change first-login profile generation from one model call to specialist AI
  evaluator calls.
- Keep psychopedagogical profile as teaching strategy only, with no clinical
  diagnosis or sensitive personal profiling.
- Add an OpenAI-first model-provider facade for tutor/profile/image/file/vector
  operations.
- Update source-of-truth docs, diagrams, and tests for the accepted behavior.

Allowed files or surfaces:

- `apps/api/src/ai-model`
- `apps/api/src/app.module.ts`
- `apps/api/src/config/ai.configuration.ts`
- `apps/api/src/student-profile`
- `apps/api/src/tutor`
- `apps/api/src/knowledge`
- `apps/api/test`
- `apps/api/.env.example`
- `README.md`
- `.ai/project`
- `.ai/assistant/approvals`

Excluded actions:

- No live OpenAI or other provider calls for validation.
- No production dependency additions.
- No implementation of non-OpenAI providers beyond stubs.
- No database destructive operation or migration.
- No system web server, PM2, certificate, or deployment changes.
- No weakening of gates, tests, approval rules, or security policy.

Allowed actions mode:
`code-and-tests`

## Plan Evidence

Approved plan summary:

```text
Implement a controlled specialist pipeline for student onboarding:
math knowledge diagnostician, psychopedagogical profiler, and teaching strategy
planner. Store resulting JSON in the existing student_profiles fields. Add a
model-provider facade that delegates to OpenAI now and leaves other providers
as stubs. Synchronize docs, diagrams, tests, and validation.
```

Approved validation or manual review:

- `npm run build`
- `npm test`
- `npm run lint`
- `npm run diagrams:render` because diagram sources change
- manual source-doc consistency review

## Use Result

Used by operation/change: `EGMT-20260711-specialist-profile-pipeline`
Patch changed after approval: `no scope expansion; implementation stayed within approved plan`
Implementation stayed within approved scope: `yes`
Validation run: `npm run build`; `npm test`; `npm run lint`; `npm run diagrams:render`
Result/evidence: `all validation commands passed; see final response for command details`
Residual risk: `no browser E2E, CI, live OpenAI smoke test, or production privacy/compliance validation exists in this repository`
