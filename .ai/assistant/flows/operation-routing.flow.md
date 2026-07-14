# Operation Routing Flow

Use this flow when the programmer asks for Alatyr help, asks for available
actions, asks for commands, or gives a request that cannot be safely
classified.

Also use this flow when the programmer uses a target alias such as
`alatyr-ai-inventory`, `alatyr-adaptation <source>`, or
`alatyr-add-ai <source>`.

## Target Sources

- Context router: `.ai/assistant/context-router.json`
- AI infrastructure router: `.ai/assistant/ai-infrastructure-router.json`
- Context profiles: `.ai/assistant/context-profiles.md`
- Operation help: `.ai/assistant/help.md`
- Full reference: `.ai/assistant/help-reference.md`
- Installed operations guidance: `.ai/framework/installed-operations.md`
- Operation help guidance: `.ai/framework/operation-help.md`
- Project source of truth: `.ai/project/README.md` and
  `.ai/project/source-of-truth-registry.md`
- Target validation: `.ai/project/validation.md`
- Approval constraints: `.ai/assistant/gates/checklist.md`
- AI infrastructure source-access policy:
  `.ai/assistant/policies/ai-infrastructure-source-access.md`

## Steps

1. Treat `AGENTS.md` as host-preloaded when available, then load compact
   bootstrap only: `.ai/alatyr.yaml`, `.ai/README.md`,
   `.ai/assistant/context-router.json`, and `.ai/assistant/help.md`.
2. Select the smallest matching context profile from
   `.ai/assistant/context-router.json`; use
   `.ai/assistant/context-profiles.md` for the human rationale or when router
   and Markdown evidence conflict.
3. Load only the selected profile's required framework, project, assistant,
   flow, gate, policy, and validation context before editing. Apply router
   project-area overlays and task-scale overlays when they apply. Do not load
   all `.ai/framework` or `.ai/project` files just to route an operation.
4. Restate the request in concrete language.
5. Classify the request as framework-core, project, repository adapter,
   bridge, generated-artifact, skill/prompt, or unclear work.
6. Normalize documented operation aliases from `.ai/assistant/help.md`.
7. Record allowed actions when the request supplies them:
   `read-only`, `docs-only`, `adapter-only`, `code-and-tests`, or
   `full-with-approval`.
8. Match the request to one target operation and flow when the intent is clear.
9. If two or more operations could apply, show the closest options with short
   descriptions and ask for the smallest missing decision.
10. If the request matches `alatyr-ai-inventory`, classify it as
   `ai-infrastructure-inventory` and continue with
   `.ai/assistant/ai-infrastructure-router.json` route `inventory`, then
   `.ai/assistant/flows/ai-infrastructure-inventory.flow.md`.
11. If the request matches `alatyr-adaptation <source>` or
   `alatyr-add-ai <source>`, classify it as `skill-adaptation`, record
   `<source>` as untrusted input, and continue with
   `.ai/assistant/ai-infrastructure-router.json` route `adapt-import`, then
   `.ai/assistant/flows/skill-adaptation.flow.md` only after checking
   inventory, source access, provenance, approval, and safety rules.
12. If the user asks for commands, explain that Alatyr uses assistant requests
    over Markdown adapter files; this project has validation commands but no
    universal `alatyr` executable.
13. Do not edit files while the operation is still ambiguous or when the
    requested edit exceeds allowed actions.
14. When the operation is selected, continue with the matching flow and apply
    allowed-action, approval, validation, and final-evidence rules.

## Final Evidence

Report:

- requested action
- matched operation or unresolved operation
- matching flow or missing adapter fact
- reason for the selected operation
- missing input or ambiguity, if any
- allowed actions and whether the selected flow stays within them
- next safe action

## Rejection Criteria

Reject or revise routing work that:

- invents an `alatyr` CLI command
- starts repository edits before the operation is selected
- chooses a protected operation without naming approval constraints
- ignores `.ai/assistant/help.md`
- claims target validation exists without target evidence
