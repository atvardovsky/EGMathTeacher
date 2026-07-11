# First-Login Student Profile Business Logic

Operation: approved blueprint-driven product change.

Date: 2026-07-10

Allowed actions used: `code-and-tests`.

## Goal

Implement first-login business logic for teenager understanding:

- students complete a first meeting before the normal tutor workspace
- AI creates a tutoring-focused psychopedagogical student profile
- personal profile memory is stored in SQLite, not in RAG
- RAG remains shared AI knowledge for teaching strategy, rubrics, tasks, and
  methodology
- tutor prompts load the DB profile so context compaction does not erase who
  the AI is speaking with

## Files Added

- `apps/api/src/student-profile/student-profile.controller.ts`
- `apps/api/src/student-profile/student-profile.module.ts`
- `apps/api/src/student-profile/student-profile.service.ts`
- `apps/api/src/student-profile/student-profile.types.ts`
- `apps/api/test/student-profile.service.spec.ts`
- `.ai/project/diagrams/onboarding-profile-sequence.mmd`
- `.ai/project/diagrams/rendered/onboarding-profile-sequence.svg`
- `.ai/assistant/reports/ALATYR-20260710-first-login-student-profile.md`

## Files Updated

- `README.md`
- `apps/api/src/app.module.ts`
- `apps/api/src/database/database.service.ts`
- `apps/api/src/tutor/tutor.module.ts`
- `apps/api/src/tutor/tutor.service.ts`
- `apps/api/test/tutor.service.spec.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/types.ts`
- `apps/web/vite.config.ts`
- `deploy/apache-atvardovsky.dev.conf`
- `deploy/nginx-atvardovsky.dev.conf`
- `.ai/project/architecture.md`
- `.ai/project/blueprint.md`
- `.ai/project/context-map.md`
- `.ai/project/contour.md`
- `.ai/project/data-model.md`
- `.ai/project/diagrams.md`
- `.ai/project/diagrams/README.md`
- `.ai/project/diagrams/api-modules.mmd`
- `.ai/project/diagrams/data-model.mmd`
- `.ai/project/diagrams/system-context.mmd`
- `.ai/project/diagrams/tutor-rag-sequence.mmd`
- `.ai/project/guards.md`
- `.ai/project/runtime-flows.md`
- `.ai/project/security-safety.md`
- `.ai/project/use-cases.md`
- `.ai/project/validation.md`
- `.ai/assistant/infrastructure-index.md`

## Logical Integrity Review

Change intent: add durable student understanding/profile memory and first-login
onboarding before normal tutor usage.

Changed facts:

- new `StudentProfileModule`
- new authenticated `/student-profile/me` API
- new `student_profiles` SQLite table
- first-login student meeting in the web client
- AI-generated knowledge state, learning preferences, psychopedagogical
  profile, explanation strategy, and compact summary
- tutor prompt personalization from DB profile memory
- RAG/DB boundary: RAG stores shared AI teaching knowledge; DB stores personal
  student memory

Risk class: business logic, data/persistence, external boundary, security and
privacy, UI workflow, documentation/diagram sync.

Source of truth: project code under `apps/api` and `apps/web`, plus
`.ai/project/*` docs.

Conflicts found: existing docs described only auth-to-tutor flow and did not
include student profile memory or `/student-profile` routing.

Repair set: code, tests, public docs, project source-of-truth docs, proxy
reference files, Mermaid sources, rendered SVGs, and assistant infrastructure
index.

Approvals: explicit user approval in the request "implement changes" after the
business logic discussion. No live OpenAI call was made by the assistant
during validation.

## Validation

Ran:

```bash
npm run build
npm test
npm run lint
npm run diagrams:render
```

Results:

- build passed
- tests passed after fixing test issues: 25 tests
- lint passed
- diagram render passed: 8 SVG files

## Residual Risk

- No browser E2E test covers the first-login meeting.
- No production privacy/compliance review exists for profiling minors.
- No migration/versioning system exists beyond inline SQLite
  `CREATE TABLE IF NOT EXISTS`.
- Live OpenAI profile generation was not smoke-tested.
- Dependency audit findings from earlier work remain unresolved.
