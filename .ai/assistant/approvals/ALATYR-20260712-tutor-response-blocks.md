# Approval Record

Approval ID: `ALATYR-20260712-tutor-response-blocks`
Operation ID: `EGMT-20260712-tutor-response-blocks`
Operation type: `business-change architecture-change ui-contract code-and-tests`
Plan version: `v1`
Plan hash: `not available; approval was given as a direct implementation request after discussion`
Requested by: `project maintainer`
Approved by: `project maintainer`
Approved at: `2026-07-12T09:31:36+02:00`
Approval source/message: `User: "implement it"` after discussion of text and image in one assistant response
Expires at or reuse policy: `single implementation pass only`
Scope invalidation rule: `Approval is invalid if implementation adds live image auto-generation, calls live external services during validation, changes deployment/system configuration, adds production dependencies, or changes auth/security policy.`

## Approved Scope

Allowed protected changes:

- Change accepted tutor response behavior so one logical tutor turn can contain
  ordered text, task, example, and image blocks.
- Keep image generation asynchronous and explicit while rendering generated
  images inside the same tutor turn.
- Preserve legacy `answer`, `tasks`, `examples`, `needsImage`, and
  `imagePrompt` compatibility fields during the POC transition.
- Update API/web DTOs, tutor prompt parsing, UI rendering, tests, product docs,
  and diagrams for the response-block contract.

Allowed files or surfaces:

- `apps/api/src/tutor`
- `apps/api/src/background-ai`
- `apps/api/test`
- `apps/web/src`
- `apps/web/e2e`
- `README.md`
- `.ai/project`
- `.ai/assistant/approvals`

Excluded actions:

- No live OpenAI or external-service calls for validation.
- No automatic image generation that would add spend without explicit user
  action.
- No auth, permission, credential, production config, or web server changes.
- No new production dependencies.
- No database migration or destructive data operation.

Allowed actions mode:
`code-and-tests`

## Plan Evidence

Approved plan summary:

```text
Add ordered TutorResponseBlock support to the tutor API and web client,
normalize model output from either new block JSON or legacy fields, render text,
task, example, and image blocks inside one tutor turn, keep image bytes loaded
through the existing explicit /tutor/image endpoint, update tests, docs,
diagrams, and run target validation.
```

Approved validation or manual review:

- `npm run build`
- `npm test`
- `npm run lint`
- `npm run e2e`
- `npm run diagrams:render`
- `npm run diagrams:check`
- `npm run alatyr:check`
- manual source-doc review

## Use Result

Used by operation/change: `EGMT-20260712-tutor-response-blocks`
Patch changed after approval: `yes; implementation details and documentation sync were completed within the approved scope`
Implementation stayed within approved scope: `yes`
Validation run: `npm run build`; `npm test`; `npm run lint`; `npm run e2e`; `npm run diagrams:render`; `npm run diagrams:check`; `npm run alatyr:check`; `git diff --check`
Result/evidence: `all listed checks passed; build completed with existing Vite large-chunk warning`
Residual risk: `no live OpenAI validation was run; generated image behavior is covered by mocked unit/E2E tests only`
