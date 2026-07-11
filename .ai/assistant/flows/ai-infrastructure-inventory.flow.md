# AI Infrastructure Inventory Flow

Use this flow when the programmer asks what AI assistant infrastructure
already exists, asks what can be added, or uses `alatyr-ai-inventory`.

Inventory-only work must not import external infrastructure into canonical
files.

## Target Sources

- Canonical assistant instructions: `AGENTS.md`, `AI_ASSISTANTS.md`,
  `.ai/README.md`
- Framework guidance: `.ai/framework/skill-adaptation.md`,
  `.ai/framework/operation-help.md`, `.ai/framework/prompt-injection.md`
- Target assistant contour: `.ai/assistant/contour.md`
- Target gates: `.ai/assistant/gates/checklist.md`
- AI infrastructure source-access policy:
  `.ai/assistant/policies/ai-infrastructure-source-access.md`
- Prompt-injection policy: `.ai/assistant/policies/prompt-injection.md`
- Inventory report template:
  `.ai/assistant/templates/ai-infrastructure-inventory.md`
- Target validation: `.ai/project/validation.md`

## Items To Inspect

- `AGENTS.md`
- `AI_ASSISTANTS.md`
- `apps/api/Agent.md`
- `.ai`
- `.agents`, `.claude`, `.cursor`, `.github`, `.devin`, `.windsurf` paths
  when present
- prompt, skill, bridge, rule, memory, MCP/tool, checker, and template files
  when present
- provenance, source/access, approval, safety, and lifecycle notes
- source hash, commit, version, license, and prompt-injection notes when known

## Steps

1. Load `AGENTS.md`, `AI_ASSISTANTS.md`, `.ai/README.md`, `.ai/framework`,
   `.ai/project`, and `.ai/assistant`.
2. Read `.ai/assistant/policies/ai-infrastructure-source-access.md` and
   `.ai/assistant/policies/prompt-injection.md`.
3. Inspect known assistant surfaces for AGENTS-aware, Codex, and generic
   assistant usage.
4. Classify each found item as framework, project, repository adapter, bridge,
   generated artifact, external assistant infrastructure, or unknown.
5. Record item type, path or reference, owner, source/provenance, license or
   unknown-license status, source hash or commit when known, permission
   surface, supported assistants, and validation or manual review status.
6. Identify overlaps, duplicate policy, stale bridge files, unsafe permissions,
   missing provenance, and missing adapter facts.
7. Report which items are already usable, need adaptation, need approval, need
   removal, or should stay unresolved.
8. Record reusable inventory evidence with
   `.ai/assistant/templates/ai-infrastructure-inventory.md` when the target
   adapter wants durable inventory records.
9. If the programmer asks to add an item, route to
   `.ai/assistant/flows/skill-adaptation.flow.md` with the inventory result as
   context.
10. Do not import or normalize external infrastructure during inventory-only
    work.

## Final Evidence

Report:

- surfaces inspected
- items found
- classification and owner for each item
- provenance and source/access status
- source hash or commit and license status when known
- prompt-injection risk notes
- permission, live-service, destructive-operation, dependency, or credential
  surface
- conflicts, duplicates, or stale items
- recommended add/adapt/remove/skip actions
- validation or manual checks run
- approvals needed
- residual risk
