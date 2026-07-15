# Alatyr Operation Request Template

Use this shape when asking an assistant to operate the installed adapter.

```text
Repository: <TARGET_REPOSITORY_ROOT>
Operation: <help | recheck-after-installation | recheck-after-framework-update | create-project-blueprint | product-change | logical-integrity-review | documentation-sync | ai-infrastructure-inventory | skill-adaptation | large-task-orchestration | adapter-maturity-review>
Goal:
Non-goals:
Known changed facts:
Review comments or defect reports to reconcile:
Task scale: <small | large-or-resumable>
Existing operation packet:
Allowed actions: <read-only | docs-only | adapter-only | code-and-tests | full-with-approval>
Approved Git diff base when scoped approval applies:
Explicit machine-readable approval records:
Validation expected:
Approval constraints:
Final evidence expected:
```

Accepted aliases include `alatyr-recheck`, `alatyr-blueprint`,
`alatyr-integrity`, `alatyr-change`, `alatyr-ai-inventory`,
`alatyr-adaptation <source>`, and `alatyr-add-ai <source>`.

Bootstrap context includes `.ai/assistant/context-router.json` as the
schema-v2 machine-readable companion to `.ai/assistant/context-profiles.md`.
Use `.ai/assistant/ai-infrastructure-router.json` before loading detailed
skills, prompts, gates, checkers, bridge files, or import policy.
Use `.ai/assistant/approvals/approval-record-template.json` when protected
change scope needs machine-checkable path containment. Re-derive invariants
from `.ai/project/source-of-truth-registry.md` before implementing and
reconcile related review items as one contract cluster.
