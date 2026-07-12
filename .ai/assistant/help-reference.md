# EGMathTeacher Alatyr Help Reference

The short default help lives in `.ai/assistant/help.md`.

Alatyr is used here through assistant requests over the installed Markdown
adapter. It is not a universal CLI command. This repository has validation
commands such as `npm run build`, but it does not define an executable
`alatyr` command.

These aliases are chat/request shortcuts, not shell commands.

## Supported Request Aliases

- `alatyr-ai-inventory`: route to `ai-infrastructure-inventory` and report
  existing AI instructions, prompts, skills, rules, wrappers, bridges, MCP/tool
  configs, gates, checkers, and generated assistant artifacts.
- `alatyr-adaptation <source>`: route to `skill-adaptation` using `<source>`
  as a local path, Git URL, HTTPS URL, assistant-native skill or prompt
  reference, pasted content, package/plugin reference, or other approved source
  form.
- `alatyr-add-ai <source>`: route to `skill-adaptation` with integration intent
  after inventory, provenance, safety, prompt-injection, and approval checks.

## Operation Menu

Operation: `help`
Use when: the user asks what Alatyr can do or the request is unclear.
Flow: `.ai/assistant/flows/operation-routing.flow.md`
Minimum input: goal or suspected task area.

Operation: `create-project-blueprint`
Use when: creating, repairing, or rechecking blueprint-equivalent
source-of-truth docs from target evidence.
Flow: `.ai/assistant/flows/project-blueprint-creation.flow.md`
Minimum input: blueprint scope and non-goals.

Operation: `recheck-after-installation`
Use when: verifying the installed adapter after initial installation.
Flow: `.ai/assistant/flows/adapter-recheck.flow.md`
Minimum input: installation note or known gaps.

Operation: `recheck-after-framework-update`
Use when: checking whether an Alatyr Core update requires target adapter
migration.
Flow: `.ai/assistant/flows/adapter-recheck.flow.md`
Minimum input: update source or changed framework baseline.

Operation: `product-change`
Use when: changing accepted project behavior, architecture, data, runtime, or
public contract.
Flow: `.ai/assistant/flows/blueprint-driven-change.flow.md`
Minimum input: change intent, non-goals, and approval constraints.

Operation: `logical-integrity-review`
Use when: reviewing whether code, docs, tests, diagrams, prompts, skills,
gates, and bridges agree.
Flow: `.ai/assistant/flows/logical-integrity-review.flow.md`
Minimum input: changed fact, suspected drift, or files to inspect.

Operation: `ai-infrastructure-inventory`
Use when: checking what AI infrastructure already exists and what can be kept,
adapted, added, removed, or left unresolved.
Flow: `.ai/assistant/flows/ai-infrastructure-inventory.flow.md`
Minimum input: inventory scope and target assistant surfaces.
Alias: `alatyr-ai-inventory`.

Operation: `skill-adaptation`
Use when: importing, adapting, adding, or reviewing skills, prompts, wrappers,
bridges, rules, MCP/tool configs, gates, checkers, or third-party assistant
infrastructure.
Flow: `.ai/assistant/flows/skill-adaptation.flow.md`
Minimum input: source, item type, source type, intended use, target assistant
surfaces, and permissions.
Aliases: `alatyr-adaptation <source>`, `alatyr-add-ai <source>`.

Operation: `drift-review`
Use when: finding stale source-of-truth, docs, diagrams, gates, prompts,
skills, or bridge files.
Flow: `.ai/assistant/flows/logical-integrity-review.flow.md`
Minimum input: drift area or recently changed facts.

Operation: `documentation-sync`
Use when: syncing docs, diagrams, prompts, gates, skills, or bridge files
after a fact changed.
Flow: `.ai/assistant/flows/documentation-sync.flow.md`
Minimum input: changed fact and owning source.

Operation: `adapter-maturity-review`
Use when: reporting whether the adapter is incomplete, minimal, usable, or
mature for a requested task.
Flow: `.ai/assistant/flows/adapter-recheck.flow.md`
Minimum input: task scope and maturity concern.

## Operation Type Aliases

Alias: `Alatyr help`
Route to: `help`.

Alias: `update Alatyr` or `обнови Alatyr`
Route to: `recheck-after-framework-update` when a framework update source is
known. If no update context is known, show `help` and ask for the update
source or intended recheck scope.

Alias: `check Alatyr` or `проверь Alatyr`
Route to: `recheck-after-installation` after initial installation, or
`adapter-maturity-review` when the request is a broader adapter readiness
review.

Alias: `create blueprint` or `создай blueprint`
Route to: `create-project-blueprint`.

Alias: `check integrity` or `проверь целостность`
Route to: `logical-integrity-review`.

Alias: `change business rule` or `измени бизнес-правило`
Route to: `product-change`.

## Request Shape

Use this shape when asking for an operation:

```text
Use the installed Alatyr adapter in this repository.

Operation type: <operation>
Goal:
Non-goals:
Known context:
Allowed actions: <read-only | docs-only | adapter-only | code-and-tests | full-with-approval>
Expected final evidence:
```

Allowed actions guide:

- `read-only`: inspect target files and report only; no file changes.
- `docs-only`: docs, blueprint-equivalent docs, and diagram sources only; no
  code changes.
- `adapter-only`: adapter-owned `.ai/*` surfaces, especially
  `.ai/assistant`, bridge files, assistant templates, gates, flows, policies,
  and checker rules only; no product code or accepted project facts.
- `code-and-tests`: code, tests, and required docs/diagram sync; no live
  external actions, destructive actions, production dependencies, or broader
  permissions.
- `full-with-approval`: protected changes require explicit programmer
  approval before they are made.

AI infrastructure inventory shorthand:

```text
alatyr-ai-inventory

Goal:
Inventory scope:
Target assistant surfaces:
```

AI infrastructure adaptation shorthand:

```text
alatyr-adaptation <source>

Goal:
Non-goals:
Item type:
Source type:
Target assistant surfaces:
Integration mode: review-only or canonical integration
```

AI infrastructure add shorthand:

```text
alatyr-add-ai <source>

Goal:
Non-goals:
Item type:
Source type:
Target assistant surfaces:
Integration mode: canonical integration
```

## Target Notes

- Supported assistants: Codex, AGENTS-aware assistants, and generic Markdown
  assistants through `AGENTS.md` and `AI_ASSISTANTS.md`.
- Target validation: `npm run build`, `npm test`, `npm run lint`,
  `npm run e2e`, `npm run diagrams:render`, `npm run diagrams:check`,
  `npm run smoke:dev` against a running dev stack, `npm run alatyr:check`,
  and manual adapter review when docs-only.
- Context routing: `.ai/assistant/context-router.json` is the
  machine-readable companion to `.ai/assistant/context-profiles.md`.
- Approval constraints: `.ai/assistant/gates/checklist.md` and focused gate
  files under `.ai/assistant/gates`.
- AI infrastructure source access policy:
  `.ai/assistant/policies/ai-infrastructure-source-access.md`.
- Prompt-injection policy: `.ai/assistant/policies/prompt-injection.md`.
- Known adapter gaps: no formal production privacy or incident policy, no
  frontend component/accessibility/visual regression command, POC-only auth
  hardening, and no production backup/restore/rollback runbooks.
