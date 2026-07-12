# Alatyr Operation Request Template

Use this shape when asking an assistant to operate the installed adapter.

```text
Repository: <TARGET_REPOSITORY_ROOT>
Operation: <help | recheck-after-installation | recheck-after-framework-update | create-project-blueprint | product-change | logical-integrity-review | documentation-sync | ai-infrastructure-inventory | skill-adaptation | adapter-maturity-review>
Goal:
Non-goals:
Known changed facts:
Allowed actions: <read-only | docs-only | adapter-only | code-and-tests | full-with-approval>
Validation expected:
Approval constraints:
Final evidence expected:
```

Accepted aliases include `alatyr-recheck`, `alatyr-blueprint`,
`alatyr-integrity`, `alatyr-change`, `alatyr-ai-inventory`,
`alatyr-adaptation <source>`, and `alatyr-add-ai <source>`.

Bootstrap context includes `.ai/assistant/context-router.json` as the
machine-readable companion to `.ai/assistant/context-profiles.md`.
