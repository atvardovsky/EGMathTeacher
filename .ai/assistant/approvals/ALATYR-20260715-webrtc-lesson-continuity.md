# Approval Record

Approval ID: `ALATYR-20260715-webrtc-lesson-continuity`
Operation ID: `webrtc-lesson-continuity-20260715`
Operation type: `product-runtime-architecture-repair`
Evidence classification: `historical-record`
Plan version: `2026-07-15-webrtc-lesson-continuity-v1`
Plan hash: `not available; approval was given as a direct repair request`
Approved plan file: `not available; user requested implementation in active chat`
Approved diff base: `7149840`
Patch hash: `not available before final patch; validation evidence recorded below`
Requested by: `programmer`
Approved by: `programmer`
Approved at: `2026-07-15T15:19:29Z`
Repository revision at approval: `7149840`
Approval source/message: `User reported that lessons cannot continue after interruption and that WebRTC feels unused/slow, then asked to fix the current behavior.`
Expires at or reuse policy: `single operation only`
Scope invalidation rule: `Live provider validation, production deployment, new provider, new dependency, auth guard weakening, destructive data operations, system web server changes, or storing realtime transcripts as verifier/mastery evidence require fresh approval.`
Machine-readable record: `.ai/assistant/approvals/ALATYR-20260715-webrtc-lesson-continuity.json`

## Approved Scope

Allowed protected changes:

- Make authenticated WebRTC close create or reuse a lesson session when useful transcript content exists.
- Save one compact voice-origin `tutor_turns` row for realtime lesson continuity.
- Return synced lesson metadata and the synced turn to the browser on WebRTC close.
- Update lesson runtime accounting for realtime duration/turn count without creating verifier attempts or mastery evidence.
- Update WebRTC assistant default wording so it no longer says realtime is detached from lesson records.
- Keep realtime outside the verified lesson engine: no realtime verifier attempts, mastery evidence, images, or structured task/example/image blocks.
- Synchronize tests, public docs, Alatyr docs, diagrams, UI copy, and approval evidence.

Allowed files or surfaces:

- `apps/api/src/config`
- `apps/api/src/openai`
- `apps/api/src/providers`
- `apps/api/src/lesson`
- `apps/api/src/tutor`
- `apps/api/src/webrtc`
- `apps/api/test`
- `apps/api/.env.example`
- `apps/api/README.md`
- `apps/api/docs/webrtc-module.md`
- `apps/web/src`
- `apps/web/e2e`
- `README.md`
- `.ai/project`
- `.ai/assistant/approvals`

Excluded actions:

- No live OpenAI or external provider validation for this repair.
- No production deployment, PM2, certificate, Apache, reverse proxy, or system web server changes.
- No new npm dependency or provider integration.
- No auth guard weakening for `/webrtc`.
- No realtime verifier attempts, mastery evidence, generated images, or student progress writes.
- No destructive database cleanup or migration requiring data deletion.

Excluded files or surfaces:

- System web server configuration.
- Production secrets and local machine credentials.

Allowed actions mode:
`code-and-tests`

## Plan Evidence

Approved plan summary:

```text
Bridge WebRTC close into durable lesson continuity without routing live audio
through the slow tutor Responses pipeline. On close, if a signed-in realtime
session has useful transcript content, create/reuse a lesson session, save one
compact voice-origin tutor turn with a webrtc request id, count realtime
duration toward the lesson, return the synced turn to the web client, refresh
usage/history, and keep verified tasks/images/mastery/progress on the normal
governed /tutor/message path.
```

Approved validation or manual review:

- User direct repair request in active chat.
- Alatyr bootstrap and router used for API/WebRTC/UI/data/documentation scope.
- Manual logical integrity review against architecture, runtime flows, data
  model, UI tree, use cases, gaps, README, and WebRTC module docs.

## Use Result

Used by operation/change: `webrtc-lesson-continuity-20260715`
Patch changed after approval: `yes; TypeScript narrowing and E2E strict-locator fixes stayed within the approved WebRTC continuity/UI test scope`
Implementation stayed within approved scope: `yes; changed files are within approved API/WebRTC/lesson/tutor/web/test/doc/diagram/approval surfaces`
Validation run: `2026-07-15: npm run diagrams:render; npm run diagrams:check; npm run alatyr:check; npm run build; npm run lint; npm run test --workspace @egmathteacher/api -- --runTestsByPath test/webrtc.controller.spec.ts test/openai-client.service.spec.ts test/ai-model.service.spec.ts; npm run e2e; npm test; git diff --check; npm run smoke:dev; changed-file local path and secret scan`
Result/evidence: `diagram render completed; diagram drift check passed for 10 diagrams; Alatyr consistency check passed; build passed with existing Vite chunk-size warning; API lint passed; targeted API tests passed 3 suites / 21 tests; Playwright E2E passed 9 tests; full Jest passed 17 suites / 129 tests with existing worker-teardown warning; whitespace check passed; dev smoke passed for https://localhost:5137; changed-file local path and secret scan produced no findings`
Residual risk: `No live OpenAI Realtime call was run in this repair; realtime still saves one compact post-close continuity turn rather than streaming structured lesson-engine actions while audio is open; provider billing for cancelled or failed realtime requests remains best-effort local observability, not billing truth`
