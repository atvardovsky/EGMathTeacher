# Knowledge Pack Runtime Repair Implementation Record

This record covers the fixed review gaps where the knowledge pack is imported
into SQLite and optional RAG, then used by lesson runtime services.

## Scope

Fixes covered by this implementation:

- 11: runtime curriculum routing does not read imported curriculum tables.
- 12: lesson task generation does not read `task_bank_tasks`.
- 13: knowledge-pack schema and cross-reference validation are missing.
- 14: incomplete structured packs can be reported as completed imports.
- 15: failed imports are not durably recorded in `knowledge_pack_imports`.
- 16: pack version is derived from manifest schema version instead of content
  release metadata.
- 17: removed structured records remain active after upsert-only import.
- 18: removed or renamed RAG files remain active in vector stores.
- 19: live RAG sync has partial-failure states without a recovery workflow.
- 20: RAG sync does not wait for vector-store indexing readiness.
- 21: zip/archive processing lacks explicit size, count, depth, and memory
  guardrails.
- 22: parallel sync processes can cause duplicate remote uploads before local
  uniqueness checks win.

Non-goals for this repair:

- no production privacy/legal policy
- no parent/teacher roles
- no full multi-provider RAG implementation
- no live OpenAI validation unless explicitly approved for that run
- no full ЕГЭ curriculum mastery engine beyond the imported task-bank-backed
  verticals that have implemented verifier contracts

## Runtime Truth

Current implementation state:

- `CurriculumService` reads active `curriculum_skills` rows from SQLite.
- Unknown topics remain `unknown` and do not fall back to the linear-equation
  skill.
- `MathVerifierService` asks `TaskBankService` for imported
  `task_bank_tasks` before using the POC empty-DB fallback task.
- `TaskBankService` returns imported hint ladders and orders reusable tasks by
  prior user exposure before deterministic difficulty/task id order.
- `TaskBankService` and `MathVerifierService` preserve canonical
  `source_task_id` and imported `common_errors` on lesson tasks so repeated
  copies of one task do not count as independent mastery evidence and hints
  can route through misconception playbooks.
- `MathVerifierService` records task-bank lesson tasks as
  `task_bank_imported`, logs the empty-DB generated fallback, and can reject
  fallback usage with `TASK_BANK_REQUIRED=true`.
- `MasteryPolicyService` reads imported `curriculum_mastery_criteria` and
  gates mastery evidence, progress rows, and practice/mistake-review
  completion. One correct answer remains only a verified attempt when the
  imported criteria require repeated independent success. The policy counts
  cumulative successes across lesson sessions, deduplicates independent
  successes by `source_task_id`, and requires imported criteria by default for
  supported verifier skills.
- Imported `curriculum_*` and `task_bank_tasks` rows are the active runtime
  source for lesson routing and supported task selection.
- Structured import validates required files, required fields, enum-like
  verifier kinds, JSONL line parsing, and core cross references before writes.
- Removed structured records are soft-retired with `sync_status='retired'`.
- RAG sync is idempotent for same-path content changes and reconciles deleted
  or renamed source paths only during strict authoritative RAG sync. Partial
  packs do not remove absent vector-store files.
- The CLI remains a trusted local operator workflow, but now has strict/partial
  import modes, optional wait-ready, durable sync jobs, and recoverable failed
  RAG job retry.

## Target Logic

The repaired flow should be:

```text
validated knowledge pack
-> SQLite curriculum and task-bank tables
-> DB-backed curriculum resolver
-> task-bank-backed task selection
-> canonical source task identity and common-error metadata
-> supported verifier contract
-> student attempt
-> deterministic verifier
-> mastery policy from curriculum_mastery_criteria
-> mastery evidence only when policy accepts the evidence sequence
-> lesson policy completion
```

Rules:

- Imported structured DB rows become the source for curriculum and task-bank
  runtime lookups after validation.
- Unknown, low-confidence, or ambiguous topic resolution must remain `unknown`
  or trigger clarification. It must not silently fall back to linear equations.
- A task can produce verified mastery only when its `verifier_kind` is
  implemented by backend code.
- RAG remains shared teaching/reference knowledge for the AI. Student profile
  memory remains in SQLite, not in RAG.
- OpenAI vector-store writes stay operator-triggered and must support dry-run,
  idempotency, reconciliation, retry, and recovery.

## Phase 1: Runtime Connection

Status: implemented.

Implementation steps:

Implemented:

- `CurriculumService.resolve()` reads active SQLite curriculum skills.
- No-match, low-confidence, and tied ambiguous routing returns `unknown` with
  candidate context for debugging/clarification.
- `TaskBankService.selectTask()` reads active `task_bank_tasks` by topic,
  skill, task type, verifier kind, and prior task use, and returns hint
  ladders plus common-error ids for tutor/verifier context.
- `MathVerifierService.ensureBackendTask()` selects imported task-bank rows for
  supported verifier kinds, stores `task_bank_imported`, and keeps hardcoded
  generation only as a logged POC fallback that can be disabled with
  `TASK_BANK_REQUIRED=true`.
- `MasteryPolicyService` enforces imported mastery criteria before
  `mastery_evidence` or progress rows are written, using cumulative
  cross-lesson evidence and source-task deduplication.
- `HintRoutingService` maps verifier errors plus task-bank `common_errors` to
  imported `curriculum_misconceptions` hints before falling back to the hint
  ladder.

Tests:

- unknown topic does not resolve to linear equations;
- imported linear skill resolves from DB;
- unsupported imported skill can route context but cannot produce verified
  mastery;
- task-bank task is selected and persisted to `lesson_tasks`;
- task-bank source task ids and common-error ids are persisted to
  `lesson_tasks`;
- a pending task is reused instead of generating a duplicate;
- deterministic verifier writes `student_attempts` for selected linear tasks;
- imported mastery criteria can prevent one successful attempt from writing
  `mastery_evidence`, then allow mastery after the required independent
  success sequence;
- repeated copies of the same `source_task_id` do not satisfy independent
  success requirements;
- a verified success from a prior lesson session can count toward cumulative
  mastery when the current attempt provides fresh deterministic evidence;
- common-error ids route hints through imported misconception rows;
- `TASK_BANK_REQUIRED=true` fails instead of silently using the generated
  fallback when no task-bank row exists.

## Phase 2: Import Validation And Metadata

Status: implemented.

Implemented:

- Added pack identity fields to the import ledger:
  - `pack_version`
  - `schema_version`
  - `content_release`
  - `generated_at`
  - `pack_content_hash`
  - `import_mode`
  - `warnings_json`
- Full-pack import defaults to `strict` mode: every required structured file
  must exist and validate.
- Added explicit `partial` mode for local development with warnings recorded in
  the ledger.
- Validates JSON/JSONL before writing tables:
  - required fields;
  - enum values;
  - non-empty canonical ids;
  - expected array/object shapes;
  - JSONL line-level parse errors;
  - cross-reference ids for topics, skills, task types, prerequisites,
    misconceptions, and task-bank rows.
- Records failed imports in `knowledge_pack_imports` with failure reason and
  counts known at failure time.
- Replaces silent empty-string/empty-array coercion with validation errors for
  required fields.
- Soft-retires removed structured records via `sync_status` and `retired_at`
  because old lesson evidence may reference prior curriculum ids.

Tests:

- missing required file fails in strict mode;
- missing required file succeeds only in partial mode and records warnings;
- bad enum/required field/cross-reference fails before table writes;
- failed import writes a failed ledger row;
- new pack version can retire records missing from the latest pack without
  breaking historical lesson rows.

## Phase 3: RAG Sync Reconciliation And Recovery

Status: implemented for local operator workflows.

Implemented:

- Added a durable sync job table for knowledge-pack sync operations.
- Uses a local SQLite claim before remote upload.
- Reconciles current pack RAG source paths against active
  `knowledge_files.source_path` rows only when the current sync is strict and
  authoritative:
  - unchanged paths are skipped;
  - changed paths upload the new file and supersede the old attachment only
    after replacement indexing is completed when wait-ready is requested;
  - missing paths are detached and marked `superseded` or `retired`;
  - renamed paths behave as missing old path plus new path unless a future
    manifest explicitly maps rename identity.
- Stores remote sync state transitions:
  `planned`, `uploaded`, `attached`, `indexed`, `cleanup_pending`,
  `completed`, and `failed`.
- Added `--recover-rag` for failed or attached-timeout jobs that recorded
  recoverable OpenAI file ids.
- Added optional wait-for-index behavior that polls vector-store file status
  until terminal `completed` or `failed`. Jobs are marked `indexed` only after
  `completed`; timeout leaves the job attached with timeout metadata, stores
  the new file as `sync_status='indexing'`, and keeps stale active attachments
  in place until recovery promotes the replacement. Recovery waits by default,
  and explicit no-wait recovery leaves queued replacements in `indexing`
  instead of promoting them or cleaning stale attachments. For production-like
  sync, waiting should be the default; dry-run never waits or calls OpenAI.
- Active project vector-store ids in `project_ai_resources` are updated
  only after a successful attach or explicit existing-store reuse.

Tests:

- removed pack Markdown path is planned for detach;
- renamed path produces one new upload and one retired old path;
- partial upload/attach/DB failures are recoverable without duplicate active
  local rows;
- wait-ready handles completed, failed, and timeout states;
- no-wait recovery does not promote queued replacement files;
- local concurrent sync attempts cannot both claim the same pack/vector-store
  job inside SQLite transaction boundaries.

## Phase 4: Archive Guardrails

Status: implemented for local directory and zip processing.

Implemented:

- Preflights zip or extracted directory with:
  - max archive size;
  - max total unpacked/read size;
  - max file count;
  - max single-file size;
  - max directory depth;
  - path traversal and absolute-path rejection;
  - allowed extension list for structured and RAG files.
- Keeps `EGMathTeacher-knowledge-pack-v1.0.zip` and extracted pack directories
  uncommitted local artifacts.
- Documents that the CLI remains trusted local operator input even with
  guardrails; non-dry-run RAG sync is a protected live OpenAI operation.

Tests:

- path traversal archive is rejected;
- oversized file and too-many-files packs are rejected;
- valid pack still imports and dry-run syncs.

## Phase 5: Documentation, Diagrams, And Validation

Required documentation sync after implementation:

- `README.md`
- `apps/api/README.md`
- `.ai/project/blueprint.md`
- `.ai/project/use-cases.md`
- `.ai/project/architecture.md`
- `.ai/project/runtime-flows.md`
- `.ai/project/data-model.md`
- `.ai/project/security-safety.md`
- `.ai/project/validation.md`
- `.ai/project/gaps.md`
- `.ai/project/diagrams/*.mmd`
- rendered diagram SVG artifacts

Required validation for implementation:

- `npm run build`
- `npm test`
- `npm run lint`
- `npm run diagrams:render` when diagram sources change
- `npm run diagrams:check`
- `npm run alatyr:check`
- mocked RAG sync tests for live OpenAI boundaries
- real-pack import smoke in a temporary SQLite database
- RAG `--dry-run` against the real pack

Live non-dry-run `--sync-rag` remains a protected action because it can create,
upload, attach, and detach OpenAI files/vector-store attachments.
