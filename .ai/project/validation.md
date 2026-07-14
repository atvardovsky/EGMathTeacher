# EGMathTeacher Validation

This file records validation commands and test coverage discovered in the
repository.

## Commands

Run from repository root unless noted.

| Purpose | Command | Source |
| --- | --- | --- |
| Start dev stack | `npm run dev` | `package.json` |
| Start API dev server | `npm run dev:api` | `package.json` |
| Start web dev server | `npm run dev:web` | `package.json` |
| Build all workspaces | `npm run build` | `package.json` |
| API tests | `npm test` | `package.json` |
| API lint | `npm run lint` | `package.json` |
| Browser E2E | `npm run e2e` | `package.json`, `playwright.config.ts`, `apps/web/e2e` |
| Render Alatyr diagrams | `npm run diagrams:render` | `package.json` |
| Check Alatyr diagram drift | `npm run diagrams:check` | `package.json`, `scripts/check-diagrams.sh`, `.ai/project/diagrams/rendered/source-hashes.sha256` |
| Smoke-check running dev stack | `npm run smoke:dev` | `package.json`, `scripts/smoke-dev.sh` |
| Check Alatyr adapter consistency | `npm run alatyr:check` | `package.json`, `scripts/check-alatyr.sh` |
| Knowledge-pack import/RAG sync CLI | `npm run knowledge:sync -- --pack <zip> --import-db [--sync-rag] [--dry-run]` | `package.json`, `apps/api/src/knowledge/knowledge-pack.cli.ts` |
| API test watch | `npm run test:watch --workspace @egmathteacher/api` | `apps/api/package.json` |
| Web preview | `npm run preview --workspace @egmathteacher/web` | `apps/web/package.json` |

## Existing Test Surface

Jest tests live under `apps/api/test`.

Current covered areas:

- auth registration/login/session token behavior
- student profile onboarding requirement, stored meeting-conversation
  extraction, backend meeting-readiness scoring, AI profile storage, lesson
  usage attribution for onboarding specialist calls, and tutor context summary
  behavior, including specialist profile pipeline calls, idempotent
  conversation-profile creation, stale running profile-creation claim
  recovery, fresh running claim rejection, finalization transaction use, and
  the disabled-by-default legacy structured onboarding endpoint for students
- background AI job queueing, optional observation-window batching, legacy
  per-turn mode, flex-tier and prompt-cache payload shape, learning-signal
  storage, profile/strategy refresh merging, failed window observation release,
  stale queued/running state recovery, lesson-closure review fanout, closed
  lesson-type preservation in summaries, and signed-in-user-scoped failed-job
  requeue behavior
- tutor structured output, required image-block normalization for explicit
  visual requests, and generated image data URL persistence into the stored
  tutor turn
- tutor lesson-history retrieval for active vs historical canonical lesson
  sessions, explicit lesson finishing with closure-review enqueueing only on
  first transition, terminal conversation reopen rejection without false
  closure jobs, transition-confirmed superseded closure jobs, stored tutor
  turns, prompt continuity context, and legacy tutor-turn conversations exposed
  as read-only history
- AI model-provider facade delegation and role/operation policy application
  for response, lesson-decision, and image requests
- Lesson Decision Agent policy rejection and decision observability storage
- Lesson Decision Agent fallback/timeout-safe path, backend verifier evidence
  strengthening, sanitized decision storage, and profile-delta background
  routing
- lesson lifecycle goal completion remains pending without accepted backend
  policy and only completes when policy accepts the completion proposal
- deterministic linear-equation verifier, student attempts, imported
  mastery-criteria gating, mastery evidence, source-task-deduplicated
  independent success, cumulative cross-lesson mastery counting, task-bank
  hint ladders, invalid-format answer attempts with format hints,
  misconception-routed hints, `TASK_BANK_REQUIRED` fallback behavior, and
  cost-per-verified-outcome summary behavior, GPT-Image-2 output-token
  estimation when image responses omit usage, plus user-scoped background job
  result/error projection in usage summaries
- mocked browser E2E for saved active lesson resume, read-only finished lesson
  records, disabled archived composer/voice actions, and starting a fresh
  lesson from history, plus terminal tutor responses not restarting the
  microphone and terminal first-meeting responses turning the meeting
  transcript read-only while preserving profile creation across reload
- knowledge-pack structured import idempotency and mocked RAG sync behavior,
  including dry-run safety, unchanged-file skips, changed-file replacement,
  superseded vector-store attachment cleanup, partial-pack reconciliation
  safety, wait-ready timeout semantics, pending-index local rows, and sync-job
  recovery metadata, including no-wait recovery refusing to promote queued
  replacements before remote `completed`
- WebRTC token creation payload cleanup
- WebRTC signaling service payload and translation config
- WebRTC controller token/event paths
- WebRTC provider event transcript/token accumulation behavior
- WebRTC provider event debug logging avoids raw transcript text
- student profile teaching-only storage sanitation, POC migration ledger
  through background observation-window storage, and SQLite foreign-key
  integrity after migrations

The `wrtc` library is mocked in `apps/api/test/__mocks__/wrtc.js`.

Playwright E2E tests live under `apps/web/e2e` and currently mock API routes
to avoid live OpenAI, SQLite test-data coupling, or system service dependency.
They start a local HTTP Vite server on `E2E_PORT` or default `5138` so the
normal `https://localhost:5137` dev server can keep running. They cover
auth/localization, first-login meeting completion, lesson launcher
visibility/start, explicit empty saved-lesson state, saved lesson list/resume
with previous discussion hydration, browser speech-synthesis handoff for tutor replies,
automatic speech-recognition restart after spoken non-terminal tutor replies,
blocked speech-recognition restart after terminal tutor replies, tutor answer
rendering, terminal first-meeting read-only input behavior, citation display,
terminal first-meeting reload recovery before profile creation, usage refresh
control/background-job visibility,
and explicit image rendering.

## Existing Static Checks

- TypeScript API build: `tsc -p apps/api/tsconfig.build.json` through
  workspace build.
- Web TypeScript and Vite build through `apps/web` build script.
- API ESLint through `apps/api/eslint.config.mjs`.
- GitHub Actions CI is defined in `.github/workflows/ci.yml` and runs
  `npm ci`, `npm run build`, `npm test`, `npm run lint`, Playwright Chromium
  installation, `npm run e2e`, `npm run diagrams:check`, and
  `npm run alatyr:check`.
- Alatyr adapter consistency is checked by `scripts/check-alatyr.sh`.
- Diagram drift can be checked with `npm run diagrams:check`, which compares
  current Mermaid source hashes to the rendered manifest and verifies that
  sources still render.

## Missing Validation

- No frontend unit/component tests were found.
- No accessibility test command was found.
- No visual regression test command was found.
- No production migration rollback/backfill validation exists.
- No live OpenAI smoke-test policy exists.
- Focused API tests cover strict/partial knowledge-pack import behavior,
  failed import ledger rows, RAG deleted-path reconciliation, migration ledger
  presence, imported `task_bank_tasks` driving lesson task selection, imported
  mastery criteria preventing one-answer mastery, canonical source task ids
  preventing duplicate independent evidence, cumulative cross-lesson mastery,
  common-error hint routing, partial RAG sync skipping removed-path
  reconciliation, and wait-ready timeout leaving jobs attached rather than
  indexed.
- Remaining validation gaps: no live OpenAI non-dry-run RAG sync smoke test,
  no dedicated archive-guardrail fixture suite, and no parallel-process
  concurrency stress test.

## When To Run

- Docs-only project/adapter changes: manual source-doc review is usually
  sufficient unless docs claim command behavior changed.
- API behavior changes: run `npm run build`, `npm test`, and `npm run lint`.
- Web behavior changes: run `npm run build`; run `npm run e2e` when the
  affected workflow is covered by the mocked browser suite.
- Diagram source changes: run `npm run diagrams:render`.
- Diagram generated-artifact checks: run `npm run diagrams:check`.
- Dev-server/routing changes: start `npm run dev` and smoke-check the affected
  URL and `/health`, or run `npm run smoke:dev` against an already running
  dev stack.
- Adapter consistency checks: run `npm run alatyr:check` after changing
  `.ai`, bridge files, validation commands, CODEOWNERS, CI, or Alatyr-owned
  scripts.
- OpenAI integration changes: use mocked/unit validation by default; only call
  live OpenAI when the user explicitly requests or approves live validation
  with credentials and spend risk understood.
- Knowledge-pack RAG sync changes: validate with mocked unit tests by default.
  `--dry-run` may be used for local planning; do not run non-dry-run
  `--sync-rag` without explicit live OpenAI credential/spend approval.
- Knowledge-pack runtime repair changes: add or update focused API tests for
  DB-backed curriculum routing, unknown-topic behavior, task-bank selection,
  verifier task persistence, imported mastery-criteria gating,
  strict/partial import modes, failed import ledger rows, structured record
  retirement, RAG source-path reconciliation, sync recovery, wait-ready
  states, archive limits, and concurrent sync claims. Use a temporary SQLite
  database and mocked OpenAI/vector-store client by default.
- Real-pack validation after the repair should include a temporary-SQLite
  structured import smoke and a `--sync-rag --dry-run` plan against the local
  pack. Live non-dry-run RAG sync remains approval-gated.

## Final Evidence Format

Report:

- commands run
- pass/fail result
- skipped checks and reason
- manual checks performed
- residual risk for missing browser tests, live-service checks, production
  validation, or unobserved remote CI
