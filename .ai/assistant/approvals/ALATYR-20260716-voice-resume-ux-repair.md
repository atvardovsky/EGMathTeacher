# Approval Record

Approval ID: `ALATYR-20260716-voice-resume-ux-repair`
Operation ID: `voice-resume-ux-repair-20260716`
Operation type: `web-ui-behavior-repair`
Evidence classification: `historical-record`
Plan version: `2026-07-16-voice-resume-ux-repair-v1`
Plan hash: `not available; repair was requested directly in active chat`
Approved plan file: `not available; active-chat request approved by direct implementation request`
Approved diff base: `0097ada`
Patch hash: `not available before final validation`
Requested by: `programmer`
Approved by: `programmer`
Approved at: `2026-07-16T11:39:21Z`
Repository revision at approval: `0097ada`
Approval source/message: `User requested: "Make sure that student will not be forced repeat many times, that mic will work normaly, that will present button Продолжить for the not finished sessions/lessons".`
Expires at or reuse policy: `single operation only`
Scope invalidation rule: `New provider, new dependency, backend lesson lifecycle changes, live external validation, production deployment, data deletion, or authentication/security weakening requires fresh approval.`
Machine-readable record: `.ai/assistant/approvals/ALATYR-20260716-voice-resume-ux-repair.json`

## Approved Scope

Allowed protected changes:

- Add bounded browser speech-recognition retry for silence/no-speech stops in first-meeting and tutor flows.
- Preserve recognized or typed prompt text in the composer when REST or WebRTC lesson-event delivery fails.
- Show explicit `Продолжить`/`Continue` labels for unfinished lesson resume actions.
- Update mocked browser E2E and source-of-truth docs for the repaired UI behavior.

Allowed files or surfaces:

- `README.md`
- `apps/web/src/App.tsx`
- `apps/web/src/i18n.ts`
- `apps/web/e2e/app.spec.ts`
- `.ai/project/blueprint.md`
- `.ai/project/use-cases.md`
- `.ai/project/runtime-flows.md`
- `.ai/project/ui-guidelines.md`
- `.ai/project/ui-tree.md`
- `.ai/project/validation.md`
- `.ai/project/diagrams/ui-tree.mmd`
- `.ai/project/diagrams/rendered/ui-tree.svg`
- `.ai/project/diagrams/rendered/source-hashes.sha256`
- `.ai/assistant/approvals/ALATYR-20260716-voice-resume-ux-repair.md`
- `.ai/assistant/approvals/ALATYR-20260716-voice-resume-ux-repair.json`

Excluded actions:

- No live OpenAI or external provider validation.
- No production deployment, PM2, certificate, Apache, reverse proxy, or system web server changes.
- No new npm dependency or provider integration.
- No backend lesson lifecycle or database schema changes.
- No destructive database cleanup.

Excluded files or surfaces:

- System web server configuration.
- Production secrets and local machine credentials.
- Database migration files.
- Package dependency manifests.
- API runtime files outside previously approved WebRTC scope.

Allowed actions mode:
`code-and-tests`

## Plan Evidence

Approved plan summary:

```text
Repair the browser UI so active saved lessons expose an obvious Continue
action, speech recognition retries silence/no-speech stops with a bounded
budget, and recognized speech is restored to the composer when message
delivery fails. Keep the change local to the React UI, mocked browser E2E,
synchronized project documentation, and the affected UI diagram.
```

Approved validation or manual review:

- User direct implementation request in active chat.
- Alatyr bootstrap and web overlay context used.
- Manual logical integrity review against UI guidelines, UI tree, runtime
  flows, use cases, validation docs, and README.

## Use Result

Used by operation/change: `voice-resume-ux-repair-20260716`
Patch changed after approval: `yes; stale blueprint and UI diagram references were found during consistency scan and added to the repair scope`
Implementation stayed within approved scope: `yes; changed UI, E2E, docs, diagram, rendered diagram, and approval files are within this record or the separate WebRTC data-channel approval record`
Validation run: `npm run diagrams:render; npm run e2e; npm run build; npm run lint; npm test; npm run diagrams:check; npm run alatyr:check; git diff --check; changed-file secret/local-path scan; npm run smoke:dev`
Result/evidence: `rendered 10 diagrams; browser E2E passed 10 tests; build passed with existing Vite chunk-size warning; API lint passed; Jest passed 18 suites / 132 tests with existing worker-teardown warning; diagram drift check passed for 10 diagrams; Alatyr consistency check passed; whitespace check passed; tightened changed-file secret/local-path scan returned no matches; dev smoke passed for https://localhost:5137`
Residual risk: `Browser speech recognition remains browser-dependent; no real microphone-device lab, accessibility suite, or visual regression suite exists. The local usage/statistics and Realtime billing limitations are unchanged.`
