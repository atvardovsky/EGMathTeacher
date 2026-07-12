# Alatyr Installation Note

Installation id: `ALATYR-20260709-egmathteacher`

Framework source:

- Git URL: `https://github.com/atvardovsky/AlatyrCore`
- Alatyr source inspected: `https://github.com/atvardovsky/AlatyrCore`
- Initial baseline commit: `17cf62e Route future sessions through installed adapter state`
- Previous baseline commit: `f66f857 Add conformance and effectiveness evidence`
- Current baseline commit: `6a6bef1 Add machine-readable context routing`
- Framework version: `0.1.0-alpha.0`
- Adapter schema version: `1`
- Template version: `1`
- Installed date: 2026-07-09
- Updated date: 2026-07-12

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
- Module profile: `.ai/assistant/module-profile.md`
- Maturity profile: `.ai/assistant/maturity-profile.md`
- Bridge capability matrix: `.ai/assistant/bridge-capability-matrix.md`
- Prompt-injection policy: `.ai/assistant/policies/prompt-injection.md`
- Approval record template: `.ai/assistant/approvals/approval-template.md`
- Migration, output-contract, inventory, and effectiveness templates under
  `.ai/assistant/templates`
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
update Alatyr. These updates did not change runtime code, runtime config,
system web server config, live services, or accepted product behavior.

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
`.ai/README.md`, `.ai/assistant/context-router.json`,
`.ai/assistant/context-profiles.md`,
`.ai/assistant/module-profile.md`, `.ai/assistant/help.md`, and the matching
flow under `.ai/assistant/flows`.
