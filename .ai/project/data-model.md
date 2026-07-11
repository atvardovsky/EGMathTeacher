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
observation-window storage. This is a lightweight migration ledger, not a full
production rollback, backfill, or backup system.

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

### `background_learning_observations`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `user_id` | `TEXT` | required, references `users(id)` |
| `conversation_id` | `TEXT` | required tutor conversation id |
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
background signal extractor after every tutor turn. Observations are marked
processed only after a grouped learning-window model response succeeds.

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

### `tutor_turns`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `user_id` | `TEXT` | required, references `users(id)` |
| `conversation_id` | `TEXT` | required |
| `prompt` | `TEXT` | required |
| `answer_json` | `TEXT` | required serialized tutor answer |
| `created_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/tutor`.

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
- `TutorTask`
- `TutorExample`
- `TutorCitation`
- `TutorTurn`
- `DiagnosticAnswer`
- `StudentOnboardingAnswers`
- `StudentProfile`
- `StudentProfileStatus`
- `KnowledgeFile`
- `KnowledgeStatus`

Keep these aligned with API response contracts when API shape changes.

## Data Gaps

- POC schema migration ledger exists, but no production rollback, backfill, or
  backup workflow is defined.
- No retention policy is defined for users, tutor turns, uploaded file
  metadata, remote OpenAI files/vector stores, or transcript files.
- No export/delete account workflow is present.
- No backup/restore policy is defined.
- PII classification is limited to the current teaching-only profile memory
  and adapter-level safety notes.
