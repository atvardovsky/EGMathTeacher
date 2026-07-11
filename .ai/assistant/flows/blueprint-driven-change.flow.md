# Blueprint-Driven Change Flow

Use this flow when a requested change may affect EGMathTeacher accepted
behavior, source-of-truth docs, implementation, tests, diagrams, or assistant
governance.

## Target Sources

- Project source of truth: `.ai/project/README.md`
- Blueprint or equivalent docs: `.ai/project/blueprint.md`,
  `.ai/project/use-cases.md`, `.ai/project/architecture.md`,
  `.ai/project/runtime-flows.md`, `.ai/project/data-model.md`
- Project flow docs: `.ai/project/runtime-flows.md`
- Test strategy and validation: `.ai/project/validation.md`
- Diagram policy: `.ai/project/diagrams.md`
- Security/live-service policy: `.ai/project/security-safety.md`
- Source-of-truth registry: `.ai/project/source-of-truth-registry.md`

## Steps

1. State change intent and non-goals.
2. Load bootstrap context, select a profile from
   `.ai/assistant/context-profiles.md`, and read the required target sources.
3. Apply `.ai/assistant/flows/logical-integrity-review.flow.md`.
4. List changed facts and affected project areas.
5. Update target blueprint or equivalent source-of-truth docs when accepted
   facts change.
6. Update project flow, use-case, data, runtime, architecture, public docs, or
   assistant adapter docs when those facts change.
7. Prepare an implementation plan that names affected boundaries, tests,
   diagrams, approvals, and validation.
8. Change code, tests, diagrams, prompts, skills, bridge files, gates, or
   checker rules as required by the accepted fact change.
9. Run target validation that exists. Do not invent commands.
10. Perform a final consistency check across changed surfaces.
11. Report final evidence, skipped checks, approvals, and residual risk.

## Approval Gate

Require explicit programmer approval before:

- architecture changes
- accepted business behavior changes
- weakened tests, gates, documentation-sync rules, or approval requirements
- new production dependencies, services, permissions, or credentials
- live, destructive, spend-affecting, data-loss, security, or privacy changes
- overwriting existing AI instructions
- integrating third-party assistant infrastructure into canonical target files

## Final Evidence

Report:

- changed facts
- source-of-truth or blueprint updates
- implementation, test, diagram, prompt, skill, gate, bridge, or checker
  updates
- validation run or unresolved
- approvals used
- skipped checks and residual risk

## Rejection Criteria

Do not:

- implement behavior changes without source-of-truth sync
- invent missing business rules, validation commands, diagrams, or security
  policies
- hide architecture or security changes inside docs-only edits
- claim validation without command output or manual evidence
