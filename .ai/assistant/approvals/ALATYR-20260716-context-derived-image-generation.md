# Approval Record

Approval ID: `ALATYR-20260716-context-derived-image-generation`
Operation ID: `context-derived-image-generation`
Operation type: `business-api-ui-change`
Evidence classification: `historical-record`
Plan version: `v1`
Plan hash: `not available - direct user approval in conversation`
Approved plan file: `not available - direct user approval in conversation`
Approved diff base: `0097ada1f3fea52ba1cbc262d4d72d6d9dc87490`
Patch hash: `not available until final diff`
Requested by: `project owner`
Approved by: `project owner`
Approved at: `2026-07-16T14:10:42+02:00`
Repository revision at approval: `0097ada1f3fea52ba1cbc262d4d72d6d9dc87490`
Approval source/message: `User request: image prompt should not be required; image generation should derive context even to describe a task.`
Expires at or reuse policy: `single operation only`
Scope invalidation rule: `Any additional provider, persistence, billing, auth, or unrelated WebRTC behavior change requires a separate approval.`
Machine-readable record: `.ai/assistant/approvals/ALATYR-20260716-context-derived-image-generation.json`

## Approved Scope

Allowed protected changes:

- Make tutor image block prompt optional.
- Generate explanatory images from stored tutor answer, task, example, and image block context when no prompt is provided.
- Add task-driven visual support blocks where useful for lesson explanation.
- Update web image-generation requests so learners do not need to supply an image prompt.
- Update tests, diagrams, and project documentation for the new image-generation contract.

Allowed files or surfaces:

- `apps/api/src/tutor/tutor.service.ts`
- `apps/api/src/tutor/tutor.types.ts`
- `apps/api/test/tutor.service.spec.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/types.ts`
- `apps/web/e2e/app.spec.ts`
- `README.md`
- `apps/api/README.md`
- `.ai/project/architecture.md`
- `.ai/project/blueprint.md`
- `.ai/project/data-model.md`
- `.ai/project/runtime-flows.md`
- `.ai/project/use-cases.md`
- `.ai/project/ui-guidelines.md`
- `.ai/project/ui-tree.md`
- `.ai/project/diagrams/tutor-rag-sequence.mmd`
- `.ai/project/diagrams/rendered/tutor-rag-sequence.svg`
- `.ai/assistant/approvals/ALATYR-20260716-context-derived-image-generation.md`
- `.ai/assistant/approvals/ALATYR-20260716-context-derived-image-generation.json`

Excluded actions:

- No new external provider.
- No live image-generation smoke call.
- No auth, pricing, or user-data retention policy changes.
- No WebRTC behavior changes.

Excluded files or surfaces:

- `none`

Allowed actions mode:
`code-and-tests`

## Plan Evidence

Approved plan summary:

```text
Keep explicit image prompts as backward-compatible input, but make them optional.
If a tutor answer or task needs a visual, allow an image block with caption/alt
text only. The web client sends turn/block identity and compact visible context.
The API derives the provider image instruction from the explicit prompt when
present, otherwise from the stored tutor turn, answer, task, example, and image
block context. Update tests and documentation.
```

Approved validation or manual review:

- `npm test -- --runTestsByPath apps/api/test/tutor.service.spec.ts` passed after implementation.
- `npm run build` passed after implementation with the pre-existing Vite chunk-size warning.
- `npm run e2e` passed with 10 mocked browser tests.
- `npm test` passed with 18 API suites / 134 tests.
- `npm run lint` passed.
- `npm run diagrams:render && npm run diagrams:check` passed.
- `npm run alatyr:check` passed.
- `npm run smoke:dev` passed against `https://localhost:5137`.

## Use Result

Used by operation/change: `context-derived-image-generation`
Patch changed after approval: `yes - implementation and tests followed the approved direct request`
Implementation stayed within approved scope: `yes for the image-generation behavior change; working tree also contains earlier uncommitted WebRTC/voice/documentation changes covered by separate approvals`
Validation run: `npm test -- --runTestsByPath apps/api/test/tutor.service.spec.ts; npm run build; npm run e2e; npm test; npm run lint; npm run diagrams:render && npm run diagrams:check; npm run alatyr:check; npm run smoke:dev`
Result/evidence: `focused tutor service test passed; build passed with existing Vite chunk-size warning; E2E 10 passed; API tests 18 suites / 134 tests passed; lint passed; diagram drift check passed for 10 diagrams; Alatyr consistency check passed; dev smoke passed`
Residual risk: `Live OpenAI image generation was not exercised during this local change; promptless generation is covered through mocked provider tests and browser E2E request payload assertions.`
