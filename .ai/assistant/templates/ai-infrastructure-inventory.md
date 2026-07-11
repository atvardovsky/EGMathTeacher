# AI Infrastructure Inventory Template

Use this file to record the result of `ai-infrastructure-inventory` or
`alatyr-ai-inventory`.

Inventory-only work must not import, install, execute, or normalize external
AI infrastructure into canonical target files.

## Inventory Scope

- Operation id:
- Inventory date:
- Requested by:
- Allowed actions: `read-only` or `adapter-only`
- Target assistant surfaces:
- Source access policy:
  `.ai/assistant/policies/ai-infrastructure-source-access.md`
- Prompt-injection policy: `.ai/assistant/policies/prompt-injection.md`
- Surfaces inspected:
- Surfaces skipped and reason:
- Existing inventory source:

## Item Record

Repeat this block for each skill, prompt, wrapper, bridge file, rule, memory,
MCP/tool config, checker, flow, gate, template, generated assistant artifact,
or other target-defined AI infrastructure item.

- Item id:
- Item type:
  `skill | prompt | wrapper | bridge | rule | memory | MCP/tool | checker |
  flow | gate | template | generated artifact | other`
- Path or reference:
- Owner:
  `framework | project | repository adapter | bridge | generated | external |
  unknown`
- Source/provenance:
- Source type:
  `local path | Git URL | HTTPS URL | native reference | pasted | package |
  plugin | unknown`
- Source hash, commit, or version:
- License:
- Supported assistants:
- Permission surface:
- Prompt-injection risk:
- Safety surface:
- Overlap or conflict:
- Validation or manual review:
- Approval status:
- Recommended action:
  `keep | adapt | add | replace | remove | skip | unresolved`
- Residual risk:

## Summary

- Items found:
- Usable without change:
- Need adaptation:
- Need approval:
- Need removal or replacement:
- Left unresolved:
- Validation run:
- Approvals needed:
- Recommended next operation:
- Final evidence:
- Residual risk:
