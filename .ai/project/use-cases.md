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
recognition.

Rules from current implementation:

- Tutor requests are sent to `POST /tutor/message`.
- The API records source as `text` or `voice`.
- The request may include `lessonType`; older clients can omit it and the API
  infers a conservative type from the prompt.
- Supported lesson types are `meeting`, `tutor`, `concept`, `practice`,
  `diagnostic`, `exam_strategy`, `mistake_review`, `visual_explanation`, and
  `reflection`.
- The current tutor UI exposes the main POC modes: tutor, practice,
  diagnostic, and mistake review.
- Lesson type controls the goal of the response, expected block mix, and which
  background learning signals should be emphasized.
- Switching the lesson mode in the web UI starts a new conversation/session
  boundary. If an older client reuses a conversation id with a different
  lesson type, the API finishes the previous active lesson session and creates
  a new one for the requested lesson type.
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
- For the first supported vertical, the backend can generate a linear-equation
  task, verify a numeric answer, write `student_attempts`, write
  `mastery_evidence` for correct answers, and allow policy to complete the
  goal from that proof.
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
- Image blocks are visual plans, not generated image bytes. They include
  prompt, caption, alt text, status, and priority so the UI can keep image
  support inside the same tutor turn.
- The tutor prompt instructs the model to answer in Russian, explain step by
  step, check understanding, and avoid returning only the final answer.
- If RAG vector stores exist, the OpenAI-backed model provider uses file
  search.
- If RAG materials are missing, the tutor prompt says not to invent citations.
- If a student profile exists, the tutor prompt includes its compact DB summary
  and explanation strategy so the answer can adapt to the teenager.
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
  expanded operation/model/token/image/decision details. It must not expose
  raw prompts, hidden instructions, provider request ids, stack traces,
  secrets, or another user's usage.

### Complete First-Login Meeting

Student users complete a guided first meeting before the normal tutor
workspace.

Rules from current implementation:

- Profile status is loaded through `GET /student-profile/me`.
- Student profile creation uses `PUT /student-profile/me`.
- Admin users do not require onboarding by default.
- The meeting asks for exam context, target score, confidence, emotional
  relation to math, weak topics, explanation preferences, pacing, visual
  preference, analogy interests, and short diagnostic answers.
- The wording avoids presenting the diagnostic as a school test.
- The API creates the profile through specialist AI evaluator calls:
  - math knowledge diagnostician
  - tutoring-focused psychopedagogical profiler
  - teaching strategy planner
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
- The stored psychopedagogical profile is for explanation strategy only; it
  must not diagnose, manipulate, or preserve unnecessary sensitive details.
- First-meeting answers and AI-made profile sections are filtered before
  storage so only teaching-useful signals remain for explanation strategy.

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
  image block with prompt/caption/alt text, and the web client renders the
  generated image inside that same tutor turn after the explicit image action.
- The API calls the model-provider image operation. The current implementation
  delegates to OpenAI image generation and returns a PNG data URL.
- Image generation usage is recorded in the same usage ledger when a lesson
  session id is provided.
- Images should explain math concepts, graphs, schemes, or coordinate-plane
  reasoning.

### Review Lesson Usage

Authenticated users can inspect their own AI usage estimates in the tutor
workspace.

Rules from current implementation:

- Endpoint: `GET /usage/me/summary`.
- The endpoint returns only the signed-in user's own today/current-lesson
  usage.
- The default bar is compact for teenage learners: today, current lesson,
  goal status, and active-learning time.
- Expanded details show operation, assistant role, model, service tier when
  present, token counts, image counts, and estimated cost.
- Estimated USD cost is calculated from local pricing configuration. If prices
  are not configured, token/image counts remain visible and cost is shown as
  zero with a pricing note.
- Usage rows must not contain raw prompts, hidden system/developer
  instructions, RAG chunks, provider request ids, secrets, or billing
  credentials.

### Upload Knowledge Materials

Admin user uploads documents for RAG grounding.

Rules from current implementation:

- Endpoint: `POST /admin/knowledge/files`.
- Guard: admin-only.
- Accepted extensions: `.pdf`, `.md`, `.txt`, `.docx`, `.tex`.
- Upload limit: 25 MB.
- OpenAI file and vector store ids are stored in SQLite metadata for the
  current OpenAI-backed provider.
- Status can be checked through `GET /admin/knowledge/status`.

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
- formal ЕГЭ curriculum map
- student progress dashboard
- parent/teacher accounts
- payments or subscriptions
- production privacy/compliance policy
- frontend component, accessibility, or visual regression tests
- production auth hardening beyond the POC
