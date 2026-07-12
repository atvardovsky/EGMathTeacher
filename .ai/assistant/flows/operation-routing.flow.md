# Operation Routing Flow

Use this flow when the programmer asks for Alatyr help, asks for available
actions, asks for commands, or gives a request that cannot be safely
classified.

Also use this flow when the programmer uses a target alias such as
`alatyr-ai-inventory`, `alatyr-adaptation <source>`, or
`alatyr-add-ai <source>`.

## Target Sources

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

1. Load `AGENTS.md`, `AI_ASSISTANTS.md`, `.ai/alatyr.yaml`, `.ai/README.md`,
   `.ai/assistant/context-router.json`,
   `.ai/assistant/context-profiles.md`, `.ai/project/contour.md`,
   `.ai/project/source-of-truth-registry.md`,
   `.ai/assistant/contour.md`, and `.ai/assistant/help.md`.
2. Restate the request in concrete language.
3. Classify the request as framework-core, project, repository adapter,
   bridge, generated-artifact, skill/prompt, or unclear work.
4. Use `.ai/assistant/context-router.json` as the canonical routing source
   for task profile selection. Use `.ai/assistant/context-profiles.md` only
   for human-readable rationale, conflicts, or missing router entries.
5. Normalize documented operation aliases from `.ai/assistant/help.md`.
6. Record allowed actions when the request supplies them:
   `read-only`, `docs-only`, `adapter-only`, `code-and-tests`, or
   `full-with-approval`.
7. Match the request to one target operation and flow when the intent is clear.
8. If two or more operations could apply, show the closest options with short
   descriptions and ask for the smallest missing decision.
9. If the request matches `alatyr-ai-inventory`, classify it as
   `ai-infrastructure-inventory` and continue with
   `.ai/assistant/flows/ai-infrastructure-inventory.flow.md`.
10. If the request matches `alatyr-adaptation <source>` or
   `alatyr-add-ai <source>`, classify it as `skill-adaptation`, record
   `<source>` as untrusted input, and continue with
   `.ai/assistant/flows/skill-adaptation.flow.md` only after checking
   inventory, source access, provenance, approval, and safety rules.
11. If the user asks for commands, explain that Alatyr uses assistant requests
    over Markdown adapter files; this project has validation commands but no
    universal `alatyr` executable.
12. Do not edit files while the operation is still ambiguous or when the
    requested edit exceeds allowed actions.
13. When the operation is selected, continue with the matching flow and apply
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
