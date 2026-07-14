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
- The browser suite covers auth/localization, first meeting, lesson launcher
  visibility/start, mocked speech-synthesis handoff for tutor voice output,
  automatic speech-recognition restart, tutor response rendering, citations,
  and explicit image rendering.

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
- The API also finishes an active lesson session and rejects the reused
  conversation id when an older client sends a different lesson type.
- Finished, goal-reached, and hard-limit lesson conversations cannot be
  reopened through `POST /tutor/message`.
- Lesson finish paths now enqueue background closure review for stored
  conversation summaries and teaching-strategy/profile hints only after
  confirmed terminal transitions; repeated finish calls and rejected terminal
  conversation reuse do not enqueue premature closure jobs.
- First-meeting profile creation is gated by backend readiness scoring and
  ignores the technical starter prompt; reloads restore unfinished active
  meeting lessons.
- First tutor turn no longer immediately adds active-learning seconds, and the
  default minimum turn heuristic is 30 seconds instead of 120 seconds.
- Model-suggested `goalStatus=reached` no longer completes a lesson by itself;
  backend-visible student evidence is required for `backend_observed`
  completion.
- Lesson strategy signals now use scoped progress/regression rows relevant to
  the current conversation, lesson type, or inferred topic hint.
- Lesson Decision Agent contracts now route each tutor turn through structured
  teaching actions and backend policy before final answer generation.
- Self-reported completion phrases are no longer accepted as goal completion;
  they remain weak evidence that should trigger a student attempt or
  explanation.
- `lesson_decisions` stores action-level decision/policy observability.
- Lesson decision calls can be disabled or locally timed out into a safe
  fallback.
- Tutor messages can carry a request id for idempotent retry handling.
- A first deterministic verified learning loop exists for linear equations:
  task-bank-backed task, canonical source task identity, stored hint ladder and
  common-error ids, student attempt, numeric verifier, imported
  mastery-criteria gate, misconception-aware hint routing, mastery evidence
  only after policy acceptance, and cost-per-verified-outcome visibility.
- Accepted `mark_goal_blocked` policy now updates durable lesson goal state.
- Profile-delta proposals from the immediate decision path are routed into
  sanitized background observations instead of mutating the profile.
- Tutor-side lesson continuity now shows active saved lessons, read-only
  historical records, previous questions, summaries or last answers, an
  explicit empty-history state, resume/open-record actions, and an explicit
  finish action for the active lesson. The latest active saved discussion is
  loaded when stored turns exist; legacy `tutor_turns` without
  `lesson_sessions` remain visible only as read-only history.

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
- manual admin-upload stale file cleanup outside the knowledge-pack sync path
- source-material quality gates
- non-OpenAI provider contracts

Knowledge-pack runtime and sync review gaps are repaired in
`.ai/project/knowledge-pack-runtime-repair-plan.md`. Remaining risks:

- non-dry-run OpenAI RAG sync has not been validated with live credentials in
  this workspace
- recovery covers failed jobs and attached indexing-timeout jobs that recorded
  recoverable OpenAI file ids; fully arbitrary remote/local divergence may
  still need operator cleanup
- archive guardrails bound local trusted-operator packs, but this is not a
  public web-upload workflow
- parallel sync claims protect upload/attach paths for the same
  pack/vector-store/source/hash tuple inside local SQLite transactions; global
  distributed locking is not implemented

### Pedagogical Mastery Engine

Remaining teaching-engine gaps:

- deterministic mathematical checkers beyond the current linear-equation
  numeric-answer vertical
- richer closed loop from verified error classification to adaptive retry,
  mastery decay/review, and multi-lesson spaced repetition
- runtime-connected full curriculum/prerequisite map for topic-aware
  progression
- richer DB-backed curriculum ID resolver beyond the current text-scored
  active-skill lookup
- adaptive/embedding-based task-bank selection beyond imported supported
  verifier kinds and simple prior-use ordering
- real cross-browser audio playback quality, Russian stress, and emotional
  prosody remain POC concerns; current automated E2E checks browser
  speech-synthesis handoff and automatic mic restart, but not real audio
  naturalness
