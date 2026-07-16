# Approval Record

Approval ID: `ALATYR-20260716-realtime-primary-voice`
Operation ID: `realtime-primary-voice-20260716`
Operation type: `architecture-change`
Evidence classification: `historical-record`
Plan version: `1`
Plan hash: `not available - approval was given in conversation for the described implementation`
Approved plan file: `not available - conversational implementation request`
Approved diff base: `e6ec0278e9396e1a9e30b89f995bd6e2597e4db3`
Patch hash: `not available before implementation`
Requested by: `atvardovsky`
Approved by: `atvardovsky`
Approved at: `2026-07-16T23:50:18+02:00`
Repository revision at approval: `e6ec0278e9396e1a9e30b89f995bd6e2597e4db3`
Approval source/message: `User requested: "implement it. After check an concistancy" after agreeing that tutor voice should become WebRTC/OpenAI Realtime primary with browser voice as fallback.`
Expires at or reuse policy: `single operation only`
Scope invalidation rule: `Changing provider, auth, production deployment, secrets, or adding new external services requires a new approval.`
Machine-readable record: `.ai/assistant/approvals/ALATYR-20260716-realtime-primary-voice.json`

## Approved Scope

Allowed protected changes:

- Make tutor-workspace voice dialog Realtime/WebRTC-first.
- Route completed Realtime input transcripts through the backend tutor engine.
- Ask OpenAI Realtime to speak the governed tutor answer.
- Keep browser speech recognition/synthesis as fallback only.
- Avoid duplicate compact close-time Realtime turns when structured Realtime tutor turns already exist.

Allowed files or surfaces:

- `apps/api/src/webrtc/**`
- `apps/api/test/webrtc*.spec.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/i18n.ts`
- `apps/web/e2e/app.spec.ts`
- `apps/api/README.md`
- `apps/api/docs/webrtc-module.md`
- `apps/api/Agent.md`
- `.ai/project/**`
- `.ai/assistant/approvals/ALATYR-20260716-realtime-primary-voice.*`

Excluded actions:

- No live OpenAI calls for validation.
- No system web server or deployment configuration changes.
- No new production dependencies.
- No secret, key, TLS, or credential changes.

Excluded files or surfaces:

- `deploy/**`
- `.env`
- `.cert/**`
- system Apache/Nginx configuration

Allowed actions mode:
`full-with-approval`

## Plan Evidence

Approved plan summary:

```text
Make tutor voice mode use the existing server-owned WebRTC/OpenAI Realtime
bridge as the primary path. Realtime completed transcripts become voice-origin
student_text events handled by TutorService. The bridge speaks the governed
tutor answer through OpenAI Realtime. The browser keeps speech recognition and
speech synthesis only as fallback/history replay.
```

Approved validation or manual review:

- Run API tests around WebRTC media/controller behavior.
- Run web E2E around voice and Realtime behavior.
- Run build, lint, diagram render/check, Alatyr check, and diff check where applicable.

## Use Result

Used by operation/change: `current implementation turn`
Patch changed after approval: `yes - implementation created after conversational approval`
Implementation stayed within approved scope: `yes - changed runtime files are within approved WebRTC, tutor UI, E2E, and documentation surfaces; no deployment, TLS, secret, or new dependency changes`
Validation run: `npm test; npm test -- --runInBand apps/api/test/webrtc-media.service.spec.ts apps/api/test/webrtc.controller.spec.ts; npm run build; npm run lint; npm run e2e; npm run diagrams:render; npm run diagrams:check; npm run alatyr:check; npm run smoke:dev after starting local dev stack; git diff --check`
Result/evidence: `API tests passed: 18 suites / 136 tests. Focused WebRTC tests passed: 2 suites / 15 tests. Browser E2E passed: 11 tests. Build, lint, diagram drift, Alatyr check, dev smoke, and diff whitespace checks passed. Secret/local-path scan found no committed key or local /home path leakage in the checked docs/source set.`
Residual risk: `real OpenAI Realtime WebRTC media quality, live provider latency, and provider billing are not validated by mocked local tests or dev smoke`
