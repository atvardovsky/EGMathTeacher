# Approval Record

Approval ID: `ALATYR-20260715-webrtc-usage-smoke`
Operation ID: `webrtc-usage-smoke-20260715`
Operation type: `runtime-data-ui-validation-repair`
Evidence classification: `historical-record`
Plan version: `2026-07-15-webrtc-usage-smoke-v1`
Plan hash: `not available; approval was given as a direct implementation request`
Approved plan file: `not available; user requested implementation in active chat`
Approved diff base: `e38b34fd98d8e6a5ceda8438bd9699b0cc8c4ff1`
Patch hash: `not available before final patch; local validation evidence recorded below`
Requested by: `programmer`
Approved by: `programmer`
Approved at: `2026-07-15T15:06:00+02:00`
Repository revision at approval: `e38b34fd98d8e6a5ceda8438bd9699b0cc8c4ff1`
Approval source/message: `User provided review findings for the WebRTC preview and requested "implement all" in the active chat.`
Expires at or reuse policy: `single operation only`
Scope invalidation rule: `Live OpenAI validation, production deployment, new provider, new dependency, auth guard weakening, transcript persistence into tutor_turns, system web server changes, or destructive data operations require fresh approval.`
Machine-readable record: `.ai/assistant/approvals/ALATYR-20260715-webrtc-usage-smoke.json`

## Approved Scope

Allowed protected changes:

- Keep WebRTC Realtime documented as a preview path, not a durable lesson pipeline.
- Add authenticated session-level Realtime usage accounting to the local `ai_usage_ledger`.
- Add safe metadata/duration fields for session-level usage observability.
- Add a guarded manual live OpenAI Realtime smoke command that skips without explicit opt-in.
- Update mocked tests, E2E request expectations, public docs, Alatyr project docs, diagrams, and validation notes.

Allowed files or surfaces:

- `apps/api/src/ai-model`
- `apps/api/src/config`
- `apps/api/src/conversation`
- `apps/api/src/database`
- `apps/api/src/usage`
- `apps/api/src/webrtc`
- `apps/api/test`
- `apps/api/.env.example`
- `apps/api/README.md`
- `apps/api/docs/webrtc-module.md`
- `apps/web/src`
- `apps/web/e2e`
- `scripts`
- `package.json`
- `README.md`
- `.ai/project`
- `.ai/assistant/approvals`

Excluded actions:

- No live OpenAI Realtime call during validation unless separately approved.
- No production deployment, PM2, certificate, Apache, reverse proxy, or system web server changes.
- No new npm dependency or provider integration.
- No auth guard weakening for `/webrtc`.
- No durable tutor-turn persistence from realtime transcripts in this operation.
- No destructive production database operation.

Excluded files or surfaces:

- System web server configuration.
- Production secrets and local machine credentials.

Allowed actions mode:
`code-and-tests`

## Plan Evidence

Approved plan summary:

```text
Repair the WebRTC preview review findings by adding safe usage accounting for
authenticated Realtime sessions, preserving the preview-vs-lesson boundary,
adding a guarded manual live smoke command, and syncing code/tests/docs/diagrams.
Realtime close may write a session-level ledger row with token counts when
provider events supply usage and duration metadata otherwise; it must not turn
Realtime transcripts into tutor_turns or progress evidence in this operation.
```

Approved validation or manual review:

- User direct implementation request in active chat.
- Alatyr context-router bootstrap for architecture/API/web/data/security-sensitive scope.
- Manual logical integrity review against `.ai/project/blueprint.md`,
  `.ai/project/runtime-flows.md`, `.ai/project/architecture.md`,
  `.ai/project/data-model.md`, `.ai/project/gaps.md`,
  `.ai/project/validation.md`, `README.md`, and `apps/api/docs/webrtc-module.md`.

## Use Result

Used by operation/change: `webrtc-usage-smoke-20260715`
Patch changed after approval: `yes; final focused review wrapped usage-ledger storage so WebRTC close remains successful if accounting fails`
Implementation stayed within approved scope: `yes`
Validation run: `2026-07-15T15:25:00+02:00: npm run test --workspace @egmathteacher/api -- usage.service.spec.ts webrtc.controller.spec.ts; npm run build; npm run lint; npm test; npm run e2e; npx playwright test apps/web/e2e/app.spec.ts -g "student can start and stop realtime WebRTC voice preview"; npm run e2e; npm run diagrams:render; npm run diagrams:check; npm run alatyr:check; npm run smoke:realtime; git diff --check; npm run smoke:dev; local-path/secret-pattern scan`
Result/evidence: `targeted usage/WebRTC tests passed 2 suites / 16 tests before final close-path hardening; full build passed with existing Vite chunk-size warning; lint passed; full Jest passed 17 suites / 124 tests with existing worker-teardown warning; first two full E2E runs each had one initial-loading flake in different tests, isolated Realtime E2E passed 1 test, warmed full E2E then passed 9 tests; diagrams rendered 10 SVGs and drift check passed; Alatyr consistency passed; realtime smoke command skipped safely without REALTIME_SMOKE_LIVE=true; whitespace check passed; dev smoke passed for https://localhost:5137; stricter local-path/secret scan found no matches; final controller-focused test passed 1 suite / 7 tests and final build/lint passed after close-path hardening`
Residual risk: `Realtime preview is still not a durable lesson path; live OpenAI Realtime behavior and provider billing reconciliation remain manual/explicit checks; local Playwright parallel startup showed intermittent loading-screen flakes before a warmed full pass.`
