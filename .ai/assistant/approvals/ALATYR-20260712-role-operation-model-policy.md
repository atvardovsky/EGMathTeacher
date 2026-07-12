# Approval Record

Approval ID: `ALATYR-20260712-role-operation-model-policy`
Operation ID: `EGMT-20260712-role-operation-model-policy`
Operation type: `architecture-change external-boundary code-and-tests`
Plan version: `v1`
Plan hash: `not available; approval was given in chat before patch content existed`
Requested by: `project maintainer`
Approved by: `project maintainer`
Approved at: `2026-07-12T01:36:44+02:00`
Approval source/message: `User: "approve implementation"`
Expires at or reuse policy: `single implementation pass only`
Scope invalidation rule: `Approval is invalid if implementation adds production dependencies, live validation calls, destructive operations, system configuration changes, or non-OpenAI provider implementations.`

## Approved Scope

Allowed protected changes:

- Add a role/operation policy layer for AI model selection.
- Let tutor, RAG tutor, onboarding specialist, background assistant,
  quality-review, and image operations resolve independent model settings.
- Let Responses API operations resolve optional operation-level service-tier
  settings.
- Preserve OpenAI as the only implemented model provider in this POC and keep
  non-OpenAI providers stubbed.
- Update source-of-truth docs, env examples, diagrams, and tests for the
  accepted architecture.

Allowed files or surfaces:

- `apps/api/src/ai-model`
- `apps/api/src/config/ai.configuration.ts`
- `apps/api/src/tutor`
- `apps/api/src/student-profile`
- `apps/api/src/background-ai`
- `apps/api/test`
- `apps/api/.env.example`
- `README.md`
- `apps/api/README.md`
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
Introduce an AiOperationPolicyService under AiModelModule. Route tutor,
onboarding, background, quality-review, and image calls through operation keys
so each assistant role can resolve its own model and optional service tier.
Keep legacy OPENAI_* model settings as fallbacks, document AI_OPERATION_* env
overrides, and add tests around policy application and service call routing.
```

Approved validation or manual review:

- `npm run build`
- `npm test`
- `npm run lint`
- `npm run diagrams:render` because diagram sources change
- `npm run diagrams:check`
- `npm run alatyr:check`
- manual source-doc consistency review

## Use Result

Used by operation/change: `EGMT-20260712-role-operation-model-policy`
Patch changed after approval: `yes; documentation, diagram, env-example, and approval evidence were added within approved scope`
Implementation stayed within approved scope: `yes`
Validation run: `npm run build`; `npm test`; `npm run lint`; `npm run diagrams:render`; `npm run diagrams:check`; `npm run alatyr:check`; `git diff --check`
Result/evidence: `all validation commands passed; Vite build reported the existing chunk-size warning only`
Residual risk: `no live OpenAI smoke test, production provider validation, production migration rollback/backfill validation, or remote CI run was performed`
