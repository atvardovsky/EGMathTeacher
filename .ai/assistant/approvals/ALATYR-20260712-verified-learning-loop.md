# Approval Record

Approval ID: `ALATYR-20260712-verified-learning-loop`
Operation ID: `verified-learning-loop-20260712`
Operation type: `business-change architecture-change data-change ui-change ai-infrastructure`
Plan version: `2026-07-12-verified-learning-loop-v1`
Plan hash: `not available; approval followed the assistant-provided cross-layer change plan in conversation`
Requested by: `atvardovsky`
Approved by: `atvardovsky`
Approved at: `2026-07-12T20:12:29+02:00`
Approval source/message: `User said "implement" after requesting a plan of changes for the layer-gap analysis and agent-directed, backend-governed lesson architecture.`
Expires at or reuse policy: `single implementation scope only`
Scope invalidation rule: `new external service, new production dependency, live-provider validation, system deployment, production privacy/legal policy, or verifier expansion beyond the approved POC vertical requires fresh approval`

## Approved Scope

Allowed protected changes:

- Add a POC deterministic verified-learning loop for one ЕГЭ math vertical.
- Add curriculum IDs and backend-owned task, attempt, verifier, and mastery evidence records.
- Add request idempotency for tutor turns.
- Add backend policy hardening so verified practice and mistake-review completion depends on backend verifier evidence.
- Route proposed profile deltas into sanitized background observations instead of applying them directly.
- Add decision and verifier observability to usage summaries and the learner-facing debug/usage bar.
- Update source-of-truth docs, diagrams, tests, and adapter references.

Allowed files or surfaces:

- `apps/api/src/lesson`
- `apps/api/src/tutor`
- `apps/api/src/usage`
- `apps/api/src/database`
- `apps/api/src/config`
- `apps/api/src/ai-model`
- `apps/api/.env.example`
- `apps/api/test`
- `apps/web/src`
- `apps/web/e2e`
- `.ai/project`
- `.ai/assistant`
- `.ai/alatyr.yaml`
- `AGENTS.md`
- `README.md`

Excluded actions:

- Live OpenAI or other external service validation.
- New npm dependencies or production services.
- Native provider function/tool-calling migration.
- Full curriculum graph or broad task-bank implementation beyond the POC seed.
- Conversational first-meeting UI replacement.
- Production privacy/legal hardening.
- System web server, PM2, TLS, or deployment changes.

Allowed actions mode:
`code-and-tests-with-docs`

## Plan Evidence

Approved plan summary:

```text
Implement the next POC layer of the Lesson Decision architecture: backend-owned
curriculum IDs, a first deterministic verifier vertical, task/attempt/mastery
evidence tables, request idempotency, profile-delta routing, goal-completion
policy hardening, decision/verifier usage observability, learner-facing debug
details, and synchronized Alatyr documentation and diagrams.
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

Used by operation/change: `verified-learning-loop-20260712`
Patch changed after approval: `yes; implementation details were narrowed to one supported linear-equation verifier vertical and learner-safe observability`
Implementation stayed within approved scope: `yes`
Validation run: `2026-07-12T20:17:41+02:00: npm run diagrams:render; npm run diagrams:check; npm run build; npm test; npm run lint; npm run e2e; npm run alatyr:check; git diff --check`
Result/evidence: `all listed local validation passed; code checks were rerun after the final lifecycle fix; E2E uses mocked browser API flow and no live OpenAI calls`
Residual risk: `verifier coverage is intentionally limited to one POC vertical; broader curriculum graph, richer hint/retry loop, conversational first meeting, live-provider validation, and production privacy hardening remain deferred`
