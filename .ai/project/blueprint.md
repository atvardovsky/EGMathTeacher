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
- Tutor messages can be associated with a lesson type. The API supports
  `meeting`, `tutor`, `concept`, `practice`, `diagnostic`, `exam_strategy`,
  `mistake_review`, `visual_explanation`, and `reflection`; the POC tutor UI
  exposes tutor, practice, diagnostic, and mistake-review modes and the API
  infers a safe default for older clients. Switching the lesson mode in the
  UI starts a new conversation boundary, and the API finishes any active
  session if an older client sends a different lesson type for the same
  conversation id.
- Tutor turns are attached to a lesson session with a goal, success criteria,
  goal status, active-learning time, daily/continuous learning-limit status,
  and a progress/regression strategy signal. The POC uses configurable
  educational time-limit heuristics, not clinical fatigue diagnosis.
- Tutor turns run through a Lesson Decision Agent before final answer
  generation. The decision agent selects allowed teaching actions such as
  requesting an attempt, changing explanation strategy, suggesting visual
  support, or proposing goal completion. Backend policy accepts or rejects
  every proposed durable state change. The decision path can be disabled with
  `AI_LESSON_DECISION_ENABLED=false` and has a local fallback after
  `AI_LESSON_DECISION_TIMEOUT_MS`.
- A lesson can stop when a hard learning limit is reached or when backend
  policy accepts a goal-completion proposal with enough evidence for the
  lesson type. A raw LLM `goalStatus=reached` or a self-reported phrase such
  as "я понял" remains pending unless backend policy accepted completion.
  Soft limits ask the tutor to wrap up the current step instead of starting a
  long new topic.
- A first deterministic verified learning loop exists for one vertical:
  `algebra.linear.solve_one_variable` /
  `ege.base.linear_equation_numeric`. The backend resolves curriculum from
  active SQLite rows, selects imported task-bank tasks for the supported
  verifier kind when available, carries task-bank hint ladders into lesson
  tasks, verifies submitted numeric answers, and stores attempts. Imported
  `curriculum_mastery_criteria` gate whether verified attempts may write
  mastery evidence, update skill progress, or complete practice/mistake-review
  goals. Unknown topics remain `unknown` instead of falling back to linear
  equations.
- Structured tutor answers with ordered response blocks for text, task cards,
  example cards, citations when RAG returns file references, and optional
  image blocks carrying prompt, caption, alt text, status, and priority.
- Structured tutor answers include lesson lifecycle state and a compact usage
  snapshot for the current lesson/day.
- Static web UI text supports Russian and English locale switching across
  auth, first meeting, tutor, and admin views.
- Authenticated users can open a settings view for language, voice input
  language, account info, and read-only DB-backed learning profile memory,
  including recent session summaries and skill progress/regression signals.
- Authenticated users can see their own lesson usage bar in the tutor
  workspace, including today's estimate, current lesson estimate, and expanded
  operation/model/token/image details. The expanded bar also shows
  action-level Lesson Decision Agent outcomes, verifier result, evidence
  level, fallback marker, latency, verified learning outcome count, and local
  cost per verified outcome when mastery evidence exists.
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
  signal extraction and split profile/strategy refresh jobs. Interrupted
  `queued` observations and stale `running` jobs are recovered by the worker.
- Background analysis stores layered teaching evidence: L0 raw turn data in
  `tutor_turns`, L1 sanitized observations in
  `background_learning_observations`, L2 session summaries in
  `student_session_summaries`, L3 learning signals in
  `student_learning_signals`, L4 skill progress/regression rows in
  `student_skill_progress`, and L5 strategy hints consumed by profile/strategy
  refresh jobs.
- Lesson effectiveness signals store goal status, answer shape, and the
  current strategy adjustment recommendation so scoped progress/regression
  rows for the current conversation, lesson type, or topic hint can change how
  later explanations are framed without letting unrelated topics dominate the
  current strategy.
- Lesson decision observability stores each proposed action, backend policy
  result, acceptance/rejection reason, evidence level, verifier result when
  available, latency, model, local usage correlation id, fallback marker,
  profile-delta routing marker, and outcome in `lesson_decisions`. Stored
  decision JSON is sanitized.
- Background assistant calls use the model-provider facade and can request
  lower-cost OpenAI Flex processing through operation-level service-tier
  policy when using the OpenAI provider.
- Model-provider operation calls can write a local usage ledger for the
  signed-in user when usage context is present. The ledger stores provider,
  model, operation, assistant role, token/image counts, and locally estimated
  USD cost plus a local correlation id; it does not store raw prompts, hidden
  instructions, provider request ids, or billing credentials.
- Tutor, onboarding, background, quality-review, and image calls resolve
  model settings through role/operation policy before reaching the provider,
  so each assistant role can be tuned independently while provider support
  remains OpenAI-first in the current POC.
- Admin-only upload of PDF, Markdown, TXT, DOCX, and TeX knowledge files.
- Local knowledge-pack ingestion command for uncommitted EGMathTeacher
  knowledge-pack zip or extracted directory. Structured curriculum, task-bank,
  misconception, and lesson-plan JSON/JSONL are imported into SQLite.
  Student-facing Markdown files can be synced to OpenAI vector stores with
  source-path/content-hash idempotency: unchanged files are skipped, changed
  synced files are uploaded and the superseded vector-store attachment is
  detached. Removed source paths are reconciled only for strict authoritative
  RAG sync, not partial packs. Strict mode validates canonical structured
  files before writes; partial mode records warnings.
  Failed imports are ledgered, pack schema/release/content-hash metadata is
  separated, structured rows can be soft-retired, sync jobs are recoverable,
  `--wait-ready` can poll vector-store indexing and marks jobs indexed only
  after remote completion, and archive guardrails bound local pack processing.
  Dry-run RAG sync performs no OpenAI
  create/upload/attach/delete calls.
- OpenAI vector store/file search integration for RAG.
- OpenAI image generation for explanatory math diagrams.
- Image generation remains asynchronous and explicit; generated images render
  inside the same tutor turn after the text/blocks response is already shown.
- Imported WebRTC/Realtime voice assistant under `/webrtc`.

## Architecture

- Root npm workspace:
  - `apps/api`: NestJS API.
  - `apps/web`: React/Vite web app.
- API modules:
  - `AuthModule`: local users, roles, signed session cookies.
  - `DatabaseModule`: SQLite storage and table initialization.
- `LessonModule`: lesson session lifecycle, goal status, learning-time
    heuristics, Lesson Decision Agent orchestration, backend action policy,
    curriculum resolution, deterministic verifier V1, decision observability,
    and effectiveness-signal storage.
  - `UsageModule`: authenticated user usage summaries backed by the local AI
    usage ledger.
  - `StudentProfileModule`: first-login profile creation, profile status, and
    stored tutoring strategy memory.
  - `BackgroundAiModule`: SQLite-backed background AI job queue for post-turn
    learning observations, grouped learning-window analysis, summaries,
    profile/strategy refresh, and quality review. Legacy per-turn extraction
    is still available through configuration.
  - `TutorModule`: RAG tutor response and image generation endpoints.
  - `KnowledgeModule`: admin file upload, local knowledge-pack structured
    import, idempotent RAG sync, vector store status, and local project vector
    store id persistence.
  - `WebRtcModule`: inherited voice assistant/WebRTC bridge.
  - `OpenAiClientModule`: OpenAI REST client for Responses, images, files,
    and vector stores.
  - `AiModelModule`: OpenAI-first model provider facade used by profile,
    tutor, image, background, and knowledge flows, plus role/operation model
    policy; non-OpenAI model providers are stubs until implemented.
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
- `student_session_summaries`: compact per-session summaries and explicit
  evidence-level JSON for future teaching strategy.
- `student_skill_progress`: topic/skill trend rows recording progress,
  regression, stability, support needed, independence, and evidence.
- `lesson_sessions`: active and completed lesson sessions with goal status,
  configurable learning-limit state, turn count, and active-learning seconds.
- `lesson_effectiveness_signals`: teaching-only signals about goal status,
  answer shape, and strategy adjustment recommendations.
- `lesson_decisions`: per-action Lesson Decision Agent and backend policy
  observability rows.
- `project_ai_resources`: durable local ids for project-level external AI
  resources such as the active student RAG vector store when env ids are not
  configured.
- `knowledge_source_files` and `knowledge_pack_imports`: local knowledge-pack
  import/sync hash ledger.
- `curriculum_topics`, `curriculum_task_types`, `curriculum_skills`,
  `curriculum_prerequisite_edges`, `curriculum_mastery_criteria`,
  `curriculum_misconceptions`, `error_classification_entries`,
  `lesson_type_plans`, and `task_bank_tasks`: imported structured
  knowledge-pack curriculum/task metadata used by the active lesson resolver
  and supported task selection. Runtime verified mastery is still implemented
  only for the existing linear-equation numeric vertical.
- `lesson_tasks`: backend-generated or imported tasks tied to a lesson
  session and curriculum skill, including task-bank hint ladders when present.
- `student_attempts`: submitted answers, deterministic verifier results, and
  mastery-policy outcome JSON.
- `mastery_evidence`: proof rows for policy-accepted verified learning
  outcomes.
- `ai_usage_ledger`: per-operation model usage records for signed-in users,
  including operation, assistant role, model, token/image counts, local cost
  estimate, pricing source, and local correlation id.
- `student_learning_signals`: sanitized teaching-useful learning signals,
  session summaries, profile-refresh evidence, strategy-refresh evidence, and
  quality-review records.
- `schema_migrations`: applied POC SQLite schema migration versions and
  timestamps.
- `knowledge_files`: local metadata for OpenAI file and vector store records.
- `tutor_turns`: user prompt, conversation id, lesson type, answer JSON, and
  timestamp.

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
