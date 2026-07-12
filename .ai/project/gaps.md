# EGMathTeacher Gap Register

This register groups project gaps by logical owner. It separates locally
actionable cleanup from gaps that need product, legal, deployment, or AI/RAG
decisions.

## Fixed In Current Cleanup Pass

### Validation And Local Automation

- GitHub Actions CI exists at `.github/workflows/ci.yml`.
- `npm run diagrams:check` validates the rendered diagram source-hash manifest
  and Mermaid renderability.
- `npm run smoke:dev` smoke-checks a running dev web/API route.
- `npm run alatyr:check` validates required Alatyr adapter files, core package
  scripts, CODEOWNERS, CI wiring, and diagram source-hash consistency.

### Repository Governance

- `.github/CODEOWNERS` assigns repository ownership to `@atvardovsky`.

### Privacy And Logging Hygiene

- WebRTC provider event debug logs no longer include raw provider event
  payloads or transcript text.
- API tests include a regression check for provider-event transcript log
  redaction.

### Test Hygiene

- `npm run test --workspace @egmathteacher/api -- --detectOpenHandles
  --runInBand` passes locally without reporting open handles.

### Frontend Browser Verification

- `npm run e2e` runs Playwright browser tests against mocked API routes and
  headless Chromium.
- The browser suite covers auth/localization, first meeting, tutor response
  rendering, citations, and explicit image rendering.

### AI Teaching Safety And Profile Governance

- Student profile inputs and AI-made profile JSON are sanitized before storage
  so only teaching-useful signals remain.
- API tests cover removal of unsafe freeform/model profile details.

### POC Data Operations

- SQLite records applied schema version `001_initial_schema` in
  `schema_migrations`.
- API tests assert current migration ledger entries and SQLite foreign-key
  integrity after schema initialization.

### Lesson Lifecycle Contract Cleanup

- Lesson mode switching now starts a fresh web conversation/session boundary.
- The API also finishes an active lesson session when an older client reuses a
  conversation id with a different lesson type.
- First tutor turn no longer immediately adds active-learning seconds, and the
  default minimum turn heuristic is 30 seconds instead of 120 seconds.
- Model-suggested `goalStatus=reached` no longer completes a lesson by itself;
  backend-visible student evidence is required for `backend_observed`
  completion.
- Lesson strategy signals now use scoped progress/regression rows relevant to
  the current conversation, lesson type, or inferred topic hint.

## Remaining Gaps By Logical Set

### Student Privacy, Consent, And Data Rights

Partially addressed for the POC by teaching-only profile data minimization.
Still requires product/legal decisions before production implementation:

- formal privacy policy for minors
- retention period for users, tutor turns, profiles, generated images,
  transcripts, and uploaded knowledge metadata
- delete/export workflow and confirmation semantics
- consent and parent/guardian model
- production compliance review

### AI Teaching Safety And Profile Governance

Remaining AI behavior and policy work:

- invalidation policy for stale student profile memory beyond the current POC
  background refresh interval
- broader adversarial tests for tutor adaptation boundaries
- review of generated profile wording with a human pedagogy/privacy owner

### Authentication And Account Security

Accepted as POC-only gaps. Requires product/security thresholds before
production implementation:

- rate limiting
- account lockout rules
- password reset
- session revocation store
- CSRF-specific token strategy beyond SameSite cookies

### Frontend Browser Verification

Remaining frontend validation gaps:

- component tests
- accessibility checks
- visual regression checks

### Production Deployment And Operations

Requires deployment decisions and system-level approval:

- production migration rollback/backfill policy beyond the POC ledger
- provider billing reconciliation and current price-management workflow for
  AI usage estimates
- domain-valid TLS/reverse-proxy setup
- process manager/service ownership for the API and web assets
- backup/restore policy for SQLite
- health/readiness semantics and status-code policy
- structured production logging and incident procedure

### RAG And Admin Knowledge Quality

Requires RAG/product workflow decisions:

- document review UI
- chunk/retrieval diagnostics
- stale file cleanup
- source-material quality gates
- non-OpenAI provider contracts

### Pedagogical Mastery Engine

Remaining teaching-engine gaps:

- deterministic mathematical checker for at least one vertical ЕГЭ task type
- closed loop from task attempt to error classification, hint, retry, and
  proven mastery update
- full curriculum/prerequisite map for topic-aware progression
