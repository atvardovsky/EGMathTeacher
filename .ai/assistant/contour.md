# EGMathTeacher Assistant Adapter Contour

This contour defines repository-adapter-owned facts for AI-assisted work on
EGMathTeacher.

## Owns

The assistant adapter owns:

- Mandatory context loading for future assistant sessions.
- Adapter manifest facts under `.ai/alatyr.yaml`.
- Context profiles under `.ai/assistant/context-profiles.md`.
- Machine-readable context router under
  `.ai/assistant/context-router.json`.
- Machine-readable AI infrastructure router under
  `.ai/assistant/ai-infrastructure-router.json`.
- Required-core and optional module state under
  `.ai/assistant/module-profile.md`.
- Task-specific maturity under `.ai/assistant/maturity-profile.md`.
- Bridge capability matrix under `.ai/assistant/bridge-capability-matrix.md`.
- Operation help and routing for Alatyr-style requests.
- Local approval gates, focused gate docs, and final evidence format.
- Approval records under `.ai/assistant/approvals`.
- Target validation command list and skipped-check reporting.
- Current assistant infrastructure index, inventory, and source-access policy.
- Prompt-injection policy for imported or untrusted AI infrastructure.
- Flow documents for blueprint-driven change, logical integrity review,
  adapter recheck, documentation sync, blueprint creation, AI infrastructure
  inventory, and skill adaptation.
- Migration notes under `.ai/assistant/templates/migration-note.md`.
- Large-task orchestration flow and packet template for cross-boundary or
  resumable work.
- Post-install and post-update assistant message templates.
- Root bridge files that point future assistants to canonical adapter files.

## Does Not Own

The assistant adapter does not own:

- Product behavior or accepted domain rules.
- Runtime architecture changes.
- Secrets, credentials, or production infrastructure state.
- Portable framework rules under `.ai/framework`.
- Generated build files, local databases, logs, node modules, or certificates.

## Supported Assistant Surfaces

- Root `AGENTS.md` for Codex/AGENTS-aware tools.
- Root `AI_ASSISTANTS.md` as a generic assistant entry point.

No Claude, Gemini, Cursor, GitHub Copilot, Devin, Cascade, or Windsurf bridge
files are installed because the repository does not currently show a need for
them. `.ai/assistant/bridge-capability-matrix.md` records these surfaces as
unsupported/deferred.

## Adapter Maturity

Current maturity: usable for focused implementation and documentation work.

Maturity gaps:

- CI configuration exists under `.github/workflows/ci.yml`, but no remote CI
  run was observed from this local workspace.
- Mocked browser E2E exists as `npm run e2e`.
- Local Alatyr consistency checker exists as `npm run alatyr:check`.
- CODEOWNERS exists at `.github/CODEOWNERS`.
- Project diagram sources, render command, drift-check command, and rendered
  SVG artifacts exist under `.ai/project`.
- Baseline project security/safety docs exist under `.ai/project`; no formal
  production privacy policy or incident procedure exists.
- POC SQLite migration ledger exists; production backup, restore, rollback,
  and incident runbooks remain undefined.
