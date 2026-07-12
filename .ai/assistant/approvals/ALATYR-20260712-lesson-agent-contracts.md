# Approval Record

Approval ID: `ALATYR-20260712-lesson-agent-contracts`
Operation ID: `lesson-agent-contracts-20260712`
Operation type: `business-change architecture-change data-change ai-infrastructure`
Plan version: `2026-07-12-lesson-agent-contracts-v1`
Plan hash: `not available; approval followed the assistant-provided full change plan in conversation`
Requested by: `atvardovsky`
Approved by: `atvardovsky`
Approved at: `2026-07-12T19:16:42+02:00`
Approval source/message: `User said "implement" after reviewing the full plan of changes for Lesson Agent contracts.`
Expires at or reuse policy: `single implementation scope only`
Scope invalidation rule: `native provider function calling, deterministic verifier, curriculum graph, conversational first lesson, new dependency, live-service validation, production privacy/security change, or system deployment action requires fresh approval`

## Approved Scope

Allowed protected changes:

- Add Lesson Decision Agent contracts and backend-governed action policy.
- Remove semantic regex from lesson goal-completion acceptance.
- Treat self-reported understanding as weak evidence only.
- Add a model-routed `lessonDecision` operation and assistant role.
- Add SQLite decision observability for proposed actions and policy results.
- Feed decision/policy results into tutor answer generation.
- Update source-of-truth docs, diagrams, tests, and adapter references.

Allowed files or surfaces:

- `apps/api/src/lesson`
- `apps/api/src/tutor`
- `apps/api/src/ai-model`
- `apps/api/src/config`
- `apps/api/src/database`
- `apps/api/.env.example`
- `apps/api/test`
- `apps/web/src/types.ts`
- `.ai/project`
- `.ai/assistant`
- `.ai/alatyr.yaml`
- `AGENTS.md`

Excluded actions:

- Live OpenAI or other external service validation.
- Native OpenAI function/tool-calling migration.
- Deterministic math verifier implementation.
- Curriculum graph or task-bank implementation.
- Conversational first-meeting UI replacement.
- New npm dependencies or production services.
- System web server, PM2, TLS, or deployment changes.
- Privacy/legal production policy implementation.

Allowed actions mode:
`code-and-tests-with-docs`

## Plan Evidence

Approved plan summary:

```text
Introduce a Lesson Decision Agent before final tutor response generation,
represent decisions as structured allowed actions, apply backend policy before
durable lesson-state changes, remove regex-based goal-completion acceptance,
persist action-level decision observability, and synchronize project docs,
diagrams, tests, and Alatyr source-of-truth references.
```

Approved validation or manual review:

- `npm run build`
- `npm test`
- `npm run lint`
- `npm run diagrams:render`
- `npm run diagrams:check`
- `npm run alatyr:check`
- manual logical integrity review

## Use Result

Used by operation/change: `lesson-agent-contracts-20260712`
Patch changed after approval: `no protected scope expansion; implementation details followed local code constraints`
Implementation stayed within approved scope: `yes`
Validation run: `2026-07-12T20:17:41+02:00: npm run diagrams:render; npm run diagrams:check; npm run build; npm test; npm run lint; npm run e2e; npm run alatyr:check; git diff --check`
Result/evidence: `all listed local validation passed; code checks were rerun after the final lifecycle fix; E2E uses mocked browser API flow and no live OpenAI calls`
Residual risk: `only one deterministic verifier vertical is included in the follow-up approved scope; broader curriculum, richer retry loop, and conversational first meeting remain deferred`
