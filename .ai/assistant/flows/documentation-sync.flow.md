# Documentation Sync Flow

Use this flow to keep code, docs, diagrams, prompts, gates, skills, bridge
files, and assistant workflows synchronized after relevant changes.

## Target Sources

- `.ai/project/source-of-truth-registry.md`
- `.ai/project/README.md`
- `.ai/project/blueprint.md`
- `.ai/project/context-map.md`
- `.ai/project/use-cases.md`
- `.ai/project/architecture.md`
- `.ai/project/runtime-flows.md`
- `.ai/project/data-model.md`
- `.ai/project/validation.md`
- `.ai/project/security-safety.md`
- `.ai/project/guards.md`
- `.ai/project/diagrams.md`
- `README.md`
- `apps/api/README.md`
- `apps/api/docs/webrtc-module.md`
- `apps/api/Agent.md`
- `.ai/assistant` when assistant operation, gate, bridge, prompt, or AI
  infrastructure facts change

## Steps

1. Inspect changed files.
2. Apply the semantic change decision gate from
   `.ai/assistant/gates/checklist.md`.
3. Apply `.ai/framework/logical-integrity.md` for changed facts, source of
   truth, repair direction, and evidence.
4. Identify changed facts, not only changed files.
5. Map changed facts to target source-of-truth docs using
   `.ai/project/source-of-truth-registry.md`.
6. Update companion code, docs, tests, diagrams, prompts, gates, skills,
   bridge files, or checker rules when affected.
7. Run target validation that exists.
8. Report skipped checks and residual risk.

## Rejection Criteria

Do not use documentation-only work to hide architecture, security, behavior,
or approval changes. Do not edit generated artifacts as source when the
editable source exists.
