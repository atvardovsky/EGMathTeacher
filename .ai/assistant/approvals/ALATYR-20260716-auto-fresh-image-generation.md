# Approval Record

Approval ID: `ALATYR-20260716-auto-fresh-image-generation`
Operation ID: `auto-fresh-image-generation`
Operation type: `business-ui-spend-behavior-change`
Evidence classification: `historical-record`
Plan version: `v1`
Plan hash: `not available - direct user approval in conversation`
Approved plan file: `not available - direct user approval in conversation`
Approved diff base: `e6ec0278e9396e1a9e30b89f995bd6e2597e4db3`
Patch hash: `not available until final diff`
Requested by: `project owner`
Approved by: `project owner`
Approved at: `2026-07-16T22:05:33+02:00`
Repository revision at approval: `e6ec0278e9396e1a9e30b89f995bd6e2597e4db3`
Approval source/message: `User request after image-flow review: "fix it". Context: tutor responses should show generated images when visual support is part of the AI answer, not only expose a manual prompt/button path.`
Expires at or reuse policy: `single operation only`
Scope invalidation rule: `Any new image provider, auth change, billing-policy change, persistent raw prompt expansion, realtime-audio-to-image architecture change, or live spend smoke requires separate approval.`
Machine-readable record: `.ai/assistant/approvals/ALATYR-20260716-auto-fresh-image-generation.json`

## Approved Scope

Allowed protected changes:

- Make fresh active tutor image blocks automatically call `POST /tutor/image` once after the text answer renders.
- Keep saved/history turns and failed automatic generation on explicit manual image action to avoid repeated page-load spend.
- Make the UI show an automatic image-generation loading state.
- Update browser E2E expectations so image generation is proven automatic.
- Update source-of-truth docs and diagrams for the new image behavior.

Allowed files or surfaces:

- `apps/web/src/App.tsx`
- `apps/web/src/i18n.ts`
- `apps/web/e2e/app.spec.ts`
- `README.md`
- `.ai/project/architecture.md`
- `.ai/project/blueprint.md`
- `.ai/project/runtime-flows.md`
- `.ai/project/use-cases.md`
- `.ai/project/ui-guidelines.md`
- `.ai/project/ui-tree.md`
- `.ai/project/validation.md`
- `.ai/project/diagrams/README.md`
- `.ai/project/diagrams/tutor-rag-sequence.mmd`
- `.ai/project/diagrams/ui-tree.mmd`
- `.ai/project/diagrams/rendered/tutor-rag-sequence.svg`
- `.ai/project/diagrams/rendered/ui-tree.svg`
- `.ai/project/diagrams/rendered/source-hashes.sha256`
- `.ai/assistant/approvals/ALATYR-20260716-auto-fresh-image-generation.md`
- `.ai/assistant/approvals/ALATYR-20260716-auto-fresh-image-generation.json`

Excluded actions:

- No new external provider.
- No live image-generation smoke call without a separate explicit request.
- No WebRTC raw-audio transcript architecture change.
- No auth, retention, or pricing-policy change.

Excluded files or surfaces:

- `none`

Allowed actions mode:
`code-and-tests`

## Plan Evidence

Approved plan summary:

```text
Keep tutor text responses non-blocking, but make fresh active image blocks
behave as visible answer content. The web client should automatically start one
image-generation request per fresh active image block, render the generated PNG in the
same tutor card, and keep manual action only for saved/history turns or failed
retry cases. Update docs, diagrams, and E2E coverage.
```

Approved validation or manual review:

- `npm run e2e -- apps/web/e2e/app.spec.ts` passed with 10 mocked browser tests.
- `npm run build` passed with the pre-existing Vite chunk-size warning.
- `npm run diagrams:render && npm run diagrams:check` passed.
- `npm run alatyr:check` passed.
- `npm run lint` passed.
- `git diff --check` passed.

## Use Result

Used by operation/change: `auto-fresh-image-generation`
Patch changed after approval: `yes - implementation follows direct user fix request`
Implementation stayed within approved scope: `yes - changed web image auto-generation behavior, related E2E, source-of-truth docs, diagrams, and this approval record`
Validation run: `npm run e2e -- apps/web/e2e/app.spec.ts; npm run build; npm run diagrams:render; npm run diagrams:check; npm run alatyr:check; npm run lint; git diff --check`
Result/evidence: `E2E 10 passed; build passed with existing Vite chunk-size warning; diagram drift check passed for 10 diagrams; Alatyr consistency check passed; lint passed; whitespace diff check passed`
Residual risk: `Live OpenAI image generation is not exercised by this approval; mocked browser E2E proves automatic request/render behavior.`
