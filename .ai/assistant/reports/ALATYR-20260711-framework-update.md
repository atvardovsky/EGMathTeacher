# Alatyr Framework Update Report

Operation ID: `ALATYR-20260711-framework-update`
Operation type: `recheck-after-framework-update`
Allowed actions: `adapter-only`
Prepared at: 2026-07-11

## Version Scope

- Previous installed baseline: `17cf62e Route future sessions through installed adapter state`
- New baseline: `f66f857ae9992501d055c662c0c963bb9de7578d`
- Framework version: `0.1.0-alpha.0`
- Adapter schema version: `1`
- Template version: `1`
- Source: `https://github.com/atvardovsky/AlatyrCore`

## Changed Facts

- Installed portable framework baseline moved from `17cf62e` to `f66f857`.
- Adapter now has `.ai/alatyr.yaml` for framework version, schema, template,
  supported assistants, modules, validation commands, gaps, and local
  deviations.
- Alatyr rule registry and canonical rule ids are installed under
  `.ai/framework`.
- Adapter context selection now uses `.ai/assistant/context-profiles.md` and
  `.ai/assistant/module-profile.md`.
- Project fact ownership now has `.ai/project/source-of-truth-registry.md`.
- AI infrastructure review now includes source-access and prompt-injection
  policies.
- Operation help is split into short `.ai/assistant/help.md` and full
  `.ai/assistant/help-reference.md`.
- Adapter has durable approval template/record, bridge capability matrix,
  migration note template, output contracts, and effectiveness template.
- Root bridge files route future sessions through the updated manifest/profile
  model.
- Assistant-governance diagram source and rendered SVG were updated.

## Added Framework Rules

- `ALATYR-CONTEXT-001`
- `ALATYR-SOURCE-001`
- `ALATYR-RISK-001`
- `ALATYR-APPROVAL-001`
- `ALATYR-SAFETY-001`
- `ALATYR-SAFETY-002`
- `ALATYR-INTEGRITY-001`
- `ALATYR-CHANGE-001`
- `ALATYR-ADAPTER-001`
- `ALATYR-MODULE-001`
- `ALATYR-BRIDGE-001`
- `ALATYR-LIFECYCLE-001`
- `ALATYR-EVIDENCE-001`

## Files Changed

Framework:

- `.ai/framework/*` synced from AlatyrCore `framework/`.

Root and manifest:

- `AGENTS.md`
- `AI_ASSISTANTS.md`
- `.ai/README.md`
- `.ai/alatyr.yaml`

Project docs and diagrams:

- `.ai/project/README.md`
- `.ai/project/blueprint.md`
- `.ai/project/context-map.md`
- `.ai/project/contour.md`
- `.ai/project/source-of-truth-registry.md`
- `.ai/project/diagrams/assistant-governance.mmd`
- `.ai/project/diagrams/rendered/*.svg`

Assistant adapter:

- `.ai/assistant/approvals/ALATYR-20260711-framework-update.md`
- `.ai/assistant/approvals/approval-template.md`
- `.ai/assistant/bridge-capability-matrix.md`
- `.ai/assistant/checklists/change-impact.md`
- `.ai/assistant/context-profiles.md`
- `.ai/assistant/contour.md`
- `.ai/assistant/flows/*`
- `.ai/assistant/gates/*`
- `.ai/assistant/help-reference.md`
- `.ai/assistant/help.md`
- `.ai/assistant/infrastructure-index.md`
- `.ai/assistant/maturity-profile.md`
- `.ai/assistant/module-profile.md`
- `.ai/assistant/policies/ai-infrastructure-source-access.md`
- `.ai/assistant/policies/prompt-injection.md`
- `.ai/assistant/templates/*`

## Local Deviations Preserved

- Only `AGENTS.md` and `AI_ASSISTANTS.md` are supported bridge files.
- Optional Claude, Gemini, Cursor, GitHub Copilot, Devin/Cascade, and
  Windsurf bridge files were not added.
- No CODEOWNERS file was added.
- Existing focused gates under `.ai/assistant/gates` were retained and updated
  instead of replaced by a single generic checklist.
- Existing `ai-infrastructure-adaptation.flow.md` was retained as a
  compatibility alias for `skill-adaptation.flow.md`.

## Logical Integrity Result

Source of truth:

- Portable framework rules: `.ai/framework`, synced from AlatyrCore.
- EGMathTeacher project facts: `.ai/project`, `README.md`, API docs, code, and
  tests.
- Adapter facts: `.ai/assistant`, `AGENTS.md`, `AI_ASSISTANTS.md`, and
  `.ai/alatyr.yaml`.

Conflicts found:

- The installed adapter was on the old `17cf62e` file set and lacked new
  source registry, manifest, context/module profiles, prompt-injection policy,
  bridge matrix, and output/migration templates.

Repair set:

- Synced framework core.
- Added and adapted target-owned adapter/project surfaces.
- Updated root bridge files.
- Updated assistant-governance diagram source and rendered artifacts.

Result:

- Adapter surfaces now reference the `f66f857` baseline and preserve
  EGMathTeacher product facts. No product runtime behavior changed.

## Approval And Safety

Approval used:

- `.ai/assistant/approvals/ALATYR-20260711-framework-update.md`

Safety:

- No product code was changed.
- No runtime config was changed.
- No system web server config was changed.
- No live external services were called.
- No new dependencies were added.
- No optional unsupported bridge files were added.

## Validation

Run:

- `diff -qr .ai/framework <ALATYR_SOURCE_CHECKOUT>/framework`
  returned no differences.
- `python3 -m json.tool .ai/framework/rule-registry.json` passed.
- Required adapter file existence check passed.
- Placeholder scan for current target-owned adapter files passed.
- `npm run diagrams:render` passed and rendered 8 diagrams.

Skipped:

- `npm run build`, `npm test`, and `npm run lint` were skipped because this was
  an adapter/documentation/diagram update with no product code changes.
- Live OpenAI validation was skipped because no live-service behavior changed.
- CI was not run because no CI configuration exists.

## Residual Risk

- No target-owned Alatyr consistency checker exists.
- No CI configuration exists.
- No automated diagram drift check exists.
- No browser E2E or frontend component tests exist.
- Historical reports still mention the old `17cf62e` baseline as historical
  evidence; this report supersedes them for current adapter state.
