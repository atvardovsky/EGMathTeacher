# EGMathTeacher Bridge Capability Matrix

This matrix records supported assistant bridge files and intentionally skipped
surfaces.

## Supported Assistant Surfaces

### Assistant Surface: `generic`

Assistant: `Generic assistant`
Surface id: `generic`
Bridge paths:

- `AI_ASSISTANTS.md`

Auto-load behavior: unknown; generic assistants may need the file referenced
by the user.
Instruction priority: depends on the assistant surface.
Supported rule/prompt/skill surfaces: canonical Markdown adapter files under
`.ai`, plus root bridge files.
Tool permission model: unknown; governed by the active assistant runtime.
Routes operation help: yes, via `AI_ASSISTANTS.md` to `.ai/assistant/help.md`.
Routes `alatyr-ai-inventory`: yes.
Routes `alatyr-adaptation`: yes.
Routes `alatyr-add-ai`: yes.
Known limitations: generic assistants may not auto-load the bridge.
Conformance check: manual bridge reference review.

### Assistant Surface: `agents`

Assistant: `AGENTS-aware assistant`
Surface id: `agents`
Bridge paths:

- `AGENTS.md`

Auto-load behavior: AGENTS-aware tools are expected to read `AGENTS.md` for
the repository.
Instruction priority: root `AGENTS.md` points to canonical `.ai` files.
Supported rule/prompt/skill surfaces: `.ai/framework`, `.ai/project`,
`.ai/assistant`, and root bridge files.
Tool permission model: depends on the active assistant runtime.
Routes operation help: yes.
Routes `alatyr-ai-inventory`: yes.
Routes `alatyr-adaptation`: yes.
Routes `alatyr-add-ai`: yes.
Known limitations: tool permissions are runtime-specific, not defined by
Alatyr.
Conformance check: manual bridge reference review.

### Assistant Surface: `codex`

Assistant: `Codex`
Surface id: `codex`
Bridge paths:

- `AGENTS.md`
- `AI_ASSISTANTS.md`

Auto-load behavior: Codex receives `AGENTS.md` instructions for this
repository in supported environments.
Instruction priority: system/developer instructions remain higher priority;
`AGENTS.md` routes repository-specific Alatyr behavior.
Supported rule/prompt/skill surfaces: Markdown adapter files; Codex skills are
session-provided and not installed in this repo.
Tool permission model: runtime-configured; adapter gates still apply.
Routes operation help: yes.
Routes `alatyr-ai-inventory`: yes.
Routes `alatyr-adaptation`: yes.
Routes `alatyr-add-ai`: yes.
Known limitations: no target-owned Codex skill wrappers are installed.
Conformance check: manual bridge reference review.

### Assistant Surface: `claude`

Assistant: `Claude`
Surface id: `claude`
Bridge paths:

- `CLAUDE.md`

Auto-load behavior: unsupported in this adapter.
Instruction priority: not applicable.
Supported rule/prompt/skill surfaces: not installed.
Tool permission model: not recorded.
Routes operation help: no bridge file installed.
Routes `alatyr-ai-inventory`: no bridge file installed.
Routes `alatyr-adaptation`: no bridge file installed.
Routes `alatyr-add-ai`: no bridge file installed.
Known limitations: add only when the project starts using Claude.
Conformance check: skipped; unsupported surface.

### Assistant Surface: `gemini`

Assistant: `Gemini`
Surface id: `gemini`
Bridge paths:

- `GEMINI.md`

Auto-load behavior: unsupported in this adapter.
Instruction priority: not applicable.
Supported rule/prompt/skill surfaces: not installed.
Tool permission model: not recorded.
Routes operation help: no bridge file installed.
Routes `alatyr-ai-inventory`: no bridge file installed.
Routes `alatyr-adaptation`: no bridge file installed.
Routes `alatyr-add-ai`: no bridge file installed.
Known limitations: add only when the project starts using Gemini.
Conformance check: skipped; unsupported surface.

### Assistant Surface: `github-copilot`

Assistant: `GitHub Copilot`
Surface id: `github-copilot`
Bridge paths:

- `.github/copilot-instructions.md`
- `.github/prompts/gate-review.prompt.md`

Auto-load behavior: unsupported in this adapter.
Instruction priority: not applicable.
Supported rule/prompt/skill surfaces: not installed.
Tool permission model: not recorded.
Routes operation help: no bridge file installed.
Routes `alatyr-ai-inventory`: no bridge file installed.
Routes `alatyr-adaptation`: no bridge file installed.
Routes `alatyr-add-ai`: no bridge file installed.
Known limitations: add only when the project starts using GitHub Copilot
instructions.
Conformance check: skipped; unsupported surface.

### Assistant Surface: `cursor`

Assistant: `Cursor`
Surface id: `cursor`
Bridge paths:

- `.cursor/rules/alatyr-core.mdc`
- `.cursorrules`

Auto-load behavior: unsupported in this adapter.
Instruction priority: not applicable.
Supported rule/prompt/skill surfaces: not installed.
Tool permission model: not recorded.
Routes operation help: no bridge file installed.
Routes `alatyr-ai-inventory`: no bridge file installed.
Routes `alatyr-adaptation`: no bridge file installed.
Routes `alatyr-add-ai`: no bridge file installed.
Known limitations: add only when the project starts using Cursor.
Conformance check: skipped; unsupported surface.

### Assistant Surface: `devin-cascade`

Assistant: `Devin/Cascade`
Surface id: `devin-cascade`
Bridge paths:

- `.devin/rules/alatyr-core.md`

Auto-load behavior: unsupported in this adapter.
Instruction priority: not applicable.
Supported rule/prompt/skill surfaces: not installed.
Tool permission model: not recorded.
Routes operation help: no bridge file installed.
Routes `alatyr-ai-inventory`: no bridge file installed.
Routes `alatyr-adaptation`: no bridge file installed.
Routes `alatyr-add-ai`: no bridge file installed.
Known limitations: add only when the project starts using Devin or Cascade.
Conformance check: skipped; unsupported surface.

### Assistant Surface: `windsurf`

Assistant: `Windsurf`
Surface id: `windsurf`
Bridge paths:

- `.windsurf/rules/alatyr-core.md`
- `.windsurfrules`

Auto-load behavior: unsupported in this adapter.
Instruction priority: not applicable.
Supported rule/prompt/skill surfaces: not installed.
Tool permission model: not recorded.
Routes operation help: no bridge file installed.
Routes `alatyr-ai-inventory`: no bridge file installed.
Routes `alatyr-adaptation`: no bridge file installed.
Routes `alatyr-add-ai`: no bridge file installed.
Known limitations: add only when the project starts using Windsurf.
Conformance check: skipped; unsupported surface.

## Canonical Entry Points

Every supported bridge should point back to:

- `AGENTS.md`
- `AI_ASSISTANTS.md`
- `.ai/alatyr.yaml`
- `.ai/README.md`
- `.ai/assistant/context-router.json`
- `.ai/assistant/ai-infrastructure-router.json`
- `.ai/assistant/context-profiles.md`
- `.ai/assistant/help.md`
- `.ai/assistant/help-reference.md`
- `.ai/assistant/flows/operation-routing.flow.md`

## Recheck Steps

1. Verify each supported bridge file exists or is intentionally skipped.
2. Verify each bridge stays short and points to canonical target files.
3. Verify aliases route to canonical operation flows.
4. Verify assistant-specific limitations are recorded.
5. Report unsupported or manual-load-only surfaces as residual risk.
