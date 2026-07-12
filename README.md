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
  `/auth`, `/student-profile`, `/tutor`, `/admin`, `/webrtc`, and `/health` go to the Nest API
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
- Role and operation policy layer for model selection: tutor, onboarding,
  background, quality-review, and image operations can use separate model and
  service-tier settings while keeping OpenAI as the first implemented provider.
- OpenAI-first model provider facade for tutor responses, profile generation,
  images, files, and vector stores; non-OpenAI model providers are stubs for now.
- Tutor endpoint using OpenAI Responses API with `file_search` over OpenAI vector stores.
- Tutor prompts combine shared RAG knowledge with the stored student profile.
- Immediate tutor answers stay synchronous; delayed profile/strategy updates
  are eventually consistent and do not block the student response.
- Russian/English static web UI locale switch for auth, first meeting, tutor, and admin views.
- Settings view for language, voice input language, account info, and read-only profile memory.
- Stored student profile memory is filtered to teaching-useful signals for
  explanation strategy and avoids sensitive personal details.
- POC SQLite schema migration ledger records applied schema versions after
  transactional migration application.
- Admin upload endpoint for PDF/Markdown/TXT/DOCX/TeX knowledge files.
- Image endpoint for explanatory math diagrams.
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
