# EGMathTeacher

POC for an AI math tutor for Russian ЕГЭ preparation. The project imports the
`atvardovsky/voiceAssistant` NestJS/WebRTC base under `apps/api` and adds a
React web client under `apps/web`.

## Run

```bash
npm install
cp apps/api/.env.example apps/api/.env
# edit apps/api/.env and set OPENAI_API_KEY and JWT_SECRET
npm run dev
```

Default URLs:

- Web app: `https://localhost:5137` when `.cert/localhost-*` exists
- Direct dev domain URL on this host: `https://atvardovsky.dev:5137`
- API: `http://localhost:3000`

The Vite dev server prefers `.cert/atvardovsky.dev-key.pem` and
`.cert/atvardovsky.dev-cert.pem` when present, then falls back to
`.cert/localhost-key.pem` and `.cert/localhost-cert.pem`. Because
`atvardovsky.dev` uses HSTS, browsers require a CA-trusted certificate for
`https://atvardovsky.dev:5137`; a self-signed certificate will be blocked.
Keep `.cert/` uncommitted.

Production domain:

- `https://atvardovsky.dev`
- The web client defaults to same-origin API calls in production. Configure a reverse proxy so
  `/auth`, `/student-profile`, `/tutor`, `/admin`, `/usage`, `/webrtc`, and `/health` go to the Nest API
  on port `3000`, and all other paths serve `apps/web/dist`.
- Set `CORS_ORIGINS=https://atvardovsky.dev,https://www.atvardovsky.dev` and
  `AUTH_COOKIE_SECURE=true` for HTTPS production.
- If the API is deployed on a separate host, set `VITE_API_URL` in `apps/web/.env` before
  building the web app.
- Optional reverse-proxy reference configs:
  `deploy/apache-atvardovsky.dev.conf` and `deploy/nginx-atvardovsky.dev.conf`.
  Do not install or reload system web server configuration unless that is the
  explicit deployment task.

## What Is Implemented

- Local registration/login with SQLite and signed HTTP-only cookies.
- First registered user becomes `admin`; later users are `student`.
- Voice-first first-login meeting for students before the normal tutor
  workspace. The AI asks onboarding questions in a `meeting` lesson, the web
  client speaks tutor answers and reopens the mic when browser support allows
  it while the lesson remains non-terminal, and the stored conversation is
  converted into the student profile only after backend meeting-readiness
  checks find enough real teaching context. The technical starter prompt does
  not count as student evidence. After successful profile creation, the
  meeting lesson is closed and moved to history. If the page reloads during an
  unfinished meeting, the client restores the active meeting transcript from
  saved lessons. After setup, the tutor workspace opens with a lesson launcher
  and a green first-lesson button instead of a blank state.
- Saved lesson continuity in the tutor workspace: the client loads
  `GET /tutor/lessons?scope=active` and `GET /tutor/lessons?scope=history`,
  shows active lessons separately from read-only historical records, auto-opens
  the latest active saved discussion when turns exist, and sends the same
  `conversationId` only when the student continues a non-terminal lesson.
  Students can explicitly finish an active lesson with
  `POST /tutor/lessons/:lessonSessionId/finish`; finished and legacy records
  can be opened for review but cannot accept new prompts or image-generation
  actions. If an old client sends `POST /tutor/message` with a finished
  lesson's `conversationId`, the API rejects it and requires a new lesson
  boundary.
- DB-backed student profile memory with knowledge state, learning preferences,
  tutoring-focused psychopedagogical profile, and explanation strategy.
- Specialist AI profile pipeline for first-login onboarding: meeting
  conversation extractor, math knowledge diagnostician, psychopedagogical
  profiler, and teaching strategy planner.
- SQLite-backed background AI worker for delayed learning-signal extraction,
  session summaries, profile refreshes, strategy refreshes, lesson-closure
  conversation review, and rare quality review after tutor turns.
- Optional background batching stores sanitized tutor-turn observations locally
  and sends grouped analysis windows by count, idle timeout, or quality
  trigger instead of calling the signal extractor after every turn. Set
  `AI_BACKGROUND_BATCHING_ENABLED=false` to restore legacy per-turn
  background extraction. Stale running jobs and claimed observations are
  recovered by the worker.
- Role and operation policy layer for model selection: lesson decision, tutor,
  onboarding, background, quality-review, and image operations can use separate
  model and service-tier settings while keeping OpenAI as the first implemented
  provider.
- OpenAI-first model provider facade for tutor responses, profile generation,
  images, files, and vector stores; non-OpenAI model providers are stubs for now.
- Tutor endpoint using OpenAI Responses API with `file_search` over OpenAI vector stores.
- Local knowledge-pack ingestion command for `EGMathTeacher-knowledge-pack-v1.0.zip`:
  structured curriculum/task JSON and JSONL can be imported into SQLite, and
  selected Markdown teaching files can be synced to OpenAI vector stores by
  content hash. Imports now validate required structured files in strict mode,
  support partial mode with warnings, record failed ledgers, soft-retire
  removed structured rows, and store pack schema/release/content-hash
  metadata separately. RAG sync skips unchanged files, uploads changed files,
  detaches superseded source paths only after a replacement has indexed,
  records durable sync jobs, can wait for vector-store indexing, and includes
  a recovery command for failed or attached timeout jobs with recoverable
  OpenAI file ids. Recovery waits for completed indexing by default; queued
  replacements remain pending and do not trigger stale cleanup. Removed-path
  reconciliation is enabled only for strict authoritative RAG sync, not
  partial packs.
- Lesson runtime reads active `curriculum_skills` rows from SQLite and selects
  supported verifier tasks from imported `task_bank_tasks`; unknown,
  low-confidence, or ambiguous topics stay `unknown` with candidate context
  instead of silently falling back to the linear-equation context.
- Lesson type support for tutor sessions: the API supports meeting, tutor,
  concept, practice, diagnostic, exam strategy, mistake review, visual
  explanation, and reflection modes; the POC web UI exposes meeting, tutor,
  practice, level check, and mistake review. When a tutor workspace has no
  turns, it shows a lesson launcher with first meeting, level check, practice,
  topic explanation, and mistake-review choices. Starting a launcher lesson is
  user-triggered, not an automatic model call on page load. Switching the
  visible lesson mode starts a fresh conversation/session boundary, and the
  API also protects older clients by finishing an active session and rejecting
  the reused conversation id when the lesson type changes.
- Lesson finish paths enqueue background closure review so the stored
  conversation can produce a compact session summary and profile/strategy
  hints for teaching the student better. Closure review is queued only after a
  confirmed state transition to a terminal lesson status; repeated finish
  calls or rejected terminal-conversation reuse do not create duplicate or
  premature closure jobs.
- The tutor prompt includes DB-backed continuity context for the active
  conversation, plus recent session summaries, so a resumed lesson can pick up
  from the previous discussion instead of starting from zero. Older saved
  `tutor_turns` without a `lesson_sessions` row are still listed as read-only
  historical records so pre-lifecycle discussions remain visible without
  creating endless resumable conversations.
- Tutor answers return ordered response blocks for text, examples, tasks, and
  optional image plans while preserving legacy `answer`, `tasks`, `examples`,
  `needsImage`, and `imagePrompt` fields.
- Tutor prompts combine shared RAG knowledge with the stored student profile.
- Immediate tutor answers stay synchronous; delayed profile/strategy updates
  are eventually consistent and do not block the student response.
- Background analysis stores layered session evidence and skill trends:
  compact session summaries, learning signals, and progress/regression rows
  by topic and skill are kept in SQLite for future explanation strategy.
- Lesson lifecycle tracking records active lesson sessions, configurable daily
  and continuous learning-time limits, goal status, decision-policy results,
  and effectiveness signals. The Lesson Decision Agent proposes teaching
  actions, but backend policy controls goal completion; self-reported phrases
  such as "я понял" are not accepted as mastery evidence.
- The first deterministic verified learning loop supports task-bank-backed
  linear-equation tasks, canonical source task identity, numeric answer
  verification, stored attempts, misconception-aware hint routing, and
  mastery-policy-gated evidence. A correct answer is stored as an attempt
  first; mastery evidence, progress updates, and goal completion are written
  only when imported `curriculum_mastery_criteria` allow it. Independent
  success counts are cumulative across lesson sessions but are deduplicated by
  `source_task_id`, so repeated copies of the same task do not prove mastery.
- User-visible lesson usage bar shows the signed-in user's own estimated
  daily and per-lesson AI expenses with operation/model/token/image details,
  decision outcomes, verifier status, verified outcome count, and cost per
  verified outcome. Cost estimates come from local pricing configuration; they
  are not provider billing proof. When pricing is not configured, the UI shows
  token/image counts plus an explicit missing-pricing state instead of
  pretending the zero is a real billable cost.
- Expanded usage details also show recent safe background job status, compact
  sanitized result previews, and stored failure messages for the signed-in
  user. The usage panel has a manual refresh action, a retry-one action for
  visible failed background jobs, and polls the safe summary endpoint while
  details are open or background jobs are still pending/running.
- Russian/English static web UI locale switch for auth, first meeting, tutor, and admin views.
- Settings view for language, voice input language, account info, and read-only profile memory.
- Stored student profile memory is filtered to teaching-useful signals for
  explanation strategy and avoids sensitive personal details.
- POC SQLite schema migration ledger records applied schema versions after
  transactional migration application.
- Admin upload endpoint for PDF/Markdown/TXT/DOCX/TeX knowledge files.
- Image endpoint for explanatory math diagrams generated from a tutor image
  block prompt. Fresh required image blocks can trigger one automatic
  generation after the text answer is visible; saved turns and optional blocks
  keep an explicit create-diagram action. Generated POC data URLs are rendered
  and persisted inside the same tutor turn.
- Browser voice input using speech recognition, submitted to the same RAG tutor endpoint.
- Browser voice output using local speech synthesis in the tutor workspace.
  Voice dialog is on by default when supported, can be switched off by the
  student, speaks tutor answers, then automatically opens the mic for the next
  student turn only when the lesson lifecycle is still non-terminal. Terminal
  answers such as goal completion or hard-limit stops clear the active
  conversation boundary and do not restart speech recognition. Each tutor
  answer has a speak/stop control. This does not call OpenAI audio APIs or
  store generated audio, so Russian stress/emotion quality remains limited by
  the installed browser voices. Browser speech recognition
  can still stop after silence, permission/device issues, or network/browser
  policy; the web UI shows the stop reason and retries once after an automatic
  silence stop in voice-dialog mode. Short uncertain voice fragments without
  math or lesson intent are placed back into the composer for confirmation
  instead of being sent as a lesson request.
- Imported WebRTC/Realtime voice service remains available under `/webrtc`.

## Checks

```bash
npm run build
npm test
npm run lint
npm run e2e
npm run diagrams:check
npm run alatyr:check
```

Knowledge-pack import defaults to local SQLite only. Add `--sync-rag` only
when `OPENAI_API_KEY` is configured and live OpenAI file/vector-store writes
are intended:

```bash
npm run knowledge:sync -- --pack ./EGMathTeacher-knowledge-pack-v1.0.zip --import-db
npm run knowledge:sync -- --pack ./EGMathTeacher-knowledge-pack-v1.0.zip --import-db --sync-rag
npm run knowledge:sync -- --pack ./EGMathTeacher-knowledge-pack-v1.0.zip --sync-rag --dry-run
npm run knowledge:sync -- --pack ./EGMathTeacher-knowledge-pack-v1.0.zip --sync-rag --partial --no-reconcile-rag
npm run knowledge:sync -- --recover-rag --wait-ready
```

Knowledge-pack sync remains a trusted local operator workflow. Non-dry-run
`--sync-rag` can create, upload, attach, and detach OpenAI files/vector-store
attachments, so run it only with explicit intent and configured credentials.
When launched through the root `npm run knowledge:sync` script, the CLI reads
`apps/api/.env` and uses the runtime SQLite database at
`apps/api/data/app.sqlite` unless `SQLITE_PATH` is explicitly set.
Partial RAG packs do not reconcile removed paths; use strict authoritative
sync when the current pack should define the complete vector-store file set.

GitHub Actions CI is defined in `.github/workflows/ci.yml` and runs install,
build, tests, lint, mocked browser E2E, diagram drift checks, and Alatyr
adapter consistency checks.

When the dev stack is already running, smoke-check the web/API route:

```bash
npm run smoke:dev
```

## Diagrams

Render Alatyr Mermaid diagrams to SVG:

```bash
npm run diagrams:render
```

Output is written to `.ai/project/diagrams/rendered`.
Check that rendered SVGs match the Mermaid sources:

```bash
npm run diagrams:check
```
