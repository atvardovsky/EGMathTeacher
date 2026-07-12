# EGMathTeacher Project Docs

This directory owns EGMathTeacher project facts for Alatyr-guided assistant
work.

Use these files as the project source-of-truth set:

- `contour.md`: project ownership boundary.
- `blueprint.md`: top-level accepted project facts.
- `context-map.md`: where to find facts and how to handle missing context.
- `source-of-truth-registry.md`: fact owner and derived surface registry.
- `use-cases.md`: user workflows and business/domain rules.
- `architecture.md`: system shape, module ownership, endpoints, and source
  architecture diagram.
- `runtime-flows.md`: request, RAG, image, knowledge upload, voice, and
  deployment flows.
- `data-model.md`: local persistence, in-memory state, remote OpenAI objects,
  and retention gaps.
- `lesson-agent-tools.md`: Lesson Decision Agent tools, backend policy
  contract, allowed state changes, evidence requirements, privacy limits, and
  observability.
- `validation.md`: discovered commands, test surface, and unresolved checks.
- `gaps.md`: grouped current gaps, fixed cleanup items, and blocked decisions.
- `security-safety.md`: secrets, auth, live-service, destructive-operation,
  privacy, and dependency boundaries.
- `guards.md`: current API guard coverage and authorization gaps.
- `diagrams.md`: diagram and generated-file policy.
- `ui-guidelines.md`: web UI rules, teen UX constraints, Mantine usage,
  localization rules, and validation expectations.
- `ui-tree.md`: current web UI state/navigation tree.
- `diagrams/`: editable Mermaid diagram sources.

When project facts change, update the smallest coherent set of files here,
plus public docs, tests, env examples, or code when they own the same fact.
