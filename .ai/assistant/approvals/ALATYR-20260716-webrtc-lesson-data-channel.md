# Approval Record

Approval ID: `ALATYR-20260716-webrtc-lesson-data-channel`
Operation ID: `webrtc-lesson-data-channel-20260716`
Operation type: `product-runtime-architecture-change`
Evidence classification: `historical-record`
Plan version: `2026-07-16-webrtc-lesson-data-channel-v1`
Plan hash: `not available; plan was discussed in active chat`
Approved plan file: `not available; active-chat plan approved by direct implement request`
Approved diff base: `0097ada`
Patch hash: `not available before final validation`
Requested by: `programmer`
Approved by: `programmer`
Approved at: `2026-07-16T11:17:25Z`
Repository revision at approval: `0097ada`
Approval source/message: `User asked for a plan for using WebRTC as one controlled channel for text/voice, then replied 'implement'.`
Expires at or reuse policy: `single operation only`
Scope invalidation rule: `New provider, new dependency, auth guard weakening, live spend validation, production deployment, destructive data operation, or making raw realtime audio transcript write verifier/mastery/progress state requires fresh approval.`
Machine-readable record: `.ai/assistant/approvals/ALATYR-20260716-webrtc-lesson-data-channel.json`

## Approved Scope

Allowed protected changes:

- Add a browser-to-server WebRTC data channel for typed lesson events during an active live voice session.
- Route authenticated `student_text` events from that channel into the existing `TutorService.answerMessage` path.
- Keep raw realtime audio/provider transcript handling outside verifier/mastery evidence unless it enters through the governed tutor engine.
- Store only non-secret authenticated user metadata in in-memory WebRTC session state for server-local tutor calls.
- Update React tutor workspace live-session transport so typed messages use WebRTC data channel when open and REST fallback otherwise.
- Synchronize public docs, Alatyr project docs, diagrams, UI copy, and tests.

Allowed files or surfaces:

- `README.md`
- `apps/api/Agent.md`
- `apps/api/README.md`
- `apps/api/docs/webrtc-module.md`
- `apps/api/src/tutor/tutor.module.ts`
- `apps/api/src/webrtc`
- `apps/api/test/webrtc.controller.spec.ts`
- `apps/api/test/webrtc-media.service.spec.ts`
- `apps/web/e2e/app.spec.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/i18n.ts`
- `apps/web/src/types.ts`
- `.ai/project/architecture.md`
- `.ai/project/blueprint.md`
- `.ai/project/context-map.md`
- `.ai/project/data-model.md`
- `.ai/project/runtime-flows.md`
- `.ai/project/source-of-truth-registry.md`
- `.ai/project/use-cases.md`
- `.ai/project/validation.md`
- `.ai/project/diagrams/README.md`
- `.ai/project/diagrams/system-context.mmd`
- `.ai/project/diagrams/webrtc-realtime-sequence.mmd`
- `.ai/project/diagrams/rendered`
- `.ai/assistant/approvals/ALATYR-20260716-webrtc-lesson-data-channel.md`
- `.ai/assistant/approvals/ALATYR-20260716-webrtc-lesson-data-channel.json`

Excluded actions:

- No live OpenAI or external provider validation unless separately requested.
- No production deployment, PM2, certificate, Apache, reverse proxy, or system web server changes.
- No new npm dependency or provider integration.
- No auth guard weakening for `/webrtc` endpoints.
- No raw realtime audio transcript promotion to verifier evidence, mastery evidence, or durable progress.
- No destructive database cleanup or migration requiring data deletion.

Excluded files or surfaces:

- System web server configuration.
- Production secrets and local machine credentials.
- Database migration files.
- Package dependency manifests.

Allowed actions mode:
`full-with-approval`

## Plan Evidence

Approved plan summary:

```text
Keep browser-to-server WebRTC as the controlled transport. Use one WebRTC
connection for live audio and a server-owned lesson data channel. Audio stays
low-latency through the OpenAI Realtime bridge; typed lesson messages sent
while live mode is open use the lesson data channel, enter the existing tutor
engine, return structured tutor answers over the channel, and preserve backend
policy ownership for lesson lifecycle, RAG, verifier, usage, and persistence.
```

Approved validation or manual review:

- User direct implementation approval in active chat.
- Alatyr bootstrap and router used for architecture, API/WebRTC, web UI, docs,
  diagram, and approval scope.
- Manual logical integrity review against architecture, blueprint, runtime
  flows, data model, public README, API README, WebRTC guide, and Realtime
  agent instructions.

## Use Result

Used by operation/change: `webrtc-lesson-data-channel-20260716`
Patch changed after approval: `yes; E2E WebRTC mock gained createDataChannel after browser validation found the new required API surface`
Implementation stayed within approved scope: `yes; changed files are within approved WebRTC, tutor module export, web UI, e2e, docs, diagram, and approval surfaces`
Validation run: `npx tsc -p apps/api/tsconfig.json --noEmit; npx tsc -p apps/web/tsconfig.json --noEmit; npm run test -- --runTestsByPath apps/api/test/webrtc-media.service.spec.ts apps/api/test/webrtc.controller.spec.ts; npm run lint; npm run diagrams:render; npm run diagrams:check; npm run alatyr:check; npm run build; npm test; npm run e2e after fixing the E2E WebRTC mock; git diff --check; changed-file local path and secret scan; npm run smoke:dev`
Result/evidence: `API and web TypeScript no-emit checks passed; targeted WebRTC tests passed 2 suites / 13 tests; API lint passed; rendered 10 diagrams; diagram drift check passed; Alatyr consistency check passed; build passed with existing Vite chunk-size warning; full Jest passed 18 suites / 132 tests with existing worker-teardown warning; initial parallel E2E run exposed missing createDataChannel in the test mock, after mock repair isolated E2E passed 9 tests; whitespace check passed; changed-file local path and strict secret scans returned no matches; dev smoke passed for https://localhost:5137`
Residual risk: `No live OpenAI Realtime call was run; WebRTC data-channel E2E is mocked, not a real browser-to-Nest-to-OpenAI negotiation; raw realtime audio remains continuity/observation-only and provider billing for realtime audio remains local best-effort observability`
