# Project Blueprint Creation Flow

Use this flow when creating, repairing, or rechecking EGMathTeacher blueprint
or equivalent source-of-truth docs.

## Target Sources

- Project source of truth: `.ai/project/README.md`
- Existing blueprint or equivalent docs: `.ai/project/blueprint.md`,
  `.ai/project/use-cases.md`, `.ai/project/architecture.md`,
  `.ai/project/runtime-flows.md`, `.ai/project/data-model.md`
- Public docs: `README.md`
- Architecture/design docs: `.ai/project/architecture.md`,
  `.ai/project/diagrams.md`, `.ai/project/diagrams/*.mmd`
- Tests and validation: `.ai/project/validation.md` and `apps/api/test`
- Security/live-service policy: `.ai/project/security-safety.md`
- Diagram policy: `.ai/project/diagrams.md`

## Steps

1. Load bootstrap context, framework docs required by the selected profile,
   target contours, and existing target source-of-truth docs.
2. Identify blueprint scope and non-goals.
3. Collect target evidence from docs, code structure, tests, validation, CI,
   diagrams, prompts, skills, gates, and bridge files.
4. Classify facts by owner: framework, project, repository adapter, bridge,
   skill/prompt, or generated artifact.
5. Draft or repair only facts supported by target evidence.
6. Mark missing or contradictory facts explicitly.
7. Apply `.ai/assistant/flows/logical-integrity-review.flow.md`.
8. Update blueprint or equivalent docs, project contour, flow docs, diagrams,
   gates, prompts, skills, or bridge files only when their owned facts change.
9. Run target validation that exists. Do not invent commands.
10. Report final evidence, unresolved facts, skipped checks, approvals, and
    residual risk.

## Rejection Criteria

Reject or revise blueprint work that:

- invents business rules, architecture, data model, runtime flows, security
  policy, validation commands, or diagram tooling
- copies source-project facts from Alatyr Core or another repository
- treats generated artifacts or bridge files as canonical without checking
  their owning source
- claims blueprint completion while placeholders or missing facts remain
- changes accepted architecture or business behavior without approval
