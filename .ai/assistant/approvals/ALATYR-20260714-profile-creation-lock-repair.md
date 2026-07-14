# Approval Record

Approval ID: `ALATYR-20260714-profile-creation-lock-repair`
Operation ID: `review-followup-profile-creation-conversation-lock`
Operation type: `business-change,data-change,security-sensitive,code-local`
Plan version: `review-results-2026-07-14-profile-creation-lock`
Plan hash: `not available; approval was granted in chat against the review findings and assistant plan`
Requested by: `project owner`
Approved by: `project owner`
Approved at: `2026-07-14T16:46:40+02:00`
Approval source/message: `User request: "implement it, commit and push" after the plan to fix conversation-level profile-run locking, empty active meeting hydration, completed-without-profile recovery, and heartbeat lease handling`
Expires at or reuse policy: `single repair operation only`
Scope invalidation rule: `New schema tables, external service changes, production data mutation, or changes outside first-meeting/profile-creation recovery require a new approval.`

## Approved Scope

Allowed protected changes:

- Enforce one running first-meeting profile creation run per authenticated user and conversation.
- Reject fresh duplicate profile creation when a transcript changes while another run is active.
- Recover stale running profile runs with changed transcript hashes without letting old runs overwrite final state.
- Recover completed profile-creation run rows that lost their `student_profiles` row.
- Add heartbeat-based lease refresh during the paid onboarding AI pipeline.
- Ignore empty active first-meeting sessions when restoring onboarding UI state after reload.
- Update tests, docs, diagrams, and Alatyr evidence for the repaired behavior.
- Commit and push the resulting changes to `origin/main`.

Allowed files or surfaces:

- `apps/api/src/database/database.service.ts`
- `apps/api/src/student-profile/*`
- `apps/api/test/*`
- `apps/web/src/App.tsx`
- `apps/web/e2e/*`
- `README.md`
- `apps/api/README.md`
- `.ai/project/*`
- `.ai/project/diagrams/*`
- `.ai/assistant/approvals/*`

Excluded actions:

- No live OpenAI calls.
- No production data deletion.
- No system web server or domain configuration changes.
- No new production dependencies.
- No PR creation required; user requested commit and push only.

Allowed actions mode:
`code-and-tests`

## Plan Evidence

Approved plan summary:

```text
Add a conversation-level active profile-creation lock, recover stale or
corrupt profile-creation rows, heartbeat live profile pipelines between AI
calls, ignore empty active first-meeting sessions during UI hydration, sync
docs/diagrams/tests, then commit and push.
```

Approved validation or manual review:

- User explicitly approved implementation and publishing by saying `implement it, commit and push`.
- Alatyr bootstrap and relevant business/data/security/code-local context were read before edits.

## Use Result

Used by operation/change: `profile creation conversation lock and recovery repair`
Patch changed after approval: `no protected scope expansion expected`
Implementation stayed within approved scope: `yes`
Validation run: `completed 2026-07-14`
Result/evidence:

- `npm run lint` passed.
- `npm test --workspace @egmathteacher/api -- student-profile.service.spec.ts --runInBand` passed: 1 suite, 13 tests.
- `npm run build` passed; Vite reported the existing large chunk warning.
- `npm test -- --runInBand` passed: 16 suites, 107 tests; Jest printed the existing force-exit worker shutdown warning.
- `npm run diagrams:render` passed and refreshed rendered diagram hashes.
- `npm run diagrams:check` passed for 10 diagrams.
- `npm run alatyr:check` passed.
- `git diff --check` passed.
- `npx playwright test apps/web/e2e/app.spec.ts:909 --project=chromium --workers=1` passed after the first full E2E run showed a one-off parallel loading flake in that spec.
- `npm run e2e` passed on rerun: 7 Playwright tests.
- `npm run smoke:dev` passed for `https://localhost:5137`.

Residual risk:

- Profile creation lease renewal happens between pipeline stages, not as a sub-request heartbeat while an individual provider request is in flight.
- Browser E2E still uses mocked API responses; live OpenAI onboarding and multi-process concurrency stress tests were not run.
