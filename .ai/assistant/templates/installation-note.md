# Alatyr Installation Note

Installation id: `ALATYR-20260709-egmathteacher`

Framework source:

- Git URL: `https://github.com/atvardovsky/AlatyrCore`
- Alatyr source inspected: `https://github.com/atvardovsky/AlatyrCore`
- Initial baseline commit: `17cf62e Route future sessions through installed adapter state`
- Previous baseline commit: `6a6bef1 Add machine-readable context routing`
- Previous baseline commit: `4654732 Add installed adapter validator`
- Current baseline commit: `8dab3d1 Add controlled effectiveness cost benchmarks`
- Framework version: `0.1.0-alpha.0`
- Adapter schema version: `1`
- Template version: `2`
- Installed date: 2026-07-09
- Updated date: 2026-07-14

## Installed Surfaces

- Adapter manifest: `.ai/alatyr.yaml`
- Portable framework: `.ai/framework/*.md`
- Project contour: `.ai/project/contour.md`
- Project blueprint: `.ai/project/blueprint.md`
- Project source-of-truth set: `.ai/project/README.md`,
  `.ai/project/context-map.md`, `.ai/project/use-cases.md`,
  `.ai/project/architecture.md`, `.ai/project/runtime-flows.md`,
  `.ai/project/data-model.md`, `.ai/project/validation.md`,
  `.ai/project/security-safety.md`, `.ai/project/guards.md`,
  `.ai/project/diagrams.md`, `.ai/project/source-of-truth-registry.md`
- Assistant adapter: `.ai/assistant`
- Context profiles: `.ai/assistant/context-profiles.md`
- Context router: `.ai/assistant/context-router.json`
- AI infrastructure router: `.ai/assistant/ai-infrastructure-router.json`
- Module profile: `.ai/assistant/module-profile.md`
- Maturity profile: `.ai/assistant/maturity-profile.md`
- Bridge capability matrix: `.ai/assistant/bridge-capability-matrix.md`
- Prompt-injection policy: `.ai/assistant/policies/prompt-injection.md`
- Approval record template: `.ai/assistant/approvals/approval-template.md`
- Migration, output-contract, inventory, and effectiveness templates under
  `.ai/assistant/templates`
- AI infrastructure adaptation record template:
  `.ai/assistant/templates/ai-infrastructure-adaptation-record.md`
- Large-task flow and packet template:
  `.ai/assistant/flows/large-task-orchestration.flow.md`,
  `.ai/assistant/templates/large-task-operation-packet.md`
- Focused gates: `.ai/assistant/gates/README.md` and
  `.ai/assistant/gates/*.md`
- Root bridge files: `AGENTS.md`, `AI_ASSISTANTS.md`

## Target Validation

Discovered commands:

- `npm run build`
- `npm test`
- `npm run lint`
- `npm run diagrams:render`
- `npm run diagrams:check`
- `npm run smoke:dev` against a running dev stack
- `npm run e2e`
- `npm run alatyr:check`

Mocked browser E2E exists through Playwright and headless Chromium.

## Approval

Initial installation was a fresh adapter-only installation. The 2026-07-11
framework update overwrote existing `.ai/framework`, `.ai/assistant`,
`AGENTS.md`, and `AI_ASSISTANTS.md` instruction surfaces only after explicit
programmer approval. The 2026-07-12 framework update added context-router
support and updated `.ai/framework`, `.ai/assistant`, `AGENTS.md`,
`AI_ASSISTANTS.md`, and `scripts/check-alatyr.sh` after the programmer asked to
update Alatyr. A later 2026-07-12 framework update refreshed the baseline to
`4654732`, added installed-adapter drift-check evidence requirements, and kept
target validation on `npm run alatyr:check`. The 2026-07-14 framework update
refreshed the baseline to `8dab3d1`, adopted template version 2 compact
routing, added AI infrastructure item routing, and enabled large-task
orchestration packet templates while deferring the optional consistency map.
These updates did not change
runtime code, runtime config, system web server config, live services, or
accepted product behavior.

## Current Gaps

- README still remains a public source that must be kept aligned when runtime
  URLs, deployment notes, or product behavior change.
- CI exists under `.github/workflows/ci.yml`, but a remote run may still need
  to be observed after changes are pushed.
- Local Alatyr consistency is checked with `npm run alatyr:check`.
- Source diagrams, rendered SVG artifacts, render command, and drift check
  exist under `.ai/project`.
- Baseline project security/safety boundaries exist under `.ai/project`; a
  formal production privacy policy and incident procedure are still missing.
- Frontend component, accessibility, and visual regression commands are still
  missing.
- POC auth hardening and production backup/restore/rollback runbooks remain
  unresolved.
- CODEOWNERS exists at `.github/CODEOWNERS`.

## Future Sessions

At the start of an Alatyr operation, read `.ai/alatyr.yaml`, this file,
`.ai/README.md`, and `.ai/assistant/context-router.json` first. Then follow
the selected profile, project-area overlay, and task-scale overlay. Read
`.ai/assistant/context-profiles.md`, `.ai/assistant/module-profile.md`,
`.ai/assistant/help.md`, and matching flows only when the router or evidence
requires them.
