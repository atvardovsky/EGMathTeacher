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
7. Re-derive invariant and dependency constraints from
   `.ai/project/source-of-truth-registry.md`. When the optional consistency
   map is disabled or incomplete, state the invariant in testable language
   before choosing a repair.
8. Cluster related review comments, defect reports, or drift findings by the
   changed fact and shared contract. A fix that satisfies one item but leaves
   the shared invariant false is incomplete.
9. Compare affected code, tests, docs, env examples, deployment references,
   prompts, bridge files, gates, generated artifacts, and assistant rules.
10. Name conflicts and missing facts explicitly.
11. Choose the smallest coherent repair set.
12. Run relevant target validation or record unresolved checks.
13. Report final evidence.

## Evidence Template

```text
Change intent:
Changed facts:
Risk class:
Source of truth:
Re-derived invariants:
Review-item reconciliation:
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
