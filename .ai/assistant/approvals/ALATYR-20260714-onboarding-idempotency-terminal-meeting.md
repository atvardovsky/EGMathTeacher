# Approval Record

Approval ID: `ALATYR-20260714-onboarding-idempotency-terminal-meeting`
Operation ID: `review-fix-terminal-meeting-idempotency`
Operation type: `business-data-ui-security-change`
Plan version: `2026-07-14-review-fix`
Plan hash: `not-available: user requested direct implementation from review findings`
Requested by: `user`
Approved by: `user`
Approved at: `2026-07-14`
Approval source/message: `implement fixes, after do the commit and push`
Expires at or reuse policy: `single operation only`
Scope invalidation rule: `new onboarding architecture, auth/privacy model, or profile-storage behavior requires a new approval`

## Approved Scope

Allowed protected changes:

- Make terminal first-meeting conversations read-only in the web UI.
- Add idempotency storage and runtime protection for conversation-based profile creation.
- Guard the legacy structured onboarding endpoint behind an explicit configuration flag for student users.
- Update business, data, security, UI, validation, and diagram source-of-truth files.

Allowed files or surfaces:

- `apps/api/src/student-profile`
- `apps/api/src/database/database.service.ts`
- `apps/api/src/config/app.configuration.ts`
- `apps/api/test`
- `apps/web/src/App.tsx`
- `apps/web/src/i18n.ts`
- `apps/web/e2e`
- `README.md`, `apps/api/README.md`
- `.ai/project`
- `.ai/assistant/approvals`

Excluded actions:

- No live OpenAI calls.
- No production data deletion.
- No system web server configuration changes.
- No secret exposure or credential changes.

Allowed actions mode:
`code-and-tests`

## Plan Evidence

Approved plan summary:

```text
Fix reviewed onboarding issues by enforcing terminal first-meeting read-only UI,
adding idempotent profile creation from stored meeting transcripts, guarding the
legacy structured onboarding route, documenting the remaining transcript
retention production gap, and syncing tests plus Alatyr/project documentation.
```

Approved validation or manual review:

- User provided review findings and requested implementation.
- Alatyr bootstrap and relevant project rules were used before edits.

## Use Result

Used by operation/change: `terminal meeting and profile creation hardening`
Patch changed after approval: `yes: E2E exposed stale meeting-readiness response race, fixed by request-order guard`
Implementation stayed within approved scope: `yes`
Validation run:

- `npm test --workspace @egmathteacher/api -- student-profile.service.spec.ts student-profile.controller.spec.ts --runInBand`
- `npm run build`
- `npm test -- --runInBand`
- `npm run lint`
- `npm run diagrams:render`
- `npm run diagrams:check`
- `npm run e2e`
- `npm run build`
- `npm run alatyr:check`
- `git diff --check`
- `npm run smoke:dev`

Result/evidence:

- Focused API tests: 2 suites passed, 8 tests passed.
- Full API tests: 16 suites passed, 100 tests passed.
- Browser E2E: 7 tests passed.
- Build, lint, diagram render/check, Alatyr check, diff check, and dev smoke passed.

Residual risk:

- First-meeting readiness remains a bounded POC lexical/completeness heuristic.
- Raw `tutor_turns` prompts and answer JSON remain in SQLite until production retention/redaction/deletion policy is implemented.
