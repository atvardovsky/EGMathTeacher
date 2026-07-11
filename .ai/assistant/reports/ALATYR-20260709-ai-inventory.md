# Alatyr AI Infrastructure Inventory

Operation: `alatyr-ai-inventory`

Date: 2026-07-09

Allowed actions used: `adapter-only`; inventory inspection was read-only and
the only file change was this adapter-owned report.

## Scope

Inventory existing AI infrastructure in the repository. Do not import or
normalize any external assistant infrastructure.

## Items Found

| Path | Item type | Owner | Source/provenance | Supported surfaces | Expected tools/services | Safety surface | Overlap/conflict | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `AGENTS.md` | Root assistant bridge | Bridge / adapter | Alatyr installation | Codex and AGENTS-aware tools | Reads `.ai` docs and target files; may run target validation commands when task requires | Can guide file edits and commands through assistant | No conflict; canonical bridge to `.ai` | Keep |
| `AI_ASSISTANTS.md` | Generic assistant bridge | Bridge / adapter | Alatyr installation | Generic AI assistants | Reads `AGENTS.md` and `.ai` docs | Same as assistant guidance | No conflict; short pointer | Keep |
| `apps/api/Agent.md` | Voice assistant persona/rules | Project fact / prompt-adjacent doc | Imported voiceAssistant base, adapted in repo | Runtime/provider prompt context for inherited voice assistant | OpenAI Realtime behavior, persona/env variables | Prompt behavior can affect live voice sessions when configured | Adjacent to Alatyr docs but not conflicting; project runtime fact | Keep and sync when voice persona changes |
| `.ai/framework/*.md` | Portable framework docs | Framework | AlatyrCore baseline `17cf62e` | All assistant sessions that follow adapter | Markdown guidance only | Can influence assistant behavior; no runtime service | No conflict | Keep; recheck after framework updates |
| `.ai/project/*.md` | Project source-of-truth docs | Project | Repository evidence | All assistant sessions | Markdown guidance only | Drift risk if product facts change | No conflict | Keep and sync with README/code |
| `.ai/assistant/flows/*.flow.md` | Assistant operation flows | Adapter | Alatyr installation | Alatyr operations | Markdown guidance; target commands only when relevant | Can guide edits and validation | No conflict | Keep |
| `.ai/assistant/gates/checklist.md` | Assistant gate checklist | Adapter | Alatyr installation | All assistant sessions | Target validation commands, approval gates | Security/approval guidance | No conflict | Keep |
| `.ai/assistant/policies/ai-infrastructure-source-access.md` | AI infrastructure source policy | Adapter | Alatyr installation | AI inventory/adaptation operations | Local reads; explicit source URLs when needed | Controls imports, permissions, live/destructive surfaces | No conflict | Keep and update after inventory changes |
| `.ai/assistant/templates/*.md` | Operation message/request templates | Adapter | Alatyr installation | Installed-operation requests | Markdown guidance only | Low; can shape future requests | No conflict | Keep |
| `.ai/assistant/reports/*.md` | Adapter reports | Adapter evidence | Local Alatyr operations | Assistant/adaptation review | Markdown evidence only | Low; stale-report risk | No conflict | Keep as historical evidence |

## Paths Checked And Not Found

- `.agents/skills`
- `.claude`
- `.cursor`
- `.github` prompt/rule files
- `.devin`
- `.windsurf`
- root `CLAUDE.md`
- root `GEMINI.md`
- assistant-specific skill wrappers
- MCP/tool configuration files
- project-specific Alatyr consistency checker

## Source Access Review

No external source was imported during this inventory. Future requests using
`alatyr-adaptation <source>` or `alatyr-add-ai <source>` must treat the source
as untrusted until `.ai/assistant/policies/ai-infrastructure-source-access.md`
has been applied.

## Recommendations

- Keep root bridge files short and pointing to `.ai`; do not duplicate full
  framework policy into them.
- Keep `apps/api/Agent.md` as project/runtime prompt documentation, not as an
  Alatyr policy file.
- Add a deterministic adapter checker only if repeated adapter drift becomes a
  real maintenance problem.
- Add assistant-specific bridge files only when the repository actually uses
  those assistant surfaces.

## Validation

Manual repository inventory was performed with generated output, node modules,
local SQLite data, and local certificates excluded from source-of-truth review.

## Residual Risk

- No CI enforces this inventory.
- Hidden global assistant settings outside the repository were not inventoried.
- Reports can become stale if new assistant infrastructure is added without
  updating this inventory or the source-access policy.
