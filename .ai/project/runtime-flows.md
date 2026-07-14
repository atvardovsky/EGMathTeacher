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
3. The first meeting is a voice-oriented app surface, not a multi-step form.
   The student clicks a green start button, and the web client sends a
   user-triggered starter prompt to `POST /tutor/message` with
   `lessonType=meeting`.
4. Browser speech synthesis speaks visible tutor answers when available; in
   voice-dialog mode the mic reopens after the tutor finishes speaking only
   while the meeting lifecycle is non-terminal.
   Browser text input remains a fallback for unavailable or stopped speech
   recognition.
   If a meeting response is terminal, the web client clears the active
   conversation boundary, disables manual voice/text input for that meeting,
   shows the transcript as finished, and keeps only the create-profile and
   start-new-meeting actions.
5. The meeting gathers tutoring-relevant context through the AI dialog:
   exam/goal context, current math confidence and emotional relation to math,
   weak topics, explanation style, pacing, hint/practice/visual preference,
   interests for analogies, and at least one short diagnostic or learning
   situation when the dialog reaches that point.
6. On first-meeting initialization and after stored meeting answers, the web
   client calls `GET /student-profile/me/meeting-readiness`. The API reads
   stored `meeting` turns, ignores the technical starter prompt, and requires
   at least three meaningful student replies with preparation goal,
   self-assessment, weak topic, explanation preference, and a diagnostic or
   contentful math reply before profile creation is allowed.
7. If the page reloads during an unfinished meeting, the web client hydrates
   the latest active saved `meeting` lesson with stored turns from
   `GET /tutor/lessons?scope=active`. Empty active meeting sessions are
   ignored for hydration. If no active meeting with turns exists, the client
   checks `GET /tutor/lessons?scope=history` so a terminal pre-profile
   meeting can still show as read-only and create the profile from the saved
   transcript. `GET /student-profile/me/meeting-readiness` can also provide
   the finalizable `conversationId` when the transcript is not locally loaded.
8. When backend readiness says the meeting is complete enough, the web client
   calls `POST /student-profile/me/from-conversation` with the
   `conversationId`. The API reads `tutor_turns` for the authenticated user
   and conversation; it does not trust frontend-submitted profile facts.
9. `StudentProfileService` claims a
   `student_profile_creation_runs` row by authenticated user, conversation id,
   and transcript hash, while enforcing one running claim per user and
   conversation. A completed profile is returned without rerunning AI calls; a
   still-running conversation claim is rejected with conflict until its
   heartbeat lease expires even if a newer transcript hash exists; a stale
   running claim or failed claim can be atomically reclaimed for retry.
   Completed run rows without a stored profile are marked inconsistent/failed
   and reclaimed instead of remaining permanently stuck.
10. During the extraction and specialist pipeline, `StudentProfileService`
   updates the run heartbeat between AI calls. Lease staleness is based on the
   last heartbeat (`updated_at`), not only on the first attempt start time.
11. `StudentProfileService` runs `onboardingConversationExtraction` to convert
   the stored meeting transcript into the existing onboarding answer shape.
   The extractor ignores technical starter prompts, does not invent missing
   facts, drops non-teaching sensitive details, and must return the required
   teaching signals before specialist calls are spent.
12. `StudentProfileService` normalizes extracted answers, drops non-teaching
   sensitive details, and reads active vector store ids.
13. `AiModelService` resolves role/operation policy and runs three specialist
   model calls:
   - math knowledge diagnostician creates `knowledgeState`
   - tutoring-focused psychopedagogical profiler creates `learningPreferences`
     and `psychologicalProfile`
   - teaching strategy planner creates `explanationStrategy` and compact
     `aiSummary`
14. The conversation extractor and all specialist calls carry local
    `usageContext` with user id, conversation id, lesson session id, and
    `lessonType=meeting`.
15. Specialist prompts ask for confidence and evidence for meaningful profile
   inferences when possible.
16. RAG is used only for shared AI knowledge such as questionnaire strategy,
   diagnostic rubrics, task strategy, and teaching playbooks.
17. SQLite stores only teaching-useful personal profile signals in
    `student_profiles`.
18. After successful conversation-based profile creation, SQLite commits the
    profile upsert, corresponding non-terminal `meeting` lesson finish
    (`status=finished`, `goal_status=reached`,
    `finish_reason=profile_created_from_meeting`), and creation-run
    `completed` state in one short transaction.
19. Future tutor requests reload the DB profile so context compaction does not
   erase who the AI is speaking with.
20. After profile creation, the web client opens the normal tutor workspace
    with a lesson launcher instead of a blank waiting state. The launcher shows
    a green first-lesson button and cards for first meeting, level check,
    linear-equation practice, topic explanation, and mistake review. No tutor
    model call is made until the student chooses a launcher action or sends a
    message.

## Tutor Lesson Launcher Flow

1. When the authenticated tutor workspace has no local turns, the web client
   renders the lesson launcher above the composer.
2. Clicking the green first-lesson button starts a new `meeting` lesson by
   sending a starter prompt to `POST /tutor/message` with no
   `conversationId`.
3. Clicking level check or practice starts a new `diagnostic` or `practice`
   lesson with a starter prompt and no `conversationId`.
4. Clicking topic explanation or mistake review pre-fills the composer and
   switches the selected lesson mode, but waits for the student to add the
   topic or solution before sending.
5. The launcher is user-triggered and cost-controlled: page load and setup
   completion do not automatically call OpenAI.

## Tutor Lesson Continuity Flow

1. When the authenticated tutor workspace loads, the web client calls
   `GET /tutor/lessons?scope=active&limit=4&turnLimit=6` and
   `GET /tutor/lessons?scope=history&limit=8&turnLimit=6` in addition to usage
   refresh.
2. The active API response returns only non-terminal lesson sessions with
   conversation id, lesson type, goal/status, active-learning time, latest
   session summary/evidence levels, and recent stored tutor turns. The history
   response returns terminal sessions: `hard_limit_reached`, `goal_reached`,
   and `finished`.
3. If older tutor discussions exist in `tutor_turns` but no matching
   `lesson_sessions` row exists, the API exposes them through history with a
   synthetic `legacy_<conversationId>` session id and `finished` status. This
   keeps pre-lifecycle conversations visible after schema/runtime upgrades
   without making them endlessly resumable.
4. The tutor workspace shows a saved-lessons panel even when history is empty.
   Empty history explicitly says no lessons have been saved yet; non-empty
   history shows recent lesson rows, last question previews, summaries or the
   last answer, a continue-latest action for active lessons, open-record actions
   for historical records, and a new-lesson action.
5. If the latest active saved lesson has stored turns and the local tutor view
   is empty, the web client hydrates those turns immediately so the student
   sees the previous discussion without clicking through a hidden history
   surface. Finished records can be opened as read-only records, but they do
   not become the active conversation boundary.
6. When the student continues an active saved lesson, the web client keeps the
   saved `conversationId` and lesson type. The next `POST /tutor/message`
   therefore reaches the same conversation boundary. When the student opens a
   history record, the composer, voice input, and image generation are disabled
   until the student starts a new lesson.
7. The student can explicitly finish the current active lesson through
   `POST /tutor/lessons/:lessonSessionId/finish`. The backend verifies
   ownership, marks the session `finished`, stores
   `finish_reason=student_finished_lesson`, enqueues lesson-closure background
   review, and the client moves the lesson to read-only history.
8. `TutorService` adds DB-backed continuity context to the tutor prompt:
   recent turns from the active conversation plus recent session summaries.
   The tutor is instructed to continue from the previous discussion instead
   of restarting long explanations.
9. Starting a new lesson clears the local conversation boundary and starts the
   next tutor request without a `conversationId`.

## Tutor Message Flow

1. Authenticated user submits text or browser speech-recognition text. If a
   voice transcript is a short low-confidence fragment without math or lesson
   intent, the web client copies it into the composer and asks the student to
   confirm/edit it instead of sending it to the tutor API.
2. Web client calls `POST /tutor/message` with:
   - `message`
   - optional `conversationId`
   - `requestId` for idempotent retry handling
   - source `text` or `voice`
   - optional `lessonType`
3. `TutorService` normalizes the message, conversation id, and lesson type.
   If lesson type is omitted, it infers a conservative default from the
   prompt. When `requestId` already has a stored tutor turn for the signed-in
   user, the API returns that stored answer instead of calling the models again.
4. `CurriculumService` resolves a canonical topic, skill, task type, and
   verifier kind from active SQLite `curriculum_skills` rows. Unknown,
   low-confidence, or ambiguous topics remain `unknown` with candidate context;
   they do not fall back to the linear-equation context. The current verified vertical is
   `algebra.linear.solve_one_variable` /
   `ege.base.linear_equation_numeric`; unsupported skills remain routing
   context but cannot produce verified mastery.
5. `LessonService.beginTurnWithTransitions()` creates or touches the active
   `lesson_sessions` row for the conversation and lesson type. A finished,
   goal-reached, or hard-limit conversation id is rejected; terminal lesson
   records cannot be reopened. If an older client reuses an active
   conversation id with a different lesson type, the previous active session
   is finished and the reused id is rejected so the client must start a fresh
   lesson boundary. When a new conversation boundary starts, other
   non-terminal lesson sessions for the same signed-in student are finished as
   superseded. The service returns the exact list of sessions that actually
   transitioned to terminal state; `TutorService` queues lesson-closure review
   only for that returned list. The
   first turn adds no active-learning seconds; later quick turns use the
   configured minimum-turn heuristic. The service updates turn count,
   active-learning heuristic seconds, daily and continuous learning-limit
   state, goal status, and the current scoped progress/regression strategy
   signal.
6. If a hard daily or continuous learning limit is reached, `TutorService`
   returns a local stop response, persists the tutor turn, and does not call
   the model for a new explanation.
7. `MathVerifierService` checks the current message against the latest pending
   backend task for the lesson session when the message looks like a submitted
   answer. It writes `student_attempts`, asks `MasteryPolicyService` to read
   active `curriculum_mastery_criteria`, and records the policy result on the
   attempt. Correct/equivalent answers write `mastery_evidence` and a verified
   progress row only when the imported evidence sequence allows mastery.
   Independent successes are counted across the student's lesson sessions by
   canonical `source_task_id`, not by the local `lesson_tasks.id`, and active
   criteria are required by default for supported verifier skills.
8. If the answer is incorrect, task-bank `common_errors_json` can route the
   next hint through an imported `curriculum_misconceptions` row before the
   generic hint ladder is used.
9. `StudentProfileService` loads the stored student profile summary and
   explanation strategy when available.
10. `LessonDecisionService` calls the `lessonDecision` model-provider
   operation with the lesson lifecycle, current message, recent turns, profile
   context, scoped strategy signal, curriculum context, backend verifier
   evidence, limits, and allowed lesson-agent tools. The decision call can be
   disabled with `AI_LESSON_DECISION_ENABLED=false` or fail fast to a local
   fallback after `AI_LESSON_DECISION_TIMEOUT_MS`.
11. `LessonPolicyService` accepts or rejects proposed actions. The decision
   agent cannot directly finish lessons or mutate profiles. Self-reported
   understanding remains weak evidence and should lead to a requested attempt
   or explanation. Attempt-based completion requires backend-observed attempt
   evidence; practice and mistake-review completion require backend verifier
   evidence.
12. `LessonDecisionService` stores action-level observability in
   `lesson_decisions`, including tool name, sanitized decision JSON, policy
   result, accepted/rejected status, evidence level, verifier result when
   available, latency, model, local usage correlation id, fallback marker, and
   outcome. `propose_profile_delta` is rejected from immediate mutation and
   routed into sanitized background observations.
13. `KnowledgeService` returns configured or uploaded vector store ids.
14. `TutorService` builds a model-provider request:
   - Russian ЕГЭ tutor instructions
   - user name
   - source type
   - lesson type description, goal, and preferred block mix
   - curriculum ids and backend verifier evidence
   - lesson lifecycle state, goal criteria, learning-limit state, and
     progress/regression strategy signal
   - Lesson Decision Agent action results and backend policy outcome
   - optional DB-backed student profile context
   - optional DB-backed continuity context from the active conversation and
     recent session summaries
   - user prompt
   - optional `file_search` tool
   - local-only usage context for user, conversation, lesson session, and
     lesson type plus a local correlation id
15. `AiModelService` resolves the `tutorAnswer` or `tutorAnswerWithRag`
   operation policy, including model, metadata, and optional service tier.
16. The current OpenAI-backed provider calls Responses API.
17. After the provider returns, `AiModelService` strips local usage context
    from provider payloads and writes `ai_usage_ledger` when usage context is
    present.
18. API parses model output as structured tutor JSON when possible. The
   preferred response contract is an ordered `blocks` array containing text,
   task, example, and image blocks. Legacy `answer`, `tasks`, `examples`,
   `needsImage`, and `imagePrompt` fields remain populated for compatibility.
   The preferred contract also includes `lessonLifecycle.goalStatus` so the
   model can report policy-accepted goal completion or blockage.
19. API extracts citations from file-search annotations/results.
20. If the lesson needs an independent attempt and the resolved curriculum
    vertical is supported, `MathVerifierService` asks `TaskBankService` for an
    active imported `task_bank_tasks` row, appends and stores the selected
    verifiable task plus hint ladder without exposing the expected answer, and
    only uses the hardcoded linear-equation task as an explicitly logged POC
    empty-DB fallback. `TASK_BANK_REQUIRED=true` disables that fallback.
21. `LessonService` completes the turn, stores a lesson effectiveness signal,
    and accepts goal completion only when backend policy accepted a
    `propose_goal_completion` action. Otherwise `goalStatus=reached` remains a
    pending model suggestion and the lesson stays in progress.
22. API writes the tutor turn, lesson type, and optional request id to
    `tutor_turns`.
23. API enqueues background AI work. In batched mode, it stores a sanitized
    tutor-turn observation with lesson type and schedules or reschedules a grouped
    `learning_window_analysis` job. In legacy mode, it enqueues per-turn
    learning-signal extraction and separate interval jobs for session summary,
    student profile refresh, teaching strategy refresh, or rare quality review.
    Enqueue failures are isolated from the immediate answer path.
24. If the turn made the lesson terminal through hard limit or backend-accepted
    goal completion, `TutorService` also enqueues lesson-closure background
    review for the stored conversation. Repeated explicit finish calls and
    terminal-conversation reuse rejections do not enqueue closure review unless
    `LessonService` reports a new transition.
25. API returns the tutor answer with lesson lifecycle, compact usage snapshot
    for current lesson/day, and user-visible debug facts for curriculum,
    decision policy, and verifier result.
26. Web client refreshes `GET /usage/me/summary`, renders the usage/debug bar,
    then renders ordered response blocks, lesson-type badge, citations, and
    optional image actions inside the same tutor turn. If the freshly returned
    answer contains a required image block from an explicit visual request, the
    web client starts one `POST /tutor/image` call for that block after the text
    response is visible. Historical saved turns with missing image URLs keep the
    manual create-diagram action.
27. If browser speech synthesis is supported and the student has voice dialog
    enabled, the web client speaks the visible tutor answer locally. The spoken
    text is derived from the ordered response blocks, capped for length, and is
    not sent to the API or stored as generated audio.
28. After the spoken tutor answer ends, the web client automatically starts
    browser speech recognition for the next student turn when voice dialog is
    still enabled and speech-recognition support is available.

## Browser Voice Dialog Flow

1. The tutor workspace detects browser support for speech recognition and
   speech synthesis separately.
2. Speech recognition remains the student input path: the browser transcript
   is sent to `POST /tutor/message` with `source=voice`.
3. Speech synthesis is the assistant output path: when a tutor answer arrives
   after a user-triggered message or launcher action, the browser reads the
   visible ordered answer blocks aloud if voice dialog is enabled.
4. The voice-dialog switch is visible in the tutor composer, persisted in
   local storage, and disabled when browser speech synthesis is unavailable.
5. When assistant speech ends and voice dialog is still enabled, the web client
   automatically starts speech recognition to capture the next student turn
   only when `lessonLifecycle.shouldStop=false` and the lesson status is not
   `finished`, `goal_reached`, or `hard_limit_reached`. If the browser blocks
   automatic mic start or speech recognition is unsupported, the visible mic
   button remains the manual fallback.
6. If browser speech recognition ends without a transcript because of silence,
   `no-speech`, `aborted`, permission, device, language, or network errors,
   the UI clears listening state and shows a short reason. In voice-dialog
   auto-listen mode, a silence/no-speech stop retries once before leaving the
   mic button as the manual fallback.
7. Each tutor turn has a speak/stop action so the student can replay or stop
   the assistant voice. Stopping speech is local browser state and does not
   affect lesson, usage, or tutor-turn persistence.
8. The POC voice output does not use OpenAI audio generation, does not upload
   generated audio, and does not store spoken audio.
9. When a terminal tutor response arrives, the client clears the active
   `conversationId`, opens the turn as read-only history state, disables
   composer/voice/image actions, and shows the new-lesson action.
9. Russian pronunciation improvements are limited to browser voice selection,
   slower speech rate, and light math-text normalization; stress and emotional
   prosody remain browser-voice limitations.

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
7. Lesson-closure review enqueues an immediate `session_summary` and
   `profile_strategy_refresh` job. In batched mode it also pulls any pending
   observations for that conversation into an immediate
   `learning_window_analysis` job. If no pending observations exist, the
   session summary still analyzes the stored `tutor_turns` transcript. The
   enqueue path is transition-confirmed: it runs only after `LessonService`
   returns a closed session or after a turn lifecycle becomes terminal.
8. Background jobs call `AiModelService` with role/operation policy and
   task-specific specialist prompts: `learning-window-analyzer`,
   `profile-strategy-background-refresher`, `learning-signal-extractor`,
   `session-summarizer`, `student-profile-background-refresher`,
   `teaching-strategy-background-planner`, and
   `tutor-quality-background-reviewer`.
9. When the OpenAI provider is used, background operation service-tier policy
   can include `service_tier=flex`; per-operation tier overrides fall back to
   `OPENAI_BACKGROUND_SERVICE_TIER`.
10. Background jobs include user/conversation usage context, and lesson-session
   context when it was captured from the tutor turn or grouped observation, so
   delayed background costs can appear in the same usage ledger.
11. Batched background calls can include a hashed `prompt_cache_key` when
   `AI_BACKGROUND_PROMPT_CACHE_KEY_ENABLED=true`.
12. Layered learning memory is stored as:
    - L0 limited raw turn data in `tutor_turns`
    - L1 sanitized observations in `background_learning_observations`
    - L2 session summaries in `student_session_summaries`
    - L3 learning signals, refresh evidence, and quality reviews in
      `student_learning_signals`
    - L4 topic/skill progress or regression in `student_skill_progress`
    - L5 strategy hints consumed by profile/strategy refresh jobs
13. Profile refresh jobs merge sanitized patches into `student_profiles` using
    recent learning signals, session summaries, and skill progress rows.
14. Failed jobs are retried up to `AI_BACKGROUND_MAX_ATTEMPTS`; final failures
    stay visible in `background_ai_jobs` and appear as safe error previews in
    the signed-in user's expanded usage panel.
15. A signed-in user can requeue a small number of their own final failed jobs
    from the usage panel through `POST /usage/me/background/recover`. The API
    scopes recovery to the authenticated user, supports optional conversation
    and job-type filters, resets attempts, and only requeues safe background job
    types. Recovery schedules future worker execution; it does not run the
    OpenAI call synchronously in the request.
16. Background work must not store non-teaching sensitive details and must not
   block the current tutor response.

## Tutor Image Flow

1. Tutor response includes an image block with prompt, caption, alt text,
   status, and priority, or legacy `needsImage=true` plus `imagePrompt`.
   Explicit student requests for a drawing, diagram, graph, image, or visual
   explanation are normalized into an image block if the model omitted one.
2. For a fresh tutor answer whose image block has `priority=required`, the web
   client automatically starts one create-diagram request after the text answer
   is rendered. For active older saved turns, optional image blocks, or failed
   automatic generation, the student can still click the visible create-diagram
   action. Read-only history records do not trigger automatic image generation
   and their create-diagram action is disabled.
3. Web client calls `POST /tutor/image` with prompt/context plus optional
   conversation id, lesson session id, lesson type, tutor-turn id, and image
   block id for usage attribution and same-turn persistence.
4. API calls the `tutorImage` model-provider operation. The current
   implementation resolves the image operation model policy, then delegates to
   OpenAI image generation using configured size and quality.
5. `AiModelService` writes image usage to `ai_usage_ledger` when user and
   lesson context are present. If the image provider response omits usage
   tokens, `UsageService` estimates GPT-Image-2 output tokens from the
   requested size and quality so the local cost estimate does not silently stay
   at zero.
6. API persists the generated PNG data URL into the matching stored
   `tutor_turns.answer_json` image block when turn/block identity is available.
7. API returns a PNG data URL and optional usage snapshot.
8. Web client refreshes usage and renders the generated image in the same
   tutor turn and image block where the visual was requested.

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
   - recent Lesson Decision Agent actions and policy outcomes
   - verified learning outcome count and cost per verified outcome when
     mastery evidence exists
   - recent background job status, attempts, compact sanitized result preview,
     and stored error message for the signed-in user
5. The web tutor workspace renders a compact user-visible usage/debug bar and
   an expanded table with operation, assistant role, model, service tier,
   token counts, image counts, local estimated cost, decision tool, evidence,
   verifier result, acceptance/rejection, fallback marker, latency, and recent
   background job results or failures.
6. The web client refreshes the summary after tutor/image actions, through a
   visible manual refresh button, and through lightweight polling while the
   usage details panel is open or any visible background job is `pending` or
   `running`.
7. If the summary contains a visible failed background job, the usage bar shows
   a retry-one action that calls `POST /usage/me/background/recover` and then
   refreshes the safe summary. This is an explicit user action and is limited
   to the signed-in user's recoverable background jobs.
8. Usage summaries do not expose raw prompts, hidden instructions, RAG chunks,
   background job payloads, provider request ids, secrets, stack traces, or
   another user's rows.

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

## Knowledge Upload And Knowledge Pack Sync Flow

Manual admin upload:

1. Admin opens the knowledge screen.
2. Web client calls `GET /admin/knowledge/status`.
3. Admin uploads a supported file to `POST /admin/knowledge/files`.
4. API rejects empty files or unsupported extensions.
5. API uses a configured vector store id, locally persisted project vector
   store id, or creates `EGMathTeacher ЕГЭ knowledge` through the model
   provider.
6. API uploads the file through the model provider.
7. API attaches the file to the vector store through the model provider.
8. API stores local metadata in `knowledge_files` and records the active
   student RAG vector store in `project_ai_resources` when env ids are absent.
9. Status refresh can query vector store file status and update local metadata.

Local knowledge-pack import/sync:

1. Operator runs `npm run knowledge:sync -- --pack <zip>` or `--root <dir>`.
   If neither mode is provided, the command defaults to `--import-db`.
2. The CLI extracts zip input to a temporary directory or uses the extracted
   root directly after archive size, file-count, total unpacked size,
   single-file size, depth, extension, and path-traversal guardrails. The
   knowledge-pack zip itself is a local artifact and should not be committed.
3. With `--import-db`, `KnowledgePackService` reads structured JSON/JSONL
   files for curriculum topics, task types, skills, prerequisites, mastery
   criteria, misconceptions, task bank tasks, error classification, and lesson
   type plans. Strict mode is the default and requires all canonical
   structured files; `--partial` allows missing files and records warnings.
   Validation checks required fields, enum-like verifier kinds, JSONL line
   parsing, and core cross-reference ids before writes.
4. The importer computes each source file's SHA-256 hash and checks
   `knowledge_source_files`. Unchanged structured files are skipped unless
   `--force` is used. Changed files are upserted into the corresponding
   SQLite tables inside the local migration-backed schema. Removed structured
   source ids are soft-retired with `sync_status='retired'`.
5. With `--sync-rag`, only selected student-facing Markdown files are eligible
   for OpenAI RAG upload: exam framework, curriculum overview, theory,
   misconception guides, teaching methods, teen communication, lesson types,
   lesson scenarios, and learning-plan Markdown rules/plans.
6. RAG sync computes `source_path + content_hash` state. If a synced file is
   unchanged, upload is skipped. If content changed, the new file is uploaded
   and attached to the active vector store, then the superseded vector-store
   file is detached through the model provider and marked `superseded`
   locally. Deleted or renamed source paths are reconciled against active
   vector-store attachments only when the current sync is strict and
   authoritative; partial packs do not remove absent RAG paths.
7. `--dry-run` plans RAG changes without creating vector stores, uploading
   files, attaching files, or deleting vector-store file attachments.
8. The active vector store id is stored in `project_ai_resources` when
   `OPENAI_VECTOR_STORE_IDS` is empty. Tutor/profile/background RAG then uses
   that locally stored vector store id automatically through
   `KnowledgeService.getActiveVectorStoreIds()`.
9. Remote OpenAI operations and SQLite writes are coordinated by local
   transaction-claimed `knowledge_pack_sync_jobs` rows for upload/attach
   paths. Failed imports are recorded in `knowledge_pack_imports`;
   `--wait-ready` polls vector-store indexing readiness with configurable
   attempts and delay, and marks a job `indexed` only when remote status is
   `completed`. Timeout leaves the job attached with timeout metadata.
   `--recover-rag` retries failed or attached-timeout jobs that recorded
   recoverable OpenAI file ids and waits by default; without waiting, queued
   replacements remain `indexing` and stale active attachments are not
   removed.
10. Non-dry-run RAG sync remains a protected live OpenAI side effect even
    though local idempotency and recovery metadata exist.

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
