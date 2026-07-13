# EGMathTeacher Data Model

This file records local, in-memory, file, and remote data owned or referenced
by EGMathTeacher.

## Local SQLite Database

SQLite is initialized in `apps/api/src/database/database.service.ts`.

Default path: `./data/app.sqlite` from `SQLITE_PATH`.
When the root `npm run knowledge:sync` operator command launches the
knowledge-pack CLI from the repository root, the CLI defaults `SQLITE_PATH` to
`apps/api/data/app.sqlite` and loads `apps/api/.env` so imports target the same
runtime database as the development API.

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
effectiveness signals, and the AI usage ledger, migration
`006_lesson_decision_agent` after adding decision observability, and migration
`007_verified_learning_loop` after adding request idempotency, local
curriculum seeds, backend lesson tasks, student attempts, mastery evidence,
and usage/decision correlation ids, and migration
`008_knowledge_pack_ingestion` after adding knowledge-pack import ledgers,
structured curriculum/task-bank tables, project AI resource ids, and
source-path/content-hash RAG sync metadata, migration
`009_knowledge_pack_runtime_repair` after adding pack identity, validation,
retirement, sync-job, and recovery metadata, and migration
`010_mastery_policy_and_task_source` after adding mastery-policy attempt
metadata, task-bank task source semantics, and stored hint ladders on lesson
tasks, migration `011_task_identity_and_indexing_state` after adding
canonical `source_task_id`, common-error ids, and RAG indexing state, and
migration `012_generated_task_identity_normalization` after normalizing
backend-generated fallback task identities to the same generated formula used
at runtime.
Migrations are applied inside a local SQLite transaction, and table-rebuild
migrations must pass `PRAGMA foreign_key_check` before the version is
recorded. This is a lightweight migration ledger, not a full production
rollback, backfill, or backup system.

Knowledge-pack repair behavior is recorded in
`.ai/project/knowledge-pack-runtime-repair-plan.md`. The local POC schema now
stores pack identity metadata, import mode/warnings, failed-import evidence,
active/retired source state, durable sync-job/claim state, and
mastery-policy attempt metadata.

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
| `source_kind` | `TEXT` | required; `manual_upload` or a sync source such as `knowledge_pack_student_rag` |
| `source_path` | `TEXT` | optional source-relative path for imported/synced files |
| `source_pack_version` | `TEXT` | optional knowledge-pack version |
| `content_hash` | `TEXT` | optional SHA-256 content hash for idempotent sync |
| `sync_status` | `TEXT` | required; `active`, `indexing`, `superseded`, `failed`, or `cleanup_failed` |
| `superseded_at` | `TEXT` | optional ISO timestamp when replaced by a newer synced file |
| `error_message` | `TEXT` | optional cleanup/sync error |
| `created_at` | `TEXT` | required ISO timestamp |
| `updated_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/knowledge`.

Manual admin uploads use `source_kind=manual_upload`. Knowledge-pack RAG sync
uses `source_kind=knowledge_pack_student_rag`, stores the source path and hash,
skips unchanged files, and marks older synced rows `superseded` after the
remote vector-store attachment has been detached. When `--wait-ready` times
out, the new replacement row stays `indexing` and the older active row remains
attached until recovery later confirms remote `completed`. If remote cleanup
fails, the row is kept visible as `cleanup_failed`. Deleted or renamed
knowledge-pack Markdown paths are reconciled against active RAG rows only
during strict authoritative sync. Partial packs do not retire absent RAG paths.

### `project_ai_resources`

| Column | Type | Rule |
| --- | --- | --- |
| `resource_key` | `TEXT` | primary key, for example `student_rag_vector_store` |
| `provider` | `TEXT` | required provider id |
| `resource_type` | `TEXT` | required external resource type |
| `resource_id` | `TEXT` | required external id |
| `metadata_json` | `TEXT` | required local metadata |
| `created_at` | `TEXT` | required ISO timestamp |
| `updated_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/knowledge`.

This table stores local project-level external AI resource ids. The current
use is the active OpenAI student RAG vector store when
`OPENAI_VECTOR_STORE_IDS` is not configured.

### `knowledge_source_files`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `source_pack_version` | `TEXT` | required knowledge-pack version |
| `relative_path` | `TEXT` | required path inside the pack |
| `target_kind` | `TEXT` | required; `db_structured`, `student_rag`, or `metadata` |
| `content_hash` | `TEXT` | required SHA-256 hash |
| `size_bytes` | `INTEGER` | required source file size |
| `status` | `TEXT` | required; `pending`, `imported`, `synced`, `skipped`, or `failed` |
| `knowledge_file_id` | `TEXT` | optional reference to `knowledge_files(id)` |
| `metadata_json` | `TEXT` | required import/sync metadata |
| `error_message` | `TEXT` | optional import/sync error |
| `created_at` | `TEXT` | required ISO timestamp |
| `updated_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/knowledge/knowledge-pack.service.ts`.

This is the local idempotency ledger for knowledge-pack source files.

Structured import now validates required files, required fields, enum-like
verifier kinds, JSONL line parsing, and core cross-reference integrity before
writing runtime tables. Removed structured ids are soft-retired in their owning
runtime tables.

### `knowledge_pack_imports`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `pack_version` | `TEXT` | required knowledge-pack version |
| `schema_version` | `TEXT` | optional manifest schema version |
| `content_release` | `TEXT` | optional content release/version identity |
| `generated_at` | `TEXT` | optional pack generation timestamp |
| `pack_content_hash` | `TEXT` | optional whole-pack content hash |
| `root_path` | `TEXT` | required local root processed by the CLI |
| `import_kind` | `TEXT` | required; `structured`, `rag`, or `structured_and_rag` |
| `import_mode` | `TEXT` | required; `strict` or `partial` |
| `status` | `TEXT` | required; `completed` or `failed` |
| `structured_file_count` | `INTEGER` | required count |
| `rag_file_count` | `INTEGER` | required count |
| `imported_row_count` | `INTEGER` | required count |
| `uploaded_file_count` | `INTEGER` | required count |
| `skipped_file_count` | `INTEGER` | required count |
| `warnings_json` | `TEXT` | required serialized warning list |
| `error_message` | `TEXT` | optional failure reason |
| `started_at` | `TEXT` | required ISO timestamp |
| `completed_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/knowledge/knowledge-pack.service.ts`.

The ledger records completed and failed sync attempts. `pack_version`,
`schema_version`, `content_release`, `generated_at`, and
`pack_content_hash` are stored separately so schema version is not confused
with content release identity.

### `knowledge_pack_sync_jobs`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `job_key` | `TEXT` | required unique claim key |
| `source_pack_version` | `TEXT` | required pack version |
| `vector_store_id` | `TEXT` | required OpenAI vector-store id or target id |
| `source_path` | `TEXT` | optional pack source path |
| `content_hash` | `TEXT` | optional source content hash |
| `job_kind` | `TEXT` | required; `student_rag_file` or `student_rag_reconcile` |
| `status` | `TEXT` | required; `planned`, `running`, `uploaded`, `attached`, `indexed`, `cleanup_pending`, `completed`, or `failed` |
| `attempts` | `INTEGER` | required retry count |
| `metadata_json` | `TEXT` | required remote/local sync metadata |
| `error_message` | `TEXT` | optional failure reason |
| `claimed_at` | `TEXT` | optional ISO timestamp |
| `completed_at` | `TEXT` | optional ISO timestamp |
| `created_at` | `TEXT` | required ISO timestamp |
| `updated_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/knowledge/knowledge.service.ts`.

This table locally claims RAG upload/attach jobs before remote side effects,
tracks state transitions, and supports `--recover-rag` for failed jobs and
attached timeout jobs that recorded a recoverable OpenAI file id. Claims are
made inside a local SQLite transaction. `indexed` means the remote vector-store
file status reached `completed`; wait-ready timeout or no-wait queued status
leaves the job attached with timeout metadata and the local `knowledge_files`
row in `indexing`. Recovery waits by default, and queued replacements are not
promoted to `active` or allowed to clean stale attachments until the remote
status is `completed`.

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
`GET /usage/me/summary` may expose only safe projections of this table for the
signed-in user: job type, status, attempts, timestamps, compact sanitized
result preview, and stored error message. It must not expose raw
`payload_json`, hidden instructions, stack traces, or another user's jobs.

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
adding a separate SQLite column in the POC. The DTO also exposes
`goalEvidenceLevel`; accepted action-level evidence is stored in
`lesson_decisions`.

`GET /tutor/lessons?scope=active|history|all` reads `lesson_sessions` as the
canonical saved-lesson record, then joins recent `tutor_turns` and the latest
`student_session_summaries` for display context. Active scope returns only
non-terminal sessions that can reuse their `conversation_id`; history scope
returns terminal sessions for read-only review.

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

### `lesson_decisions`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `user_id` | `TEXT` | required, references `users(id)` |
| `lesson_session_id` | `TEXT` | required, references `lesson_sessions(id)` |
| `conversation_id` | `TEXT` | required tutor conversation id |
| `lesson_type` | `TEXT` | required lesson type |
| `operation_key` | `TEXT` | required model operation key |
| `operation` | `TEXT` | required normalized operation name |
| `assistant_role` | `TEXT` | required assistant role |
| `provider` | `TEXT` | required provider id |
| `model` | `TEXT` | required model name resolved by operation policy |
| `tool_name` | `TEXT` | required lesson-agent tool/action name |
| `decision_json` | `TEXT` | required sanitized structured Lesson Decision Agent output |
| `policy_result_json` | `TEXT` | required backend policy result for this action |
| `accepted` | `INTEGER` | required; `0` or `1` |
| `rejection_reason` | `TEXT` | optional backend rejection reason |
| `evidence_level` | `TEXT` | required; `none`, `self_reported`, `agent_interpreted`, `attempt_submitted`, `deterministically_verified`, or `repeated_independent_success` |
| `verifier_result` | `TEXT` | optional verifier status when available |
| `latency_ms` | `INTEGER` | required local decision latency |
| `retry_count` | `INTEGER` | required retry/fallback marker in the POC |
| `lesson_outcome` | `TEXT` | optional compact outcome label |
| `created_at` | `TEXT` | required ISO timestamp |
| `usage_correlation_id` | `TEXT` | optional local correlation id shared with `ai_usage_ledger` |
| `fallback_used` | `INTEGER` | required; `0` or `1` decision fallback marker |
| `profile_delta_routed` | `INTEGER` | required; `0` or `1` marker for background-routed profile hypotheses |

Source owner: `apps/api/src/lesson`, `apps/api/src/ai-model`, and
`apps/api/src/database/database.service.ts`.

Lesson decision rows provide action-level observability for the agent-directed,
backend-governed lesson loop. They store proposed tool actions and policy
results, not raw hidden prompts, provider request ids, billing credentials, or
clinical/student personality labels. They are debug/product evidence for
teaching flow quality and cost-per-outcome analysis, not grades.

### `curriculum_skills`

| Column | Type | Rule |
| --- | --- | --- |
| `skill_id` | `TEXT` | primary key canonical skill id |
| `topic_id` | `TEXT` | required canonical topic id |
| `topic_title` | `TEXT` | required human-readable topic title |
| `skill_title` | `TEXT` | required human-readable skill title |
| `task_type_id` | `TEXT` | required canonical task type id |
| `task_type_title` | `TEXT` | required human-readable task type title |
| `verifier_kind` | `TEXT` | required verifier kind, currently `linear_equation_numeric` or `unsupported` |
| `created_at` | `TEXT` | required timestamp |
| `description` | `TEXT` | optional imported skill description |
| `prerequisites_json` | `TEXT` | optional imported prerequisite skill ids |
| `task_type_ids_json` | `TEXT` | optional imported task-type ids |
| `typical_misconceptions_json` | `TEXT` | optional imported misconception ids |
| `explanation_methods_json` | `TEXT` | optional imported teaching methods |
| `minimum_mastery_criterion` | `TEXT` | optional imported mastery criterion |
| `verification_methods_json` | `TEXT` | optional imported verification methods |
| `recommended_lesson_type` | `TEXT` | optional imported lesson-type hint |
| `deterministic_verification` | `TEXT` | optional imported verifier availability |
| `difficulty` | `TEXT` | optional imported difficulty band |
| `estimated_learning_minutes` | `INTEGER` | optional imported estimate |
| `source_pack_version` | `TEXT` | optional knowledge-pack version |
| `source_path` | `TEXT` | optional source-relative path |
| `content_hash` | `TEXT` | optional source file SHA-256 |
| `sync_status` | `TEXT` | required; `active` or `retired` |
| `retired_at` | `TEXT` | optional ISO timestamp for soft-retired imported rows |
| `updated_at` | `TEXT` | optional update timestamp |

Source owner: `apps/api/src/lesson/curriculum.service.ts` and
`apps/api/src/database/database.service.ts`.

The current POC seeds a minimal curriculum registry. Only
`algebra.linear.solve_one_variable` has a deterministic verifier. Other seeded
skills are routing context and remain unsupported for verified mastery. The
knowledge-pack importer can upsert the broader curriculum skill registry into
this table and soft-retire removed imported rows. `CurriculumService` reads
active rows from this table while preserving the runtime rule that only
implemented verifier contracts can produce verified mastery. Unknown topics
remain `unknown` instead of falling back to a hardcoded skill.

### `curriculum_topics`

| Column | Type | Rule |
| --- | --- | --- |
| `topic_id` | `TEXT` | primary key |
| `title` | `TEXT` | required |
| `exam_track` | `TEXT` | required |
| `prerequisite_topic_ids_json` | `TEXT` | required serialized topic ids |
| `skill_ids_json` | `TEXT` | required serialized skill ids |
| `theory_document_id` | `TEXT` | optional RAG theory document id |
| `status` | `TEXT` | required source status |
| `source_pack_version` | `TEXT` | required knowledge-pack version |
| `source_path` | `TEXT` | required source-relative path |
| `content_hash` | `TEXT` | required source file SHA-256 |
| `created_at` | `TEXT` | required ISO timestamp |
| `updated_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/knowledge/knowledge-pack.service.ts`.

Knowledge-pack runtime tables include `sync_status` (`active`/`retired`) and
`retired_at` where imported rows can be soft-retired when a later pack omits
their ids.

### `curriculum_task_types`

| Column | Type | Rule |
| --- | --- | --- |
| `task_type_id` | `TEXT` | primary key |
| `title` | `TEXT` | required |
| `exam_track` | `TEXT` | required |
| `response_kind` | `TEXT` | required |
| `runtime_verifier_kind` | `TEXT` | required runtime verifier support marker |
| `planned_verifier_kind` | `TEXT` | required planned verifier kind |
| `year_binding` | `TEXT` | optional annual source binding |
| `source_pack_version` | `TEXT` | required knowledge-pack version |
| `source_path` | `TEXT` | required source-relative path |
| `content_hash` | `TEXT` | required source file SHA-256 |
| `created_at` | `TEXT` | required ISO timestamp |
| `updated_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/knowledge/knowledge-pack.service.ts`.

Task types are reactivated on import and soft-retired when missing from a
later validated pack.

### `curriculum_prerequisite_edges`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `edge_type` | `TEXT` | required; `topic` or `skill` |
| `from_id` | `TEXT` | required prerequisite topic/skill id |
| `to_id` | `TEXT` | required dependent topic/skill id |
| `relation` | `TEXT` | required relation label |
| `source_pack_version` | `TEXT` | required knowledge-pack version |
| `source_path` | `TEXT` | required source-relative path |
| `content_hash` | `TEXT` | required source file SHA-256 |
| `created_at` | `TEXT` | required ISO timestamp |
| `updated_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/knowledge/knowledge-pack.service.ts`.

Prerequisite edges are reactivated on import and soft-retired when missing
from a later validated pack.

### `curriculum_mastery_criteria`

Stores imported mastery criteria per skill, including required evidence
sequence, self-report/single-success completion flags, recheck cadence, and
regression trigger. Source owner:
`apps/api/src/knowledge/knowledge-pack.service.ts`.

### `curriculum_misconceptions`

Stores imported misconception playbook rows with observable signs, possible
causes, first diagnostic question, first/second hints, prerequisite check,
retry-task rule, and forbidden inference. Source owner:
`apps/api/src/knowledge/knowledge-pack.service.ts`.

### `error_classification_entries`

Stores imported error-classification material as typed entries:
`error_kind`, `classification_level`, `misconception_id`, or
`global_constraint`. `global_constraint` accepts either keyed objects or
ordered string arrays from the knowledge pack; arrays are stored with stable
`constraint_N` keys. Source owner:
`apps/api/src/knowledge/knowledge-pack.service.ts`.

### `lesson_type_plans`

Stores imported lesson-plan phase definitions, goal, lesson mix,
transition criteria, evidence requirement, reflection/review frequency,
mock-exam placement, and prerequisite-return rule. Source owner:
`apps/api/src/knowledge/knowledge-pack.service.ts`.

### `task_bank_tasks`

| Column | Type | Rule |
| --- | --- | --- |
| `task_id` | `TEXT` | primary key |
| `topic_id` | `TEXT` | required canonical topic id |
| `skill_id` | `TEXT` | required canonical skill id |
| `task_type_id` | `TEXT` | required canonical task type id |
| `difficulty` | `TEXT` | required difficulty label |
| `prompt` | `TEXT` | required student-visible prompt |
| `expected_answer` | `TEXT` | required backend answer; not shown before attempt |
| `solution_steps_json` | `TEXT` | required serialized solution steps |
| `common_errors_json` | `TEXT` | required serialized error ids |
| `hint_ladder_json` | `TEXT` | required serialized hint ladder |
| `verifier_kind` | `TEXT` | required known task-bank verifier kind; may be planned-only and not backend-verifiable yet |
| `source_type` | `TEXT` | required pack source type |
| `verification_json` | `TEXT` | required source verification metadata |
| `task_bank_file` | `TEXT` | required source JSONL filename |
| `source_pack_version` | `TEXT` | required knowledge-pack version |
| `source_path` | `TEXT` | required source-relative path |
| `content_hash` | `TEXT` | required source file SHA-256 |
| `created_at` | `TEXT` | required ISO timestamp |
| `updated_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/knowledge/knowledge-pack.service.ts`.

`MathVerifierService.ensureBackendTask()` selects active task-bank rows for
backend-supported verifier kinds before falling back to the POC generated
task. Unsupported but known task-bank verifier kinds remain stored for routing,
RAG context, future verifier work, and task-bank completeness, but do not
produce deterministic mastery evidence.

### `lesson_tasks`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `user_id` | `TEXT` | required, references `users(id)` |
| `lesson_session_id` | `TEXT` | required, references `lesson_sessions(id)` |
| `conversation_id` | `TEXT` | required tutor conversation id |
| `lesson_type` | `TEXT` | required lesson type |
| `topic_id` | `TEXT` | required curriculum topic id |
| `skill_id` | `TEXT` | required curriculum skill id |
| `task_type_id` | `TEXT` | required curriculum task type id |
| `source_task_id` | `TEXT` | required canonical imported/generated task identity |
| `prompt` | `TEXT` | required student-visible task prompt |
| `expected_answer` | `TEXT` | required backend verifier answer, not exposed in tutor response |
| `verifier_kind` | `TEXT` | required verifier kind |
| `source` | `TEXT` | required; `backend_generated`, `model_imported`, or `task_bank_imported` |
| `status` | `TEXT` | required; `pending`, `attempted`, `verified_correct`, or `blocked` |
| `hint_ladder_json` | `TEXT` | optional serialized task-bank hint ladder |
| `common_errors_json` | `TEXT` | optional serialized task-bank misconception/error ids |
| `created_at` | `TEXT` | required ISO timestamp |
| `updated_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/lesson/math-verifier.service.ts` and
`apps/api/src/database/database.service.ts`.

Lesson tasks are the first proof surface for deterministic practice. For the
current verified vertical, the service selects imported `task_bank_tasks` rows
when available and records them as `task_bank_imported`; the hardcoded linear
equation remains only as a logged POC empty-DB fallback with
`backend_generated`. `source_task_id` is the identity used by mastery policy to
deduplicate repeated copies of the same task across lessons. `common_errors_json`
feeds misconception-aware hint routing before the generic hint ladder is used.
`TASK_BANK_REQUIRED=true` disables the empty-DB fallback.

### `student_attempts`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `task_id` | `TEXT` | required, references `lesson_tasks(id)` |
| `user_id` | `TEXT` | required, references `users(id)` |
| `lesson_session_id` | `TEXT` | required, references `lesson_sessions(id)` |
| `conversation_id` | `TEXT` | required tutor conversation id |
| `answer_text` | `TEXT` | required bounded submitted answer text |
| `verifier_result` | `TEXT` | required; `correct`, `incorrect`, `equivalent`, `partially_correct`, `invalid_format`, or `cannot_verify` |
| `expected_answer` | `TEXT` | optional backend expected answer for audit/debug |
| `error_code` | `TEXT` | optional compact error classification |
| `confidence` | `TEXT` | required verifier confidence |
| `mastery_update_allowed` | `INTEGER` | required; `0` or `1` |
| `mastery_policy_json` | `TEXT` | optional serialized `MasteryPolicyService` result for the attempt |
| `created_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/lesson/math-verifier.service.ts` and
`apps/api/src/database/database.service.ts`.

Attempts are proof records for a concrete backend task. They are not grades,
and they are not automatically mastery evidence. Correct/equivalent attempts
become durable mastery only when `MasteryPolicyService` accepts the imported
evidence criteria for the skill. The policy counts cumulative successful
attempts across lesson sessions, but independent successes are distinct
canonical `lesson_tasks.source_task_id` values. If
`MASTERY_CRITERIA_REQUIRED=true` and no active criteria row exists, supported
verifier skills cannot write mastery evidence.

### `mastery_evidence`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `user_id` | `TEXT` | required, references `users(id)` |
| `lesson_session_id` | `TEXT` | required, references `lesson_sessions(id)` |
| `task_id` | `TEXT` | required, references `lesson_tasks(id)` |
| `attempt_id` | `TEXT` | required, references `student_attempts(id)` |
| `topic_id` | `TEXT` | required curriculum topic id |
| `skill_id` | `TEXT` | required curriculum skill id |
| `task_type_id` | `TEXT` | required curriculum task type id |
| `evidence_level` | `TEXT` | required; `deterministically_verified` or `repeated_independent_success` |
| `verifier_result` | `TEXT` | required verifier result |
| `outcome` | `TEXT` | required compact outcome label |
| `created_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/lesson/math-verifier.service.ts` and
`apps/api/src/database/database.service.ts`.

Mastery evidence links policy-accepted verified attempts to a topic/skill/task
type. Usage summaries use it to compute cost per verified learning outcome.

### `ai_usage_ledger`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `correlation_id` | `TEXT` | optional local correlation id shared with decision rows |
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
If local pricing is absent, `pricing_source` is `not_configured` and
`estimated_cost_usd` remains `0`; the UI must label that as missing pricing
rather than presenting it as a provider bill. For image operations, provider
token usage is used when present; when GPT-Image-2 image output usage is
absent, the POC estimates output tokens from requested size and quality before
applying the configured token price.

### `tutor_turns`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `user_id` | `TEXT` | required, references `users(id)` |
| `conversation_id` | `TEXT` | required |
| `request_id` | `TEXT` | optional client request id for idempotent retry handling |
| `lesson_type` | `TEXT` | required lesson type |
| `prompt` | `TEXT` | required |
| `answer_json` | `TEXT` | required serialized tutor answer |
| `created_at` | `TEXT` | required ISO timestamp |

Source owner: `apps/api/src/tutor`.

`answer_json` stores the structured tutor answer. The current response
contract includes ordered `blocks` for text, task, example, and image visual
plan blocks, while retaining legacy `answer`, `tasks`, `examples`,
`needsImage`, and `imagePrompt` fields for compatibility with background
analysis and older clients. When `POST /tutor/image` receives tutor-turn and
image-block identity, the generated PNG data URL is persisted back into the
matching image block in `answer_json` so resumed POC lessons can show the
visual. This is local POC continuity storage, not a production media-storage
design.

The saved-lessons endpoint also uses `tutor_turns` directly for turn previews
and backward-compatible legacy history. When a conversation has stored turns
but no `lesson_sessions` row, the API exposes it through history as a
read-only record with a synthetic `legacy_<conversationId>` session id. It is
visible for review, but the client must start a new lesson before sending new
prompts.

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
`knowledge_files`, `knowledge_source_files`, `knowledge_pack_imports`, and
`project_ai_resources` store sync metadata, source hashes, and active resource
ids; OpenAI remains the owner of uploaded file bytes, vector indexes, and
remote processing state.

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
