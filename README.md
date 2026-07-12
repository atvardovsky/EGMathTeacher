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

The direct dev domain URL uses the local Vite HTTPS certificate. The current
checked-in development certificate is for `localhost`, so browsers can warn
when opening `https://atvardovsky.dev:5137`.

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
- First-login meeting for students before the normal tutor workspace.
- DB-backed student profile memory with knowledge state, learning preferences,
  tutoring-focused psychopedagogical profile, and explanation strategy.
- Specialist AI profile pipeline for first-login onboarding: math knowledge
  diagnostician, psychopedagogical profiler, and teaching strategy planner.
- SQLite-backed background AI worker for delayed learning-signal extraction,
  session summaries, profile refreshes, strategy refreshes, and rare quality
  review after tutor turns.
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
  content hash. Unchanged files are skipped; changed synced files are uploaded
  and the superseded vector-store file is detached.
- Lesson type support for tutor sessions: the API supports meeting, tutor,
  concept, practice, diagnostic, exam strategy, mistake review, visual
  explanation, and reflection modes; the POC web UI exposes tutor, practice,
  level check, and mistake review. Switching the visible lesson mode starts a
  fresh conversation/session boundary, and the API also protects older clients
  by finishing an active session when the lesson type changes.
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
- The first deterministic verified learning loop supports backend-generated
  linear-equation tasks, numeric answer verification, stored attempts, mastery
  evidence, and goal completion from backend proof for that vertical.
- User-visible lesson usage bar shows the signed-in user's own estimated
  daily and per-lesson AI expenses with operation/model/token/image details,
  decision outcomes, verifier status, verified outcome count, and cost per
  verified outcome. Cost estimates come from local pricing configuration; they
  are not provider billing proof.
- Russian/English static web UI locale switch for auth, first meeting, tutor, and admin views.
- Settings view for language, voice input language, account info, and read-only profile memory.
- Stored student profile memory is filtered to teaching-useful signals for
  explanation strategy and avoids sensitive personal details.
- POC SQLite schema migration ledger records applied schema versions after
  transactional migration application.
- Admin upload endpoint for PDF/Markdown/TXT/DOCX/TeX knowledge files.
- Image endpoint for explanatory math diagrams generated from a tutor image
  block prompt and rendered in the same tutor turn after explicit user action.
- Browser voice input using speech recognition, submitted to the same RAG tutor endpoint.
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
```

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
