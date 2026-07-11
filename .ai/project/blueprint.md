# EGMathTeacher Blueprint

This is the assistant-facing blueprint for accepted project facts. It is
derived from repository evidence at installation time.

## Product

EGMathTeacher is a proof of concept browser-based app with a desktop-style
layout for an AI math tutor focused on Russian ЕГЭ preparation. No packaged
desktop runtime was found in the repository. The current implementation is a
React/Vite browser client plus NestJS API, with development HTTPS available at
`https://localhost:5137`.

The intended learner audience is teenagers around 14-16 years old. UI changes
should favor clear language, predictable controls, low cognitive load, and
visible next actions.

## Current Capabilities

- Registration and login with name/password.
- The first registered user becomes `admin`; later users become `student`.
- Signed HTTP-only cookie sessions.
- First-login student meeting that gathers learning, motivation, confidence,
  weak-topic, diagnostic, and explanation-preference signals before the normal
  tutor workspace.
- Specialist AI profile pipeline for first-login onboarding:
  math knowledge diagnostician, tutoring-focused psychopedagogical profiler,
  and teaching strategy planner.
- DB-backed student profile memory with onboarding answers, knowledge state,
  learning preferences, tutoring-focused psychopedagogical profile, explanation
  strategy, and compact AI summary.
- Student profile memory is filtered to teaching-useful signals; sensitive
  family, health, clinical, political, religious, and other non-teaching
  personal details must not be stored or used for tutoring strategy.
- Tutor messages submitted from text or browser voice recognition.
- Structured tutor answers with explanation text, task cards, example cards,
  citations when RAG returns file references, and optional image prompts.
- Static web UI text supports Russian and English locale switching across
  auth, first meeting, tutor, and admin views.
- Authenticated users can open a settings view for language, voice input
  language, account info, and read-only DB-backed learning profile memory.
- Tutor prompts include the stored student profile summary when available so
  explanations adapt to the teenager across compacted sessions.
- Tutor turns enqueue delayed background AI work for learning-signal
  extraction, session summaries, student profile refreshes, teaching strategy
  refreshes, and rare quality review. These updates are eventually consistent
  and do not block the immediate tutor answer.
- Optional background batching stores sanitized tutor-turn observations in
  SQLite and sends grouped learning-window analysis after a configured
  observation count, idle timeout, or quality trigger. When batching is
  enabled, profile and strategy refresh use one combined background job where
  logical. `AI_BACKGROUND_BATCHING_ENABLED=false` restores legacy per-turn
  signal extraction and split profile/strategy refresh jobs.
- Background assistant calls use the model-provider facade and can request
  lower-cost OpenAI Flex processing through `service_tier=flex` when using
  the OpenAI provider.
- Admin-only upload of PDF, Markdown, TXT, DOCX, and TeX knowledge files.
- OpenAI vector store/file search integration for RAG.
- OpenAI image generation for explanatory math diagrams.
- Imported WebRTC/Realtime voice assistant under `/webrtc`.

## Architecture

- Root npm workspace:
  - `apps/api`: NestJS API.
  - `apps/web`: React/Vite web app.
- API modules:
  - `AuthModule`: local users, roles, signed session cookies.
  - `DatabaseModule`: SQLite storage and table initialization.
  - `StudentProfileModule`: first-login profile creation, profile status, and
    stored tutoring strategy memory.
  - `BackgroundAiModule`: SQLite-backed background AI job queue for post-turn
    learning observations, grouped learning-window analysis, summaries,
    profile/strategy refresh, and quality review. Legacy per-turn extraction
    is still available through configuration.
  - `TutorModule`: RAG tutor response and image generation endpoints.
  - `KnowledgeModule`: admin file upload and vector store status.
  - `WebRtcModule`: inherited voice assistant/WebRTC bridge.
  - `OpenAiClientModule`: OpenAI REST client for Responses, images, files,
    and vector stores.
  - `AiModelModule`: OpenAI-first model provider facade used by profile,
    tutor, image, and knowledge flows; non-OpenAI model providers are stubs
    until implemented.
  - `HealthModule`: `/health` endpoint.
- Web client:
  - Mantine UI components.
  - lucide icons.
  - Local Russian/English UI dictionary in `apps/web/src/i18n.ts`.
- Vite dev server on port `5137`; the development host allowlist includes
  `localhost`, `atvardovsky.dev`, `www.atvardovsky.dev`, and
  `193.34.144.203`.
  - Same-origin API calls by default; Vite proxies API paths to port `3000`
    in development.

## Data Model

SQLite tables are initialized in `apps/api/src/database/database.service.ts`:

- `users`: id, name, password hash, role, created timestamp.
- `student_profiles`: per-user onboarding answers, knowledge state, learning
  preferences, tutoring-focused psychopedagogical profile, explanation
  strategy, AI summary, and timestamps.
- `background_ai_jobs`: queued background assistant jobs, status, attempts,
  payload, result, error, and timestamps.
- `background_learning_observations`: sanitized tutor-turn observations stored
  before grouped background analysis.
- `background_analysis_windows`: durable records of grouped observation-window
  analyses and their source job.
- `student_learning_signals`: sanitized teaching-useful learning signals,
  session summaries, profile-refresh evidence, strategy-refresh evidence, and
  quality-review records.
- `schema_migrations`: applied POC SQLite schema migration versions and
  timestamps.
- `knowledge_files`: local metadata for OpenAI file and vector store records.
- `tutor_turns`: user prompt, conversation id, answer JSON, timestamp.

OpenAI stores remote files, vector stores, generated model responses, realtime
session data, and image generation outputs. Those external objects are not
local source of truth.

## External Boundaries

- AI model provider facade for tutor answers, first-login student profile
  generation, background assistant jobs, explanatory images, files, and vector
  stores.
- OpenAI is the only implemented model provider in the current POC.
- OpenAI Responses API for tutor answers, specialist profile generation, and
  background assistant jobs when the OpenAI provider is configured.
- OpenAI Images API for explanatory diagrams.
- OpenAI Files and Vector Stores API for RAG knowledge.
- OpenAI Realtime API for WebRTC voice sessions.
- Browser speech recognition API for local voice input in the web client.
- Optional STUN/TURN endpoints configured through `WEBRTC_ICE_SERVERS`.

No assistant should call live external services unless the task requires it and
the user has provided or approved valid credentials for that action.

## Validation

Discovered target commands:

- `npm run build`: build all workspaces.
- `npm test`: run API Jest tests.
- `npm run lint`: run API ESLint.
- `npm run e2e`: run Playwright browser E2E against mocked API routes and
  headless Chromium.
- `npm run dev`: start API and web dev servers.
- `npm run diagrams:render`: render Mermaid diagram SVG artifacts.
- `npm run diagrams:check`: check rendered diagram SVG drift.
- `npm run smoke:dev`: smoke-check a running dev web/API route.
- `npm run alatyr:check`: check adapter-required files, validation scripts,
  CODEOWNERS, CI wiring, and diagram source-hash manifest.
- `.github/workflows/ci.yml`: GitHub Actions workflow for install, build,
  tests, lint, browser E2E, diagram drift checks, and Alatyr adapter checks.

Browser UI has a mocked Playwright E2E smoke suite for auth/localization,
first meeting, tutor answer rendering, and explicit image rendering.

## Documentation Sync

When project facts change, update the smallest coherent set among:

- `README.md`
- `.ai/project/README.md`
- `.ai/project/blueprint.md`
- `.ai/project/contour.md`
- `.ai/project/context-map.md`
- `.ai/project/source-of-truth-registry.md`
- `.ai/project/use-cases.md`
- `.ai/project/architecture.md`
- `.ai/project/runtime-flows.md`
- `.ai/project/data-model.md`
- `.ai/project/validation.md`
- `.ai/project/security-safety.md`
- `.ai/project/guards.md`
- `.ai/project/diagrams.md`
- `apps/api/README.md`
- `apps/api/docs/webrtc-module.md`
- `apps/api/Agent.md`
- package/env examples
- relevant tests

When assistant workflows, gates, or Alatyr usage change, update
`.ai/assistant` and root bridge files instead.
