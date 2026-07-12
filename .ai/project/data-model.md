# EGMathTeacher Data Model

This file records local, in-memory, file, and remote data owned or referenced
by EGMathTeacher.

## Local SQLite Database

SQLite is initialized in `apps/api/src/database/database.service.ts`.

Default path: `./data/app.sqlite` from `SQLITE_PATH`.

The service enables:

- `PRAGMA journal_mode = WAL`
- `PRAGMA foreign_keys = ON`

### `schema_migrations`

| Column | Type | Rule |
| --- | --- | --- |
| `version` | `TEXT` | primary key |
| `applied_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/database/database.service.ts`.

The current POC records migration `001_initial_schema` after creating the
initial tables, migration `002_background_ai_jobs` after creating background
AI job and learning-signal tables, and migration
`003_background_observation_windows` after adding grouped background
observation-window storage, and migration `004_session_progress_tracking`
after adding lesson type, session-summary, and skill-progress storage, and
migration `005_lesson_lifecycle_usage` after adding lesson sessions,
effectiveness signals, and the AI usage ledger.
Migrations are applied inside a local SQLite transaction, and table-rebuild
migrations must pass `PRAGMA foreign_key_check` before the version is
recorded. This is a lightweight migration ledger, not a full production
rollback, backfill, or backup system.

### `users`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `name` | `TEXT` | required, unique |
| `password_hash` | `TEXT` | required |
| `role` | `TEXT` | required, `admin` or `student` |
| `created_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/auth` and `apps/api/src/database/database.service.ts`.

### `knowledge_files`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `original_name` | `TEXT` | required |
| `mime_type` | `TEXT` | required |
| `size_bytes` | `INTEGER` | required |
| `openai_file_id` | `TEXT` | required |
| `vector_store_id` | `TEXT` | required |
| `status` | `TEXT` | required |
| `created_at` | `TEXT` | required ISO timestamp |
| `updated_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/knowledge`.

### `student_profiles`

| Column | Type | Rule |
| --- | --- | --- |
| `user_id` | `TEXT` | primary key, references `users(id)` |
| `onboarding_completed_at` | `TEXT` | required ISO timestamp |
| `onboarding_answers_json` | `TEXT` | required serialized first-meeting answers |
| `knowledge_state_json` | `TEXT` | required serialized AI-made knowledge state |
| `learning_preferences_json` | `TEXT` | required serialized learning preferences |
| `psychological_profile_json` | `TEXT` | required serialized tutoring-focused psychopedagogical profile |
| `explanation_strategy_json` | `TEXT` | required serialized explanation strategy |
| `ai_summary` | `TEXT` | required compact profile summary for tutor prompts |
| `created_at` | `TEXT` | required ISO timestamp |
| `updated_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/student-profile` and
`apps/api/src/database/database.service.ts`.

The personal student profile is DB memory, not RAG memory. RAG stores shared
teaching knowledge, questionnaire strategy, diagnostic rubrics, task banks, and
explanation playbooks. SQLite stores only teaching-useful signals about who the
current student is and how the AI should adapt explanations to them.

The JSON profile sections are produced by specialist AI calls:

- `knowledge_state_json`: math diagnostician output.
- `learning_preferences_json`: learning preference output from the
  psychopedagogical profiler.
- `psychological_profile_json`: tutoring-focused psychopedagogical hypotheses,
  preferably with confidence and evidence per meaningful inference.
- `explanation_strategy_json`: teaching strategy planner output.

These fields remain flexible JSON in the POC. Sensitive non-teaching personal
details are filtered before storage and before later profile specialist calls.

Background student profile and strategy refresh jobs can merge sanitized JSON
patches into these fields after tutor turns. Batched mode combines profile and
strategy refresh in one background job where logical. These updates are
eventually consistent and use only teaching-useful signals stored in SQLite.

### `background_ai_jobs`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `type` | `TEXT` | required; one of `learning_signal_extraction`, `learning_window_analysis`, `session_summary`, `student_profile_refresh`, `profile_strategy_refresh`, `teaching_strategy_refresh`, `tutor_quality_review` |
| `status` | `TEXT` | required; `pending`, `running`, `succeeded`, or `failed` |
| `user_id` | `TEXT` | required, references `users(id)` |
| `conversation_id` | `TEXT` | optional tutor conversation id |
| `attempts` | `INTEGER` | required retry counter |
| `payload_json` | `TEXT` | required sanitized job payload |
| `result_json` | `TEXT` | optional sanitized job result |
| `error_message` | `TEXT` | optional failure reason |
| `scheduled_at` | `TEXT` | required ISO timestamp |
| `started_at` | `TEXT` | optional ISO timestamp |
| `completed_at` | `TEXT` | optional ISO timestamp |
| `created_at` | `TEXT` | required ISO timestamp |
| `updated_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/background-ai` and
`apps/api/src/database/database.service.ts`.

Legacy mode uses per-turn `learning_signal_extraction` plus separate
`student_profile_refresh` and `teaching_strategy_refresh` jobs. Batched mode
uses `learning_window_analysis` and `profile_strategy_refresh` to reduce
model calls while preserving eventually consistent profile updates.
Running jobs older than `AI_BACKGROUND_RUNNING_JOB_TIMEOUT_MS` are recovered
before each drain: jobs with retry attempts left return to `pending`, and
exhausted jobs become `failed`.

### `background_learning_observations`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `user_id` | `TEXT` | required, references `users(id)` |
| `conversation_id` | `TEXT` | required tutor conversation id |
| `lesson_type` | `TEXT` | required; one of `meeting`, `tutor`, `concept`, `practice`, `diagnostic`, `exam_strategy`, `mistake_review`, `visual_explanation`, `reflection` |
| `source` | `TEXT` | required; `text` or `voice` |
| `observation_json` | `TEXT` | required sanitized tutor-turn observation JSON |
| `status` | `TEXT` | required; `pending`, `queued`, or `processed` |
| `window_id` | `TEXT` | optional reference to `background_analysis_windows(id)` |
| `created_at` | `TEXT` | required ISO timestamp |
| `updated_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/background-ai` and
`apps/api/src/database/database.service.ts`.

This table is the store-first mechanism for batched background processing. It
stores sanitized teaching observations locally so the API does not call the
background signal extractor after every tutor turn. Observations start as
`pending`, move to `queued` only while a grouped learning-window model call is
in flight, return to `pending` if that call fails, and become `processed` only
after the grouped result is stored successfully. Stale `queued` observations
older than `AI_BACKGROUND_RUNNING_JOB_TIMEOUT_MS` are returned to `pending`
before draining new work.

### `background_analysis_windows`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `user_id` | `TEXT` | required, references `users(id)` |
| `conversation_id` | `TEXT` | optional tutor conversation id |
| `status` | `TEXT` | required; `succeeded` or `failed` |
| `trigger_reason` | `TEXT` | required count, idle, or quality trigger label |
| `observation_count` | `INTEGER` | required number of grouped observations |
| `observation_ids_json` | `TEXT` | required serialized observation ids |
| `result_json` | `TEXT` | optional sanitized grouped-analysis result |
| `source_job_id` | `TEXT` | optional background job id |
| `created_at` | `TEXT` | required ISO timestamp |
| `completed_at` | `TEXT` | optional ISO timestamp |

Source owner: `apps/api/src/background-ai` and
`apps/api/src/database/database.service.ts`.

Analysis windows are durable evidence of grouped background learning analysis.
They are not RAG knowledge and must not preserve sensitive non-teaching
details.

### `student_learning_signals`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `user_id` | `TEXT` | required, references `users(id)` |
| `conversation_id` | `TEXT` | optional tutor conversation id |
| `signal_type` | `TEXT` | required signal category |
| `signal_json` | `TEXT` | required sanitized teaching-useful signal JSON |
| `source_job_id` | `TEXT` | optional background job id |
| `created_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/background-ai` and
`apps/api/src/database/database.service.ts`.

Learning signals are DB memory for the current student only. They are not RAG
knowledge and must not preserve sensitive non-teaching personal details.
Batched mode writes grouped `learning_window`, derived `session_summary`, and
combined `profile_strategy_refresh` evidence here.

### `student_session_summaries`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `user_id` | `TEXT` | required, references `users(id)` |
| `conversation_id` | `TEXT` | optional tutor conversation id |
| `lesson_type` | `TEXT` | required lesson type |
| `summary_json` | `TEXT` | required compact sanitized session summary |
| `evidence_levels_json` | `TEXT` | required L0-L5 evidence-level summary |
| `source_window_id` | `TEXT` | optional reference to `background_analysis_windows(id)` |
| `source_job_id` | `TEXT` | optional reference to `background_ai_jobs(id)` |
| `created_at` | `TEXT` | required ISO timestamp |
| `updated_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/background-ai` and
`apps/api/src/database/database.service.ts`.

Session summaries are DB memory for the current student only. They store
compact session evidence for future teaching strategy:

- L0: raw turn data remains in `tutor_turns` and is referenced only by count or
  storage location.
- L1: sanitized turn observations are summarized from
  `background_learning_observations`.
- L2: compact session summary lives in `summary_json`.
- L3: learning signals are linked through `student_learning_signals`.
- L4: skill trend rows are linked through `student_skill_progress`.
- L5: strategy hints are consumed by profile/strategy refresh jobs.

### `student_skill_progress`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `user_id` | `TEXT` | required, references `users(id)` |
| `conversation_id` | `TEXT` | optional tutor conversation id |
| `lesson_type` | `TEXT` | required lesson type |
| `topic` | `TEXT` | required topic label |
| `skill` | `TEXT` | required skill label |
| `direction` | `TEXT` | required; `progress`, `regression`, `stable`, or `unknown` |
| `confidence` | `TEXT` | required; `low`, `medium`, `high`, or `unknown` |
| `support_needed` | `TEXT` | required; `none`, `hint`, `step_by_step`, `full_explanation`, or `unknown` |
| `independence` | `TEXT` | required; `low`, `medium`, `high`, or `unknown` |
| `evidence_json` | `TEXT` | required sanitized evidence and next-action hints |
| `source_window_id` | `TEXT` | optional reference to `background_analysis_windows(id)` |
| `source_job_id` | `TEXT` | optional reference to `background_ai_jobs(id)` |
| `created_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/background-ai` and
`apps/api/src/database/database.service.ts`.

Skill progress rows track progression or regression by topic and skill.
They are not grades and are used only to choose explanations, hints, pacing,
practice difficulty, repetition, or visual support.

### `lesson_sessions`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `user_id` | `TEXT` | required, references `users(id)` |
| `conversation_id` | `TEXT` | required tutor conversation id |
| `lesson_type` | `TEXT` | required lesson type |
| `status` | `TEXT` | required; `active`, `soft_limit_reached`, `hard_limit_reached`, `goal_reached`, or `finished` |
| `goal_status` | `TEXT` | required; `in_progress`, `reached`, `blocked`, or `stopped_by_limit` |
| `goal_text` | `TEXT` | required lesson goal |
| `success_criteria_json` | `TEXT` | required serialized success criteria |
| `finish_reason` | `TEXT` | optional stop/completion reason |
| `active_learning_seconds` | `INTEGER` | required active-learning heuristic total |
| `turn_count` | `INTEGER` | required tutor-turn count for the lesson session |
| `started_at` | `TEXT` | required ISO timestamp |
| `last_activity_at` | `TEXT` | required ISO timestamp |
| `finished_at` | `TEXT` | optional ISO timestamp |
| `created_at` | `TEXT` | required ISO timestamp |
| `updated_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/lesson`, `apps/api/src/tutor`, and
`apps/api/src/database/database.service.ts`.

Lesson sessions are DB memory for the current student. They track lesson goal
state, configurable daily/continuous learning-time heuristic status, and
goal-based stopping. The time-limit fields are product heuristics for pacing
and breaks, not clinical fatigue assessment. Active sessions are scoped by
conversation id and lesson type; a lesson-type switch finishes the previous
active session and starts a new one. The DTO exposes `goalStatusEvidence` so
callers can distinguish backend-observed completion, model-suggested pending
completion, learning-limit stops, and ordinary in-progress state without
adding a separate SQLite column in the POC.

### `lesson_effectiveness_signals`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `user_id` | `TEXT` | required, references `users(id)` |
| `lesson_session_id` | `TEXT` | required, references `lesson_sessions(id)` |
| `conversation_id` | `TEXT` | required tutor conversation id |
| `lesson_type` | `TEXT` | required lesson type |
| `goal_status` | `TEXT` | required goal status |
| `strategy_signal_json` | `TEXT` | required serialized progress/regression strategy signal |
| `answer_shape_json` | `TEXT` | required serialized answer-shape counts |
| `recommended_adjustment` | `TEXT` | optional strategy adjustment or finish reason |
| `created_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/lesson` and
`apps/api/src/database/database.service.ts`.

Effectiveness signals are teaching-only records used to connect recent
scoped progress/regression with explanation strategy. Strategy selection uses
rows relevant to the current conversation, lesson type, or inferred topic hint
instead of all recent rows for the user. They are not grades and must not store
sensitive non-teaching details.

### `ai_usage_ledger`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `user_id` | `TEXT` | optional user reference |
| `conversation_id` | `TEXT` | optional tutor conversation id |
| `lesson_session_id` | `TEXT` | optional reference to `lesson_sessions(id)` |
| `lesson_type` | `TEXT` | optional lesson type |
| `operation_key` | `TEXT` | required internal operation key |
| `operation` | `TEXT` | required normalized operation name |
| `assistant_role` | `TEXT` | required assistant role |
| `provider` | `TEXT` | required provider id |
| `model` | `TEXT` | required model name used by the provider facade |
| `response_format` | `TEXT` | required; `json`, `text`, or `image` |
| `service_tier` | `TEXT` | optional provider service tier |
| `input_tokens` | `INTEGER` | required, defaults to 0 |
| `cached_input_tokens` | `INTEGER` | required, defaults to 0 |
| `output_tokens` | `INTEGER` | required, defaults to 0 |
| `total_tokens` | `INTEGER` | required, defaults to 0 |
| `image_count` | `INTEGER` | required, defaults to 0 |
| `estimated_cost_usd` | `REAL` | required local cost estimate, defaults to 0 |
| `pricing_source` | `TEXT` | required; local pricing source label or `not_configured` |
| `created_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/usage`, `apps/api/src/ai-model`, and
`apps/api/src/database/database.service.ts`.

The usage ledger supports the signed-in user's visible lesson usage bar. It
stores operation/model/token/image counts and local cost estimates only. It
must not store raw prompts, hidden instructions, RAG chunks, provider request
ids, secrets, billing credentials, or another user's usage in a response.

### `tutor_turns`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `user_id` | `TEXT` | required, references `users(id)` |
| `conversation_id` | `TEXT` | required |
| `lesson_type` | `TEXT` | required lesson type |
| `prompt` | `TEXT` | required |
| `answer_json` | `TEXT` | required serialized tutor answer |
| `created_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/tutor`.

`answer_json` stores the structured tutor answer. The current response
contract includes ordered `blocks` for text, task, example, and image visual
plan blocks, while retaining legacy `answer`, `tasks`, `examples`,
`needsImage`, and `imagePrompt` fields for compatibility with background
analysis and older clients. Image bytes are not stored in `tutor_turns`;
generated images are remote provider outputs returned to the web client as
data URLs in the current POC.

## In-Memory State

### WebRTC Sessions

`WebRtcSessionService` stores session state in memory:

- session id
- conversation id
- timestamps
- status: `pending`, `active`, or `closed`
- preferred voice
- optional translation config
- SDP offer/answer
- queued ICE candidates

Closed sessions are cleaned from memory after the configured cleanup window.

### Conversations

`ConversationService` stores conversation records in memory:

- voice turns
- participant: user or assistant
- transcript fragments
- token usage counters
- finalized transcript metadata

This is not durable storage.

## File Artifacts

Transcript files are written under `TRANSCRIPT_LOG_DIR`, default `./logs`.

Local certificates under `.cert` enable development HTTPS. They are local
artifacts, not source truth or deployable secrets.

## Remote AI Provider Objects

The API uses an AI model provider facade. The current implemented provider is
OpenAI. The API creates or references:

- OpenAI Responses outputs
- OpenAI Images outputs
- OpenAI uploaded files
- OpenAI vector stores
- OpenAI vector store file attachments
- OpenAI Realtime sessions and client secrets

Remote provider state is not fully represented locally. Local
`knowledge_files` stores metadata only.

## Frontend Types

The web client defines DTO-like interfaces in `apps/web/src/types.ts`:

- `User`
- `TutorAnswer`
- `LessonType`
- `TutorResponseBlock`
- `TutorImageBlock`
- `TutorTask`
- `TutorExample`
- `TutorCitation`
- `TutorTurn`
- `DiagnosticAnswer`
- `StudentOnboardingAnswers`
- `StudentProfile`
- `StudentSessionSummary`
- `StudentSkillProgress`
- `StudentProfileStatus`
- `KnowledgeFile`
- `KnowledgeStatus`

Keep these aligned with API response contracts when API shape changes.

## Data Gaps

- POC schema migration ledger exists with transactional local application, but
  no production rollback, backfill, or backup workflow is defined.
- No retention policy is defined for users, tutor turns, uploaded file
  metadata, remote OpenAI files/vector stores, or transcript files.
- No export/delete account workflow is present.
- No backup/restore policy is defined.
- PII classification is limited to the current teaching-only profile memory
  and adapter-level safety notes.
