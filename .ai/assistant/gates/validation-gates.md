# Validation Gates

Use target commands only. Do not invent CI, E2E, diagram render, or live smoke
checks.

## Commands

- Build all workspaces: `npm run build`
- API tests: `npm test`
- API lint: `npm run lint`
- Browser E2E: `npm run e2e`
- Diagram render: `npm run diagrams:render`
- Diagram drift check: `npm run diagrams:check`
- Dev smoke when runtime routing changes: `npm run dev`, then check the
  affected URL and `/health`, or run `npm run smoke:dev` against an already
  running dev stack
- Adapter consistency: `npm run alatyr:check`

## Selection

- Docs-only `.ai` or README edits: manual source-doc scan is enough unless
  the docs claim changed command/runtime behavior.
- Framework update or adapter-only Alatyr changes: manual file existence,
  reference, placeholder, and source-doc review is enough unless runtime,
  package, command, diagram source, or code behavior changed.
- API behavior changes: run build, tests, and lint.
- Web behavior changes: run build and `npm run e2e` when the affected
  workflow is covered; manually/browser-smoke uncovered UI.
- Diagram source changes: run `npm run diagrams:render`.
- Rendered diagram consistency checks: run `npm run diagrams:check`.
- Adapter instruction, bridge, validation, CI, CODEOWNERS, or gap-state
  changes: run `npm run alatyr:check`.
- Auth, data, OpenAI, WebRTC, or deployment-affecting changes: run target
  validation and report any missing coverage.
- Live OpenAI validation: only with explicit user approval.

## Skipped Checks

Report skipped checks and the reason. Current known missing checks:

- CI
- frontend unit/component tests
- accessibility checks
- visual regression checks
- production migration rollback/backfill checks
- live OpenAI smoke-test policy
