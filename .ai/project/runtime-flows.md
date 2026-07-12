# EGMathTeacher Runtime Flows

This file records runtime flows from current source evidence.

## Development Startup

1. User runs `npm run dev` from the repository root.
2. `concurrently` starts:
   - `npm run start:dev --workspace @egmathteacher/api`
   - `npm run dev --workspace @egmathteacher/web`
3. API listens on `PORT` from env or `3000`.
4. Web dev server listens on `5137`.
5. If `.cert/localhost-key.pem` and `.cert/localhost-cert.pem` exist, Vite
   serves HTTPS at `https://localhost:5137`.
6. Vite proxies `/auth`, `/student-profile`, `/tutor`, `/admin`, `/usage`,
   `/webrtc`, and `/health` to the API on `127.0.0.1:3000`.

## SQLite Schema Initialization Flow

1. `DatabaseService` opens the configured SQLite file and enables WAL plus
   foreign keys.
2. It creates `schema_migrations` when missing.
3. It applies each pending migration inside a local SQLite transaction.
4. Table-rebuild migrations temporarily disable foreign-key enforcement before
   the transaction, run `PRAGMA foreign_key_check` before commit, and re-enable
   foreign keys afterward.
5. It records the applied migration version and timestamp in
   `schema_migrations` only after the migration body succeeds.

## Auth Flow

1. Web client initializes static UI locale from `localStorage` or browser
   language and can switch between Russian and English locally.
2. Web client checks `GET /auth/me`.
3. User submits login or registration form.
4. API validates name/password.
5. Registration creates a SQLite user with role:
   - first user: `admin`
   - later users: `student`
6. API signs a session token and sets an HTTP-only cookie.
7. Authenticated API guards read the cookie and attach `request.user`.

## First-Login Student Profile Flow

1. After auth, the web client calls `GET /student-profile/me`.
2. If the authenticated user is a student without a stored profile, the web
   client shows the first meeting instead of the normal tutor workspace.
3. The first meeting gathers tutoring-relevant context:
   - exam and target score
   - current math confidence and emotional relation to math
   - weak topics and short diagnostic answers
   - explanation style, pacing, hint/practice preference, visual preference,
     and interests for analogies
4. The web client submits answers to `PUT /student-profile/me`.
5. `StudentProfileService` normalizes answers, drops non-teaching sensitive
   details, and reads active vector store ids.
6. `AiModelService` resolves role/operation policy and runs three specialist
   model calls:
   - math knowledge diagnostician creates `knowledgeState`
   - tutoring-focused psychopedagogical profiler creates `learningPreferences`
     and `psychologicalProfile`
   - teaching strategy planner creates `explanationStrategy` and compact
     `aiSummary`
7. Specialist prompts ask for confidence and evidence for meaningful profile
   inferences when possible.
8. RAG is used only for shared AI knowledge such as questionnaire strategy,
   diagnostic rubrics, task strategy, and teaching playbooks.
9. SQLite stores only teaching-useful personal profile signals in
   `student_profiles`.
10. Future tutor requests reload the DB profile so context compaction does not
   erase who the AI is speaking with.

## Tutor Message Flow

1. Authenticated user submits text or browser speech-recognition text.
2. Web client calls `POST /tutor/message` with:
   - `message`
   - optional `conversationId`
   - source `text` or `voice`
   - optional `lessonType`
3. `TutorService` normalizes the message, conversation id, and lesson type.
   If lesson type is omitted, it infers a conservative default from the
   prompt.
4. `LessonService` creates or touches the active `lesson_sessions` row for the
   conversation and lesson type. If an older client reuses a conversation id
   with a different lesson type, the previous active session is finished and a
   new session is created. The first turn adds no active-learning seconds; later
   quick turns use the configured minimum-turn heuristic. The service updates
   turn count, active-learning heuristic seconds, daily and continuous
   learning-limit state, goal status, and the current scoped
   progress/regression strategy signal.
5. If a hard daily or continuous learning limit is reached, `TutorService`
   returns a local stop response, persists the tutor turn, and does not call
   the model for a new explanation.
6. `StudentProfileService` loads the stored student profile summary and
   explanation strategy when available.
7. `KnowledgeService` returns configured or uploaded vector store ids.
8. `TutorService` builds a model-provider request:
   - Russian ЕГЭ tutor instructions
   - user name
   - source type
   - lesson type description, goal, and preferred block mix
   - lesson lifecycle state, goal criteria, learning-limit state, and
     progress/regression strategy signal
   - optional DB-backed student profile context
   - user prompt
   - optional `file_search` tool
   - local-only usage context for user, conversation, lesson session, and
     lesson type
9. `AiModelService` resolves the `tutorAnswer` or `tutorAnswerWithRag`
   operation policy, including model, metadata, and optional service tier.
10. The current OpenAI-backed provider calls Responses API.
11. After the provider returns, `AiModelService` strips local usage context
    from provider payloads and writes `ai_usage_ledger` when usage context is
    present.
12. API parses model output as structured tutor JSON when possible. The
   preferred response contract is an ordered `blocks` array containing text,
   task, example, and image blocks. Legacy `answer`, `tasks`, `examples`,
   `needsImage`, and `imagePrompt` fields remain populated for compatibility.
   The preferred contract also includes `lessonLifecycle.goalStatus` so the
   model can suggest that the lesson goal is reached or blocked.
13. API extracts citations from file-search annotations/results.
14. `LessonService` completes the turn, stores a lesson effectiveness signal,
    and accepts goal completion only when backend-visible student evidence
    supports the model suggestion. Otherwise `goalStatus=reached` remains a
    pending model suggestion and the lesson stays in progress.
15. API writes the tutor turn and lesson type to `tutor_turns`.
16. API enqueues background AI work. In batched mode, it stores a sanitized
    tutor-turn observation with lesson type and schedules or reschedules a grouped
    `learning_window_analysis` job. In legacy mode, it enqueues per-turn
    learning-signal extraction and separate interval jobs for session summary,
    student profile refresh, teaching strategy refresh, or rare quality review.
    Enqueue failures are isolated from the immediate answer path.
17. API returns the tutor answer with lesson lifecycle and a compact usage
    snapshot for current lesson/day.
18. Web client refreshes `GET /usage/me/summary`, renders the usage bar, then
    renders ordered response blocks, lesson-type badge, citations, and
    optional image actions inside the same tutor turn.

## Background AI Flow

1. `BackgroundAiService` stores queued jobs in `background_ai_jobs`.
2. The in-process worker drains pending jobs on
   `AI_BACKGROUND_DRAIN_INTERVAL_MS`.
3. Before each drain, stale `queued` observations are returned to `pending`;
   stale `running` jobs older than `AI_BACKGROUND_RUNNING_JOB_TIMEOUT_MS` are
   either requeued when attempts remain or marked `failed` when attempts are
   exhausted.
4. When `AI_BACKGROUND_BATCHING_ENABLED=true`, each tutor turn stores a
   sanitized row in `background_learning_observations`. A grouped
   `learning_window_analysis` job is scheduled after
   `AI_BACKGROUND_OBSERVATION_IDLE_FLUSH_MS`, pulled forward when
   `AI_BACKGROUND_OBSERVATION_WINDOW_SIZE` pending observations are reached,
   or run immediately for a quality trigger.
5. The grouped learning-window job marks selected observations `queued`,
   sends them together, stores `background_analysis_windows`, writes
   `student_learning_signals`, writes `student_session_summaries`, writes
   `student_skill_progress` trend rows, and marks the observations
   `processed` in one local SQLite transaction after the model response
   succeeds. If the model call fails, claimed observations return to
   `pending`.
6. A successful grouped learning-window job can enqueue one
   `profile_strategy_refresh` job when the configured profile refresh turn
   interval is reached.
7. Background jobs call `AiModelService` with role/operation policy and
   task-specific specialist prompts: `learning-window-analyzer`,
   `profile-strategy-background-refresher`, `learning-signal-extractor`,
   `session-summarizer`, `student-profile-background-refresher`,
   `teaching-strategy-background-planner`, and
   `tutor-quality-background-reviewer`.
8. When the OpenAI provider is used, background operation service-tier policy
   can include `service_tier=flex`; per-operation tier overrides fall back to
   `OPENAI_BACKGROUND_SERVICE_TIER`.
9. Background jobs include user/conversation usage context, and lesson-session
   context when it was captured from the tutor turn or grouped observation, so
   delayed background costs can appear in the same usage ledger.
10. Batched background calls can include a hashed `prompt_cache_key` when
   `AI_BACKGROUND_PROMPT_CACHE_KEY_ENABLED=true`.
11. Layered learning memory is stored as:
    - L0 limited raw turn data in `tutor_turns`
    - L1 sanitized observations in `background_learning_observations`
    - L2 session summaries in `student_session_summaries`
    - L3 learning signals, refresh evidence, and quality reviews in
      `student_learning_signals`
    - L4 topic/skill progress or regression in `student_skill_progress`
    - L5 strategy hints consumed by profile/strategy refresh jobs
12. Profile refresh jobs merge sanitized patches into `student_profiles` using
    recent learning signals, session summaries, and skill progress rows.
13. Failed jobs are retried up to `AI_BACKGROUND_MAX_ATTEMPTS`; final failures
   stay visible in `background_ai_jobs`.
14. Background work must not store non-teaching sensitive details and must not
   block the current tutor response.

## Tutor Image Flow

1. Tutor response includes an image block with prompt, caption, alt text,
   status, and priority, or legacy `needsImage=true` plus `imagePrompt`.
2. User clicks image generation in the web client. The current POC keeps image
   generation explicit instead of blocking the immediate tutor response.
3. Web client calls `POST /tutor/image` with prompt/context plus optional
   conversation id, lesson session id, and lesson type for usage attribution.
4. API calls the `tutorImage` model-provider operation. The current
   implementation resolves the image operation model policy, then delegates to
   OpenAI image generation using configured size and quality.
5. `AiModelService` writes image usage to `ai_usage_ledger` when user and
   lesson context are present.
6. API returns a PNG data URL and optional usage snapshot.
7. Web client refreshes usage and renders the generated image in the same tutor turn and image
   block where the visual was requested.

## Usage Summary Flow

1. Authenticated web client calls `GET /usage/me/summary`, optionally with
   `lessonSessionId`.
2. `AuthGuard` attaches the signed-in user.
3. `UsageService` reads only rows in `ai_usage_ledger` for that user.
4. The response includes:
   - today's total usage
   - current lesson total when a lesson session exists
   - recent lesson summaries
   - per-operation details for the selected/current lesson
5. The web tutor workspace renders a compact user-visible usage bar and an
   expanded table with operation, assistant role, model, service tier, token
   counts, image counts, and local estimated cost.
6. Usage summaries do not expose raw prompts, hidden instructions, RAG chunks,
   provider request ids, secrets, stack traces, or another user's rows.

## Settings Flow

1. Authenticated user opens the settings view from the app shell.
2. Web client renders local interface settings:
   - Russian/English language switch
   - current browser speech-recognition language derived from selected locale
3. Web client renders current account facts from the existing auth session:
   user name, role, and creation timestamp.
4. If a stored student profile exists, the web client renders read-only
   profile memory from the already loaded `GET /student-profile/me` response:
   AI summary, first-meeting answers, knowledge state, learning preferences,
   teaching hypotheses, explanation strategy, recent session summaries, and
   skill progress/regression rows.
5. Settings does not edit account data or regenerate the AI profile in the
   current POC.

## Knowledge Upload Flow

1. Admin opens the knowledge screen.
2. Web client calls `GET /admin/knowledge/status`.
3. Admin uploads a supported file to `POST /admin/knowledge/files`.
4. API rejects empty files or unsupported extensions.
5. API uses an existing vector store id or creates `EGMathTeacher ЕГЭ
   knowledge` through the model provider.
6. API uploads the file through the model provider.
7. API attaches the file to the vector store through the model provider.
8. API stores local metadata in `knowledge_files`.
9. Status refresh can query vector store file status and update local metadata.

## WebRTC Flow

The inherited WebRTC service lives under `/webrtc`.

High-level flow:

1. Client creates session with `POST /webrtc/session`.
2. API creates in-memory WebRTC session and conversation state.
3. Client can request a realtime token with
   `POST /webrtc/session/:sessionId/token`.
4. Client submits SDP offer to `POST /webrtc/session/:sessionId/offer`.
5. API media bridge negotiates with OpenAI Realtime and returns SDP answer.
6. ICE candidates can be queued or drained through the documented endpoints.
7. Provider events update conversation transcript state.
8. Session close finalizes transcript text and writes transcript file when
   available.

Detailed WebRTC endpoint behavior is owned by `apps/api/docs/webrtc-module.md`
and `apps/api/src/webrtc`.

## Production Routing Flow

The production routing pattern is documented, but system state is not source
truth inside this repository.

Expected reference shape:

1. Built web files are served from `apps/web/dist`.
2. API runs on `127.0.0.1:3000`.
3. Reverse proxy routes `/auth`, `/student-profile`, `/tutor`, `/admin`,
   `/usage`, `/webrtc`, and `/health` to the API.
4. Other paths serve the web app for client-side routing.

Do not modify or reload system web server configuration unless explicitly
requested.

## Error And Gap Notes

- OpenAI API calls fail when `OPENAI_API_KEY` is not configured.
- Non-OpenAI text/RAG/image/file model providers are configured as stubs until
  their provider contracts are implemented.
- OpenAI Realtime file-search ids are logged as unsupported by the current
  Realtime REST path.
- Gemini Live, Hume EVI, and Retell providers are stubs.
- Browser speech recognition depends on browser support.
- WebRTC audio support depends on the installed `wrtc` build.
- No retry/idempotency contract for knowledge upload is documented.
