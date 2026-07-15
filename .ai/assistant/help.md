# EGMathTeacher Alatyr Help

Alatyr Core in this repository is used through assistant requests over the
installed Markdown adapter. It is not a shell command.

These aliases are chat/request shortcuts, not executable commands.

Full operation reference: `.ai/assistant/help-reference.md`.

Default routing:

- If the operation is clear and low risk, choose the matching operation and
  report the chosen route.
- If the request is unclear, show only the two or three closest operations and
  ask for the smallest missing decision.
- Use `.ai/assistant/context-router.json` to choose task context before
  expanding the reading set, and use `.ai/assistant/context-profiles.md` when
  human rationale or conflict resolution is needed.
- Use `.ai/assistant/approvals/approval-record-template.json` with an
  explicitly selected approval record when protected-change scope needs
  deterministic changed-path enforcement.
- Use `.ai/assistant/module-profile.md` to avoid routing to blocked or
  disabled optional modules.

## Quick Operations

Operation: `help`
Use when: the user asks what Alatyr can do or the request is unclear.
Flow: `.ai/assistant/flows/operation-routing.flow.md`
Minimum input: goal or suspected task area.

Operation: `product-change`
Alias: `alatyr-change`
Use when: accepted behavior, architecture, data, runtime, or public contract
may change.
Flow: `.ai/assistant/flows/blueprint-driven-change.flow.md`
Minimum input: change intent, non-goals, and approval constraints.

Operation: `logical-integrity-review`
Alias: `alatyr-integrity`
Use when: code, docs, tests, diagrams, prompts, skills, gates, or bridges may
disagree.
Flow: `.ai/assistant/flows/logical-integrity-review.flow.md`
Minimum input: changed fact, suspected drift, or files to inspect.

Operation: `large-task-orchestration`
Use when: the work is explicitly large, phased, cross-boundary, or resumable.
Flow: `.ai/assistant/flows/large-task-orchestration.flow.md`
Minimum input: goal, non-goals, allowed actions, and why a packet is needed.

Operation: `create-project-blueprint`
Alias: `alatyr-blueprint`
Use when: creating, repairing, or rechecking blueprint-equivalent
source-of-truth docs from target evidence.
Flow: `.ai/assistant/flows/project-blueprint-creation.flow.md`
Minimum input: blueprint scope and non-goals.

Operation: `recheck-after-framework-update`
Alias: `alatyr-recheck`
Use when: checking whether an Alatyr Core update requires target adapter
migration.
Flow: `.ai/assistant/flows/adapter-recheck.flow.md`
Minimum input: update source or changed framework baseline.

AI infrastructure shortcuts:

- `alatyr-ai-inventory`: route to `ai-infrastructure-inventory`.
- `alatyr-adaptation <source>`: route to `skill-adaptation` in review or
  adaptation mode.
- `alatyr-add-ai <source>`: route to `skill-adaptation` with canonical
  integration intent after inventory, provenance, prompt-injection, safety,
  and approval checks.
- For any AI infrastructure request, use
  `.ai/assistant/ai-infrastructure-router.json` before loading detailed item
  context.

Common aliases:

- `Alatyr help`: `help`
- `update Alatyr` or `обнови Alatyr`: `recheck-after-framework-update`
- `check Alatyr` or `проверь Alatyr`: `recheck-after-installation` or
  `adapter-maturity-review`
- `create blueprint` or `создай blueprint`: `create-project-blueprint`
- `check integrity` or `проверь целостность`: `logical-integrity-review`
- `change business rule` or `измени бизнес-правило`: `product-change`

## Minimal Request Shape

```text
Use the installed Alatyr adapter in this repository.

Operation type: <operation>
Goal:
Non-goals:
Known context:
Allowed actions: <read-only | docs-only | adapter-only | code-and-tests | full-with-approval>
Expected final evidence:
```

## When Unsure

1. Say which parts of the request are ambiguous.
2. Show the two or three closest options.
3. Ask for the smallest missing decision.
4. Avoid repository edits until the operation is selected.
