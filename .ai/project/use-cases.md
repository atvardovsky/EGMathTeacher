# EGMathTeacher Use Cases And Business Rules

This file records project-owned user workflows and domain rules.

## Audience

The intended learner audience is teenagers around 14-16 years old preparing
for Russian ЕГЭ math.

UI and tutor behavior should favor:

- clear Russian-language explanations
- Russian and English static UI labels where the browser client owns the text
- predictable controls
- visible next actions
- short chunks of reasoning
- practice tasks and examples
- optional visuals when they genuinely clarify a concept

## Implemented User Roles

- `student`: default role for users after the first account.
- `admin`: first registered user; can upload knowledge files.

No parent, teacher, school, class, subscription, or multi-tenant role is
implemented.

## Main Use Cases

### Register Or Log In

User submits name and password in the web client.

Rules from current implementation:

- Name length must be between 2 and 64 characters.
- Password length must be between 4 and 256 characters.
- User names are unique.
- First registered user becomes `admin`; later users become `student`.
- Successful auth sets an HTTP-only signed cookie.
- Static UI language can be switched between Russian and English before login,
  during first meeting, and inside the authenticated shell.

### Ask The Tutor

Authenticated user sends a math question by text or browser speech
recognition. When the student keeps voice dialog enabled, the tutor speaks the
visible answer aloud through browser speech synthesis and then opens the mic
again for the next student turn.

Rules from current implementation:

- Tutor requests are sent to `POST /tutor/message`.
- The API records source as `text` or `voice`.
- Browser speech recognition is used only to turn student speech into the
  message sent to `POST /tutor/message`.
- Browser speech synthesis is used only to read the returned visible tutor
  answer aloud. It does not call backend audio generation, upload audio, or
  write generated audio to SQLite.
- Voice dialog is enabled by default when speech synthesis is available, has a
  visible on/off switch in the tutor composer, and each tutor answer has a
  speak/stop control for replay or interruption. After a spoken tutor answer,
  the web client automatically starts speech recognition only when browser
  support and permissions allow it and the returned lesson lifecycle is still
  non-terminal (`shouldStop=false`, not `finished`, `goal_reached`, or
  `hard_limit_reached`). Terminal responses clear the active conversation
  boundary instead of letting the next voice/text turn reopen it.
- Browser speech recognition may stop after silence, permission changes,
  network errors, or browser policy. The tutor UI shows a short voice-status
  reason, retries once after an automatic silence stop in voice-dialog mode,
  and leaves the mic button as the manual fallback.
- Short low-confidence voice transcripts without math or lesson intent are
  copied back into the composer for confirmation instead of being sent as a
  tutor request.
- Browser speech synthesis quality, Russian stress, and emotional prosody are
  browser-voice limitations in the POC. Better voice quality requires a future
  OpenAI audio integration.
- The request may include `lessonType`; older clients can omit it and the API
  infers a conservative type from the prompt.
- Supported lesson types are `meeting`, `tutor`, `concept`, `practice`,
  `diagnostic`, `exam_strategy`, `mistake_review`, `visual_explanation`, and
  `reflection`.
- The current tutor UI exposes the main POC modes: meeting, tutor, practice,
  diagnostic, and mistake review.
- When the tutor workspace has no turns, it shows a lesson launcher instead of
  an empty waiting state. The launcher includes a prominent green first-lesson
  button plus cards for first meeting, level check, linear-equation practice,
  topic explanation, and mistake review.
- The tutor workspace also shows saved lesson continuity. It calls
  `GET /tutor/lessons?scope=active` and `GET /tutor/lessons?scope=history`,
  displays active lesson records, read-only historical records, last questions,
  summaries or last answers, and clear continue/open-record actions. If no
  lesson has been saved, it shows an explicit empty-history message rather
  than a blank area.
- When active stored turns exist, the latest active saved discussion is loaded
  into the tutor view on page load, so the student can see where the previous
  session ended.
- Continuing an active saved lesson reuses its `conversationId` and lesson
  type. The backend adds recent turns and session summaries from SQLite to the
  tutor prompt so the answer can continue from the prior discussion.
- The student can finish the current active lesson explicitly. Finished
  sessions and legacy saved `tutor_turns` without a matching `lesson_sessions`
  row remain visible as read-only historical records. Finished,
  goal-reached, and hard-limit lesson conversations cannot be reopened through
  `POST /tutor/message`; the client must start a new lesson without the old
  `conversationId`.
- Starting a launcher lesson is a deliberate user action. The web client does
  not call the tutor model automatically on page load or immediately after
  setup completion.
- First meeting, level check, and practice cards send starter prompts with the
  matching lesson type. Topic explanation and mistake-review cards prefill the
  composer because they need student-specific text before sending.
- Lesson type controls the goal of the response, expected block mix, and which
  background learning signals should be emphasized.
- Switching the lesson mode in the web UI starts a new conversation/session
  boundary. If an older client reuses an active conversation id with a
  different lesson type, the API finishes the previous active lesson session
  and rejects the reused id so the client must start a fresh lesson boundary.
- Each tutor turn belongs to a lesson session with a lesson goal, success
  criteria, current goal status, active-learning seconds, and daily/continuous
  learning-limit state.
- Learning-time limits are configurable POC teaching heuristics. They should
  be presented as a practical rest/attention aid, not as medical fatigue
  assessment.
- Soft daily or continuous limits tell the tutor to finish the current step
  and avoid starting a long new topic.
- Hard daily or continuous limits return a local stop response without calling
  the model for a new explanation.
- Before the final tutor response, a Lesson Decision Agent reads the lesson
  lifecycle, current message, recent history, profile context, curriculum ids,
  backend verifier evidence, limits, scoped progress signals, and allowed
  tools. It chooses pedagogical actions such as continuing, explaining, giving
  a task, requesting an attempt, checking an answer, changing strategy,
  suggesting visual support, or proposing goal completion.
- The decision agent cannot directly mutate durable state. Backend policy
  accepts or rejects proposed state-affecting actions and stores every action
  result in `lesson_decisions`.
- The tutor can output `lessonLifecycle.goalStatus="reached"` only as a
  reflection of backend policy acceptance. A raw LLM completion suggestion is
  pending unless `propose_goal_completion` was accepted by policy.
- Self-reported phrases such as "я понял", "спасибо", or "получилось" are
  only `self_reported` evidence. They should trigger
  `request_student_attempt` or `request_student_explanation`, not lesson
  completion.
- Attempt-based completion requires a backend-observed attempt. Practice and
  mistake-review completion require backend verifier evidence.
- For the first supported vertical, the backend resolves curriculum from
  active SQLite rows, selects an imported task-bank task when available,
  carries hint ladders and common-error ids into lesson tasks, verifies a
  numeric answer, and writes `student_attempts`. Correct answers become
  `mastery_evidence`, skill progress, and goal-completion evidence only when
  imported mastery criteria allow the evidence sequence. Independent successes
  are deduplicated by canonical `source_task_id` across lesson sessions.
  Unknown, low-confidence, or ambiguous topics remain `unknown` instead of
  falling back to linear equations.
- Accepted completion sets `goalStatusEvidence=backend_observed`; unaccepted
  model-only or policy-rejected completion keeps the lesson in progress with
  `goalStatusEvidence=model_suggested_pending`.
- Scoped progress/regression signals inform the explanation strategy. The
  lesson strategy signal is selected from rows relevant to the current
  conversation, lesson type, or inferred topic hint, so an unrelated topic
  should not force the current lesson into regression mode.
- Tutor responses are expected to include an ordered `blocks` array for text,
  task, example, and image blocks, plus legacy `answer`, `tasks`, `examples`,
  `needsImage`, and `imagePrompt` fields for compatibility.
- Tutor responses include `lessonLifecycle` state and a compact usage snapshot
  for the current lesson/day.
- Image blocks start as visual plans. They include prompt, caption, alt text,
  status, and priority so the UI can keep image support inside the same tutor
  turn. When image generation succeeds with tutor-turn/block identity, the POC
  persists the generated data URL into the same stored image block.
- If the student explicitly asks for a drawing, diagram, graph, image, or
  visual explanation, the API must return an image block even if the model
  omitted it. Fresh required image blocks can auto-start one image-generation
  request after the text answer is visible; active older saved turns and
  optional blocks keep the explicit image-generation action visible. Read-only
  historical records must not trigger new image-generation spend.
- The tutor prompt instructs the model to answer in Russian, explain step by
  step, check understanding, and avoid returning only the final answer.
- If RAG vector stores exist, the OpenAI-backed model provider uses file
  search.
- If RAG materials are missing, the tutor prompt says not to invent citations.
- If a student profile exists, the tutor prompt includes its compact DB summary
  and explanation strategy so the answer can adapt to the teenager.
- If the conversation has stored turns or session summaries, the tutor prompt
  includes compact DB-backed continuity context so chat compaction or page
  reload does not erase where the lesson stopped.
- After the immediate tutor answer is persisted, the API enqueues background
  assistant work where logical:
  - in batched mode, sanitized tutor-turn observations are stored locally and
    grouped into a learning-window analysis after the configured observation
    count, idle timeout, or quality trigger
  - in legacy mode, learning-signal extraction runs after each turn
  - session summaries are produced by grouped learning-window analysis in
    batched mode or by separate interval jobs in legacy mode
  - student profile and teaching strategy refresh together after the configured
    number of user turns in batched mode, or as split jobs in legacy mode
  - quality review is included in grouped trigger analysis in batched mode or
    runs as a rare separate job in legacy mode
- When a lesson is explicitly finished, stopped by hard limit, completed by
  backend-accepted goal evidence, or auto-closed by a new lesson boundary, the
  API enqueues lesson-closure background review. Closure review schedules a
  compact session summary and a profile/strategy refresh; in batched mode it
  also pulls pending observations into an immediate learning-window analysis.
  These jobs analyze stored lesson conversation data to find teaching-useful
  information about the student. Closure review is queued only after
  `LessonService` reports an actual state transition to a terminal lesson
  status. Repeated finish requests and rejected terminal conversation reuse do
  not trigger duplicate or premature closure reviews.
- Background analysis stores layered teaching evidence:
  - L0 raw turn data stays limited to `tutor_turns`
  - L1 sanitized turn observations stay in `background_learning_observations`
  - L2 compact session summaries stay in `student_session_summaries`
  - L3 teaching-useful learning signals stay in `student_learning_signals`
  - L4 skill-level progress or regression stays in `student_skill_progress`
  - L5 strategy/profile update hints are used by background refresh jobs
- Background updates are eventually consistent. They must not block the current
  answer, and they must store only teaching-useful signals.
- Lesson effectiveness signals store goal status, answer shape, and strategy
  adjustment recommendations. They are teaching signals, not grades.
- Lesson decision rows store action-level observability: tool name, sanitized
  decision JSON, backend policy result, accepted/rejected status, rejection
  reason, evidence level, verifier result when available, model, local usage
  correlation id, latency, fallback marker, and lesson outcome. They are
  debug/product signals, not grades.
- The web tutor workspace shows a user-visible usage bar for the signed-in
  user's own AI expenses. It shows today's estimate, current lesson estimate,
  evidence level, verified outcome count, cost per verified outcome, and
  expanded operation/model/token/image/decision/background-job details. It can
  requeue one visible failed background job for the signed-in user. It must not
  expose raw prompts, hidden instructions, provider request ids, stack traces,
  secrets, or another user's usage.

### Complete First-Login Meeting

Student users complete a guided first meeting before the normal tutor
workspace. After profile creation, the normal tutor workspace opens with a
lesson launcher so the next teaching action is visible.

Rules from current implementation:

- Profile status is loaded through `GET /student-profile/me`.
- The default student profile creation path uses
  `POST /student-profile/me/from-conversation` after an AI-led `meeting`
  lesson has passed backend meeting-readiness scoring. The legacy
  `PUT /student-profile/me` contract is disabled for students by default and
  only available when `ONBOARDING_STRUCTURED_ENDPOINT_ENABLED=true` for a
  trusted fallback/import workflow.
- Admin users do not require onboarding by default.
- The meeting screen is voice-first: a green start button begins the AI-led
  conversation, tutor answers are spoken when browser speech synthesis is
  available, voice-dialog mode reopens the mic after each spoken answer, and
  text input remains a fallback.
- The AI-led meeting asks short questions one at a time to learn exam/goal
  context, confidence, emotional relation to math, weak topics, explanation
  preferences, pacing, visual preference, analogy interests, and short
  diagnostic answers.
- The web client calls `GET /student-profile/me/meeting-readiness` and enables
  profile creation only when the backend sees at least three meaningful
  student replies plus the required teaching signals: preparation goal,
  self-assessment, weak topic, explanation preference, and one diagnostic or
  contentful math reply. The technical starter prompt is ignored.
- If the first-meeting page reloads before setup is complete, the client
  restores the latest active saved `meeting` lesson and its stored turns. If
  the meeting already reached a terminal lifecycle before profile creation,
  the client restores the latest terminal saved meeting from history when
  available and can also use backend readiness' `conversationId` to finalize
  the profile.
- If the meeting reaches a terminal lifecycle before profile creation, the
  client stops auto-listening, disables manual input for that transcript, and
  shows create-profile or start-new-meeting actions.
- The wording avoids presenting the diagnostic as a school test or static
  questionnaire.
- The API creates the profile through specialist AI evaluator calls:
  - first-meeting conversation extractor
  - math knowledge diagnostician
  - tutoring-focused psychopedagogical profiler
  - teaching strategy planner
- The conversation extractor and all specialist onboarding calls carry the
  first meeting `conversationId` and `lessonSessionId` in local usage context,
  so the usage ledger can attribute onboarding cost to the lesson as well as
  the day.
- Conversation-based profile creation records the transcript hash through
  `student_profile_creation_runs`, but only one running claim is allowed per
  authenticated user and conversation. Repeated calls after success return the
  stored profile without rerunning the extractor or three specialist calls.
  Fresh running claims are rejected to avoid duplicate spend even when another
  tab changed the transcript; failed claims and stale running claims after
  `PROFILE_CREATION_RUNNING_TIMEOUT_MS` are retryable. Live long-running
  pipelines heartbeat the row during each onboarding AI request and between
  AI calls. A completed run without a stored profile is treated as
  inconsistent/failed so it can recover. If a stored profile already exists,
  reconciliation closes only the still-running creation row for that
  conversation and leaves failed or superseded rows intact as history.
- Successful profile creation commits the profile, meeting finish, and
  creation-run completion together in SQLite after the AI calls have returned.
- Specialist outputs should include confidence and evidence for meaningful
  inferences when possible.
- OpenAI is the implemented model provider for those specialist calls in the
  current POC; non-OpenAI model providers are stubs.
- If RAG vector stores exist, profile generation may use file search only for
  shared pedagogy, questionnaire strategies, rubrics, and explanation
  playbooks.
- Personal profile memory is stored in SQLite, not in RAG.
- Later profile and strategy updates are produced from sanitized tutor-turn
  signals in background jobs, not from full synchronous profile regeneration
  after every discussion turn.
- Successful profile creation from a stored meeting conversation marks the
  corresponding `meeting` lesson finished with goal reached. If extraction or
  profile generation fails, the meeting remains active so the student can
  continue the dialog.
- The stored psychopedagogical profile is for explanation strategy only; it
  must not diagnose, manipulate, or preserve unnecessary sensitive details.
- First-meeting answers and AI-made profile sections are filtered before
  storage so only teaching-useful signals remain for explanation strategy.
- Completing setup does not automatically spend model tokens on a tutor turn.
  The first teaching turn starts when the student chooses the green first
  lesson button or another launcher action.

### Review Settings

Authenticated users can open the settings view from the app shell.

Rules from current implementation:

- Settings can change the static UI language between Russian and English.
- Browser speech-recognition language follows the selected UI language.
- Settings shows account name, role, and creation timestamp from the current
  session.
- Settings shows read-only learning profile memory when it is already loaded:
  compact AI summary, first-meeting answers, knowledge state, learning
  preferences, pedagogical hypotheses, explanation strategy, recent session
  summaries, and skill progress/regression signals.
- Settings does not edit account fields, profile fields, privacy actions, or
  provider/RAG configuration in the current POC.

### Generate An Explanatory Image

Authenticated user can request image generation when a tutor turn includes an
image block or legacy image prompt.

Rules from current implementation:

- Image requests use `POST /tutor/image`.
- The tutor message response does not wait for image generation. It returns an
  image block with prompt/caption/alt text. Fresh required image blocks
  auto-start one generation after the text answer is visible; saved turns,
  optional blocks, and retry cases use the prominent create-diagram action.
- The API calls the model-provider image operation. The current implementation
  delegates to OpenAI image generation and returns a PNG data URL.
- When the request includes tutor-turn and image-block identity, the API
  persists the generated data URL into the stored tutor-turn image block for
  POC continuity.
- Image generation usage is recorded in the same usage ledger when a lesson
  session id is provided.
- Images should explain math concepts, graphs, schemes, or coordinate-plane
  reasoning.

### Review Lesson Usage

Authenticated users can inspect their own AI usage estimates in the tutor
workspace.

Rules from current implementation:

- Endpoint: `GET /usage/me/summary`.
- Recovery endpoint: `POST /usage/me/background/recover`.
- The endpoint returns only the signed-in user's own today/current-lesson
  usage.
- The default bar is compact for teenage learners: today, current lesson,
  goal status, and active-learning time.
- Expanded details show operation, assistant role, model, service tier when
  present, token counts, image counts, estimated cost, and safe background job
  result/error previews.
- A visible retry-one action can requeue one recoverable failed background job
  for the signed-in user. It resets attempts and schedules worker processing;
  it does not run the provider call synchronously in the request.
- Estimated USD cost is calculated from local pricing configuration. If prices
  are not configured, token/image counts remain visible and cost is shown as
  zero with a pricing note.
- For GPT-Image-2 image generation, provider usage tokens are used when
  present; otherwise the POC estimates output tokens from requested size and
  quality before applying configured token prices.
- Usage rows must not contain raw prompts, hidden system/developer
  instructions, RAG chunks, provider request ids, secrets, or billing
  credentials.

### Upload Knowledge Materials

Admin user uploads documents for RAG grounding, or an operator imports the
local EGMathTeacher knowledge pack.

Rules from current implementation:

- Endpoint: `POST /admin/knowledge/files`.
- Guard: admin-only.
- Accepted extensions: `.pdf`, `.md`, `.txt`, `.docx`, `.tex`.
- Upload limit: 25 MB.
- OpenAI file and vector store ids are stored in SQLite metadata for the
  current OpenAI-backed provider.
- Status can be checked through `GET /admin/knowledge/status`.
- Local command: `npm run knowledge:sync -- --pack <zip> --import-db
  [--sync-rag] [--dry-run]`.
- Structured JSON/JSONL from the pack is imported into SQLite. Selected
  student-facing Markdown files can be synced to the active OpenAI vector
  store by content hash.
- Unchanged synced Markdown files are skipped. Changed synced Markdown files
  are uploaded, but the superseded vector-store file attachment is detached
  only after the replacement reaches remote `completed` status when
  `--wait-ready` is used.
- Removed Markdown paths are reconciled only for strict authoritative RAG
  sync; partial packs do not detach files simply because they are absent.
- `--dry-run` must not perform live OpenAI create/upload/attach/delete calls.
- Strict pack validation is default; `--partial` records warnings. Failed
  imports are ledgered, pack schema/release/content hashes are separated,
  removed structured rows are soft-retired, deleted/renamed RAG paths are
  reconciled only in strict authoritative mode, sync jobs are locally claimed,
  `--recover-rag` retries recoverable failed or attached-timeout jobs,
  `--wait-ready` can wait for vector-store indexing and records `indexed` only
  after remote `completed`, timeout rows remain `sync_status='indexing'`, and
  archive guardrails bound local pack processing.
- Non-dry-run `--sync-rag` is a protected live OpenAI side effect.

### Use WebRTC Voice Assistant

The inherited voice service exposes WebRTC endpoints under `/webrtc`.

Rules from current implementation:

- Sessions are in memory.
- Conversation transcripts can be written to the transcript log directory on
  close.
- OpenAI Realtime is implemented; Gemini Live, Hume EVI, and Retell are
  configured as stubs.
- Translation mode is supported by passing two languages during session
  bootstrap.

## Explicit Non-Features

These were not found in the repository:

- packaged desktop runtime
- runtime-connected full ЕГЭ curriculum map
- adaptive task-bank selection beyond the supported verifier vertical
- student progress dashboard
- parent/teacher accounts
- payments or subscriptions
- production privacy/compliance policy
- frontend component, accessibility, or visual regression tests
- production auth hardening beyond the POC
