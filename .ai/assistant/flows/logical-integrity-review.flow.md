# Logical Integrity Review Flow

Use this flow before claiming a semantic or logical change is consistent.

## Steps

1. Apply the semantic change decision gate from
   `.ai/assistant/gates/checklist.md`.
2. State the change intent in concrete language.
3. List changed facts, not only changed files.
4. Classify risk using `.ai/framework/change-risk-model.md` and the target
   approval gates.
5. Map each changed fact to target contracts:
   - business/domain rules
   - use cases or workflows
   - architecture levels or module boundaries
   - object/data contracts
   - diagrams
   - tests and validation
   - prompts, gates, skills, and bridge files
6. Identify source of truth:
   - Framework rule: `.ai/framework`.
   - Project fact: `.ai/project`, `README.md`, API docs, code, tests.
   - Adapter fact: `.ai/assistant`, root bridge files.
   - Generated artifact: source file must be named.
7. Compare affected code, tests, docs, env examples, deployment references,
   prompts, bridge files, gates, generated artifacts, and assistant rules.
8. Name conflicts and missing facts explicitly.
9. Choose the smallest coherent repair set.
10. Run relevant target validation or record unresolved checks.
11. Report final evidence.

## Evidence Template

```text
Change intent:
Changed facts:
Risk class:
Source of truth:
Conflicts found:
Repair set:
Validation:
Approvals:
Residual risk:
```

## Explanation Format

```text
Logical issue:
Changed fact:
Expected contract:
Conflict:
Source of truth:
Repair:
Gate:
```
