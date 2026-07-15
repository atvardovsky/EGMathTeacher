import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { DatabaseSync } from 'node:sqlite';

interface MigrationOptions {
  disableForeignKeys?: boolean;
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly db: DatabaseSync;

  constructor(private readonly configService: ConfigService) {
    const configuredPath = this.configService.get<string>('app.sqlitePath') ?? './data/app.sqlite';
    const sqlitePath = resolve(configuredPath);
    mkdirSync(dirname(sqlitePath), { recursive: true });
    this.db = new DatabaseSync(sqlitePath);
    this.initialize();
    this.logger.log(`SQLite database ready at ${sqlitePath}`);
  }

  onModuleDestroy(): void {
    this.db.close();
  }

  run(sql: string, params: unknown[] = []): { changes: number; lastInsertRowid: number | bigint } {
    return this.db.prepare(sql).run(...params);
  }

  get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  transaction<T>(work: () => T): T {
    let transactionStarted = false;
    try {
      this.db.exec('BEGIN IMMEDIATE;');
      transactionStarted = true;
      const result = work();
      this.db.exec('COMMIT;');
      transactionStarted = false;
      return result;
    } catch (error) {
      if (transactionStarted) {
        this.rollbackTransaction();
      }
      throw error;
    }
  }

  private initialize(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    this.applyMigration('001_initial_schema', `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'student')),
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS knowledge_files (
        id TEXT PRIMARY KEY,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        openai_file_id TEXT NOT NULL,
        vector_store_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tutor_turns (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        prompt TEXT NOT NULL,
        answer_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS student_profiles (
        user_id TEXT PRIMARY KEY,
        onboarding_completed_at TEXT NOT NULL,
        onboarding_answers_json TEXT NOT NULL,
        knowledge_state_json TEXT NOT NULL,
        learning_preferences_json TEXT NOT NULL,
        psychological_profile_json TEXT NOT NULL,
        explanation_strategy_json TEXT NOT NULL,
        ai_summary TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    this.applyMigration('002_background_ai_jobs', `
      CREATE TABLE IF NOT EXISTS background_ai_jobs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN (
          'learning_signal_extraction',
          'session_summary',
          'student_profile_refresh',
          'teaching_strategy_refresh',
          'tutor_quality_review'
        )),
        status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
        user_id TEXT NOT NULL,
        conversation_id TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        payload_json TEXT NOT NULL,
        result_json TEXT,
        error_message TEXT,
        scheduled_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_background_ai_jobs_status_scheduled
        ON background_ai_jobs(status, scheduled_at);

      CREATE INDEX IF NOT EXISTS idx_background_ai_jobs_user_type
        ON background_ai_jobs(user_id, type, status);

      CREATE TABLE IF NOT EXISTS student_learning_signals (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        conversation_id TEXT,
        signal_type TEXT NOT NULL,
        signal_json TEXT NOT NULL,
        source_job_id TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (source_job_id) REFERENCES background_ai_jobs(id)
      );

      CREATE INDEX IF NOT EXISTS idx_student_learning_signals_user_created
        ON student_learning_signals(user_id, created_at);
    `);

    this.applyMigration('003_background_observation_windows', `
      DROP TABLE IF EXISTS background_ai_jobs_next;
      CREATE TABLE IF NOT EXISTS background_ai_jobs_next (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN (
          'learning_signal_extraction',
          'learning_window_analysis',
          'session_summary',
          'student_profile_refresh',
          'profile_strategy_refresh',
          'teaching_strategy_refresh',
          'tutor_quality_review'
        )),
        status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
        user_id TEXT NOT NULL,
        conversation_id TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        payload_json TEXT NOT NULL,
        result_json TEXT,
        error_message TEXT,
        scheduled_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      INSERT OR IGNORE INTO background_ai_jobs_next (
        id, type, status, user_id, conversation_id, attempts, payload_json,
        result_json, error_message, scheduled_at, started_at, completed_at,
        created_at, updated_at
      )
      SELECT
        id, type, status, user_id, conversation_id, attempts, payload_json,
        result_json, error_message, scheduled_at, started_at, completed_at,
        created_at, updated_at
      FROM background_ai_jobs;

      DROP TABLE background_ai_jobs;
      ALTER TABLE background_ai_jobs_next RENAME TO background_ai_jobs;

      CREATE INDEX IF NOT EXISTS idx_background_ai_jobs_status_scheduled
        ON background_ai_jobs(status, scheduled_at);

      CREATE INDEX IF NOT EXISTS idx_background_ai_jobs_user_type
        ON background_ai_jobs(user_id, type, status);

      CREATE TABLE IF NOT EXISTS background_analysis_windows (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        conversation_id TEXT,
        status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed')),
        trigger_reason TEXT NOT NULL,
        observation_count INTEGER NOT NULL,
        observation_ids_json TEXT NOT NULL,
        result_json TEXT,
        source_job_id TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (source_job_id) REFERENCES background_ai_jobs(id)
      );

      CREATE INDEX IF NOT EXISTS idx_background_analysis_windows_user_created
        ON background_analysis_windows(user_id, created_at);

      CREATE TABLE IF NOT EXISTS background_learning_observations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('text', 'voice')),
        observation_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'queued', 'processed')),
        window_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (window_id) REFERENCES background_analysis_windows(id)
      );

      CREATE INDEX IF NOT EXISTS idx_background_learning_observations_pending
        ON background_learning_observations(user_id, conversation_id, status, created_at);
    `, { disableForeignKeys: true });

    this.applyMigration('004_session_progress_tracking', `
      ALTER TABLE tutor_turns
        ADD COLUMN lesson_type TEXT NOT NULL DEFAULT 'tutor'
          CHECK (lesson_type IN (
            'meeting',
            'tutor',
            'concept',
            'practice',
            'diagnostic',
            'exam_strategy',
            'mistake_review',
            'visual_explanation',
            'reflection'
          ));

      ALTER TABLE background_learning_observations
        ADD COLUMN lesson_type TEXT NOT NULL DEFAULT 'tutor'
          CHECK (lesson_type IN (
            'meeting',
            'tutor',
            'concept',
            'practice',
            'diagnostic',
            'exam_strategy',
            'mistake_review',
            'visual_explanation',
            'reflection'
          ));

      CREATE TABLE IF NOT EXISTS student_session_summaries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        conversation_id TEXT,
        lesson_type TEXT NOT NULL DEFAULT 'tutor'
          CHECK (lesson_type IN (
            'meeting',
            'tutor',
            'concept',
            'practice',
            'diagnostic',
            'exam_strategy',
            'mistake_review',
            'visual_explanation',
            'reflection'
          )),
        summary_json TEXT NOT NULL,
        evidence_levels_json TEXT NOT NULL,
        source_window_id TEXT,
        source_job_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (source_window_id) REFERENCES background_analysis_windows(id),
        FOREIGN KEY (source_job_id) REFERENCES background_ai_jobs(id)
      );

      CREATE INDEX IF NOT EXISTS idx_student_session_summaries_user_created
        ON student_session_summaries(user_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_student_session_summaries_conversation
        ON student_session_summaries(user_id, conversation_id, created_at);

      CREATE TABLE IF NOT EXISTS student_skill_progress (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        conversation_id TEXT,
        lesson_type TEXT NOT NULL DEFAULT 'tutor'
          CHECK (lesson_type IN (
            'meeting',
            'tutor',
            'concept',
            'practice',
            'diagnostic',
            'exam_strategy',
            'mistake_review',
            'visual_explanation',
            'reflection'
          )),
        topic TEXT NOT NULL,
        skill TEXT NOT NULL,
        direction TEXT NOT NULL CHECK (direction IN ('progress', 'regression', 'stable', 'unknown')),
        confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high', 'unknown')),
        support_needed TEXT NOT NULL CHECK (support_needed IN ('none', 'hint', 'step_by_step', 'full_explanation', 'unknown')),
        independence TEXT NOT NULL CHECK (independence IN ('low', 'medium', 'high', 'unknown')),
        evidence_json TEXT NOT NULL,
        source_window_id TEXT,
        source_job_id TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (source_window_id) REFERENCES background_analysis_windows(id),
        FOREIGN KEY (source_job_id) REFERENCES background_ai_jobs(id)
      );

      CREATE INDEX IF NOT EXISTS idx_student_skill_progress_user_created
        ON student_skill_progress(user_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_student_skill_progress_topic_created
        ON student_skill_progress(user_id, topic, skill, created_at);
    `);

    this.applyMigration('005_lesson_lifecycle_usage', `
      CREATE TABLE IF NOT EXISTS lesson_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        lesson_type TEXT NOT NULL DEFAULT 'tutor'
          CHECK (lesson_type IN (
            'meeting',
            'tutor',
            'concept',
            'practice',
            'diagnostic',
            'exam_strategy',
            'mistake_review',
            'visual_explanation',
            'reflection'
          )),
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN (
            'active',
            'soft_limit_reached',
            'hard_limit_reached',
            'goal_reached',
            'finished'
          )),
        goal_status TEXT NOT NULL DEFAULT 'in_progress'
          CHECK (goal_status IN (
            'in_progress',
            'reached',
            'blocked',
            'stopped_by_limit'
          )),
        goal_text TEXT NOT NULL,
        success_criteria_json TEXT NOT NULL,
        finish_reason TEXT,
        active_learning_seconds INTEGER NOT NULL DEFAULT 0,
        turn_count INTEGER NOT NULL DEFAULT 0,
        started_at TEXT NOT NULL,
        last_activity_at TEXT NOT NULL,
        finished_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_lesson_sessions_user_conversation
        ON lesson_sessions(user_id, conversation_id, updated_at);

      CREATE INDEX IF NOT EXISTS idx_lesson_sessions_user_status
        ON lesson_sessions(user_id, status, updated_at);

      CREATE TABLE IF NOT EXISTS lesson_effectiveness_signals (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        lesson_session_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        lesson_type TEXT NOT NULL DEFAULT 'tutor'
          CHECK (lesson_type IN (
            'meeting',
            'tutor',
            'concept',
            'practice',
            'diagnostic',
            'exam_strategy',
            'mistake_review',
            'visual_explanation',
            'reflection'
          )),
        goal_status TEXT NOT NULL
          CHECK (goal_status IN (
            'in_progress',
            'reached',
            'blocked',
            'stopped_by_limit'
          )),
        strategy_signal_json TEXT NOT NULL,
        answer_shape_json TEXT NOT NULL,
        recommended_adjustment TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (lesson_session_id) REFERENCES lesson_sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_lesson_effectiveness_user_created
        ON lesson_effectiveness_signals(user_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_lesson_effectiveness_lesson_created
        ON lesson_effectiveness_signals(lesson_session_id, created_at);

      CREATE TABLE IF NOT EXISTS ai_usage_ledger (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        conversation_id TEXT,
        lesson_session_id TEXT,
        lesson_type TEXT
          CHECK (
            lesson_type IS NULL OR lesson_type IN (
              'meeting',
              'tutor',
              'concept',
              'practice',
              'diagnostic',
              'exam_strategy',
              'mistake_review',
              'visual_explanation',
              'reflection'
            )
          ),
        operation_key TEXT NOT NULL,
        operation TEXT NOT NULL,
        assistant_role TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        response_format TEXT NOT NULL CHECK (response_format IN ('json', 'text', 'image')),
        service_tier TEXT,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        cached_input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        image_count INTEGER NOT NULL DEFAULT 0,
        estimated_cost_usd REAL NOT NULL DEFAULT 0,
        pricing_source TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (lesson_session_id) REFERENCES lesson_sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_ai_usage_ledger_user_created
        ON ai_usage_ledger(user_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_ai_usage_ledger_lesson_created
        ON ai_usage_ledger(lesson_session_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_ai_usage_ledger_user_operation
        ON ai_usage_ledger(user_id, operation_key, created_at);
    `);

    this.applyMigration('006_lesson_decision_agent', `
      CREATE TABLE IF NOT EXISTS lesson_decisions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        lesson_session_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        lesson_type TEXT NOT NULL DEFAULT 'tutor'
          CHECK (lesson_type IN (
            'meeting',
            'tutor',
            'concept',
            'practice',
            'diagnostic',
            'exam_strategy',
            'mistake_review',
            'visual_explanation',
            'reflection'
          )),
        operation_key TEXT NOT NULL,
        operation TEXT NOT NULL,
        assistant_role TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        decision_json TEXT NOT NULL,
        policy_result_json TEXT NOT NULL,
        accepted INTEGER NOT NULL CHECK (accepted IN (0, 1)),
        rejection_reason TEXT,
        evidence_level TEXT NOT NULL
          CHECK (evidence_level IN (
            'none',
            'self_reported',
            'agent_interpreted',
            'attempt_submitted',
            'deterministically_verified',
            'repeated_independent_success'
          )),
        verifier_result TEXT,
        latency_ms INTEGER NOT NULL DEFAULT 0,
        retry_count INTEGER NOT NULL DEFAULT 0,
        lesson_outcome TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (lesson_session_id) REFERENCES lesson_sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_lesson_decisions_user_created
        ON lesson_decisions(user_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_lesson_decisions_lesson_created
        ON lesson_decisions(lesson_session_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_lesson_decisions_tool_created
        ON lesson_decisions(tool_name, accepted, created_at);
    `);

    this.applyMigration('007_verified_learning_loop', `
      ALTER TABLE tutor_turns
        ADD COLUMN request_id TEXT;

      ALTER TABLE ai_usage_ledger
        ADD COLUMN correlation_id TEXT;

      ALTER TABLE lesson_decisions
        ADD COLUMN usage_correlation_id TEXT;

      ALTER TABLE lesson_decisions
        ADD COLUMN fallback_used INTEGER NOT NULL DEFAULT 0
          CHECK (fallback_used IN (0, 1));

      ALTER TABLE lesson_decisions
        ADD COLUMN profile_delta_routed INTEGER NOT NULL DEFAULT 0
          CHECK (profile_delta_routed IN (0, 1));

      CREATE UNIQUE INDEX IF NOT EXISTS idx_tutor_turns_user_request
        ON tutor_turns(user_id, request_id)
        WHERE request_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_ai_usage_ledger_correlation
        ON ai_usage_ledger(correlation_id);

      CREATE TABLE IF NOT EXISTS curriculum_skills (
        skill_id TEXT PRIMARY KEY,
        topic_id TEXT NOT NULL,
        topic_title TEXT NOT NULL,
        skill_title TEXT NOT NULL,
        task_type_id TEXT NOT NULL,
        task_type_title TEXT NOT NULL,
        verifier_kind TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      INSERT OR IGNORE INTO curriculum_skills (
        skill_id, topic_id, topic_title, skill_title,
        task_type_id, task_type_title, verifier_kind, created_at
      )
      VALUES
        (
          'algebra.linear.solve_one_variable',
          'algebra.linear_equations',
          'Линейные уравнения',
          'Решение линейного уравнения с одной переменной',
          'ege.base.linear_equation_numeric',
          'ЕГЭ: линейное уравнение с числовым ответом',
          'linear_equation_numeric',
          datetime('now')
        ),
        (
          'algebra.quadratic.discriminant',
          'algebra.quadratic_equations',
          'Квадратные уравнения',
          'Дискриминант и корни квадратного уравнения',
          'ege.base.quadratic_roots',
          'ЕГЭ: корни квадратного уравнения',
          'unsupported',
          datetime('now')
        ),
        (
          'calculus.derivative.basic_rules',
          'calculus.derivatives',
          'Производная',
          'Базовые правила вычисления производной',
          'ege.base.derivative_value',
          'ЕГЭ: вычисление производной',
          'unsupported',
          datetime('now')
        );

      CREATE TABLE IF NOT EXISTS lesson_tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        lesson_session_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        lesson_type TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        task_type_id TEXT NOT NULL,
        prompt TEXT NOT NULL,
        expected_answer TEXT NOT NULL,
        verifier_kind TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('backend_generated', 'model_imported')),
        status TEXT NOT NULL CHECK (status IN (
          'pending',
          'attempted',
          'verified_correct',
          'blocked'
        )),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (lesson_session_id) REFERENCES lesson_sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_lesson_tasks_lesson_status
        ON lesson_tasks(user_id, lesson_session_id, status, created_at);

      CREATE TABLE IF NOT EXISTS student_attempts (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        lesson_session_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        answer_text TEXT NOT NULL,
        verifier_result TEXT NOT NULL CHECK (verifier_result IN (
          'correct',
          'incorrect',
          'equivalent',
          'partially_correct',
          'invalid_format',
          'cannot_verify'
        )),
        expected_answer TEXT,
        error_code TEXT,
        confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high', 'unknown')),
        mastery_update_allowed INTEGER NOT NULL CHECK (mastery_update_allowed IN (0, 1)),
        created_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES lesson_tasks(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (lesson_session_id) REFERENCES lesson_sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_student_attempts_lesson_created
        ON student_attempts(lesson_session_id, created_at);

      CREATE TABLE IF NOT EXISTS mastery_evidence (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        lesson_session_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        task_type_id TEXT NOT NULL,
        evidence_level TEXT NOT NULL CHECK (evidence_level IN (
          'deterministically_verified',
          'repeated_independent_success'
        )),
        verifier_result TEXT NOT NULL,
        outcome TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (lesson_session_id) REFERENCES lesson_sessions(id),
        FOREIGN KEY (task_id) REFERENCES lesson_tasks(id),
        FOREIGN KEY (attempt_id) REFERENCES student_attempts(id)
      );

      CREATE INDEX IF NOT EXISTS idx_mastery_evidence_user_skill
        ON mastery_evidence(user_id, skill_id, created_at);
    `);

    this.applyMigration('008_knowledge_pack_ingestion', `
      ALTER TABLE knowledge_files
        ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'manual_upload';

      ALTER TABLE knowledge_files
        ADD COLUMN source_path TEXT;

      ALTER TABLE knowledge_files
        ADD COLUMN source_pack_version TEXT;

      ALTER TABLE knowledge_files
        ADD COLUMN content_hash TEXT;

      ALTER TABLE knowledge_files
        ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'active'
          CHECK (sync_status IN ('active', 'superseded', 'failed', 'cleanup_failed'));

      ALTER TABLE knowledge_files
        ADD COLUMN superseded_at TEXT;

      ALTER TABLE knowledge_files
        ADD COLUMN error_message TEXT;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_files_source_hash
        ON knowledge_files(source_kind, source_path, content_hash, vector_store_id)
        WHERE source_path IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_knowledge_files_source_active
        ON knowledge_files(source_kind, source_path, sync_status, updated_at);

      ALTER TABLE curriculum_skills
        ADD COLUMN description TEXT;

      ALTER TABLE curriculum_skills
        ADD COLUMN prerequisites_json TEXT;

      ALTER TABLE curriculum_skills
        ADD COLUMN task_type_ids_json TEXT;

      ALTER TABLE curriculum_skills
        ADD COLUMN typical_misconceptions_json TEXT;

      ALTER TABLE curriculum_skills
        ADD COLUMN explanation_methods_json TEXT;

      ALTER TABLE curriculum_skills
        ADD COLUMN minimum_mastery_criterion TEXT;

      ALTER TABLE curriculum_skills
        ADD COLUMN verification_methods_json TEXT;

      ALTER TABLE curriculum_skills
        ADD COLUMN recommended_lesson_type TEXT;

      ALTER TABLE curriculum_skills
        ADD COLUMN deterministic_verification TEXT;

      ALTER TABLE curriculum_skills
        ADD COLUMN difficulty TEXT;

      ALTER TABLE curriculum_skills
        ADD COLUMN estimated_learning_minutes INTEGER;

      ALTER TABLE curriculum_skills
        ADD COLUMN source_pack_version TEXT;

      ALTER TABLE curriculum_skills
        ADD COLUMN source_path TEXT;

      ALTER TABLE curriculum_skills
        ADD COLUMN content_hash TEXT;

      ALTER TABLE curriculum_skills
        ADD COLUMN updated_at TEXT;

      CREATE TABLE IF NOT EXISTS project_ai_resources (
        resource_key TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS knowledge_source_files (
        id TEXT PRIMARY KEY,
        source_pack_version TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        target_kind TEXT NOT NULL CHECK (target_kind IN ('db_structured', 'student_rag', 'metadata')),
        content_hash TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'imported', 'synced', 'skipped', 'failed')),
        knowledge_file_id TEXT,
        metadata_json TEXT NOT NULL,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (source_pack_version, relative_path, target_kind),
        FOREIGN KEY (knowledge_file_id) REFERENCES knowledge_files(id)
      );

      CREATE INDEX IF NOT EXISTS idx_knowledge_source_files_target
        ON knowledge_source_files(target_kind, status, updated_at);

      CREATE TABLE IF NOT EXISTS knowledge_pack_imports (
        id TEXT PRIMARY KEY,
        pack_version TEXT NOT NULL,
        root_path TEXT NOT NULL,
        import_kind TEXT NOT NULL CHECK (import_kind IN ('structured', 'rag', 'structured_and_rag')),
        status TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
        structured_file_count INTEGER NOT NULL DEFAULT 0,
        rag_file_count INTEGER NOT NULL DEFAULT 0,
        imported_row_count INTEGER NOT NULL DEFAULT 0,
        uploaded_file_count INTEGER NOT NULL DEFAULT 0,
        skipped_file_count INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_knowledge_pack_imports_completed
        ON knowledge_pack_imports(completed_at);

      CREATE TABLE IF NOT EXISTS curriculum_topics (
        topic_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        exam_track TEXT NOT NULL,
        prerequisite_topic_ids_json TEXT NOT NULL,
        skill_ids_json TEXT NOT NULL,
        theory_document_id TEXT,
        status TEXT NOT NULL,
        source_pack_version TEXT NOT NULL,
        source_path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS curriculum_task_types (
        task_type_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        exam_track TEXT NOT NULL,
        response_kind TEXT NOT NULL,
        runtime_verifier_kind TEXT NOT NULL,
        planned_verifier_kind TEXT NOT NULL,
        year_binding TEXT,
        source_pack_version TEXT NOT NULL,
        source_path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS curriculum_prerequisite_edges (
        id TEXT PRIMARY KEY,
        edge_type TEXT NOT NULL CHECK (edge_type IN ('topic', 'skill')),
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        relation TEXT NOT NULL,
        source_pack_version TEXT NOT NULL,
        source_path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (edge_type, from_id, to_id, relation)
      );

      CREATE INDEX IF NOT EXISTS idx_curriculum_prerequisite_edges_to
        ON curriculum_prerequisite_edges(edge_type, to_id);

      CREATE TABLE IF NOT EXISTS curriculum_mastery_criteria (
        skill_id TEXT PRIMARY KEY,
        minimum_criterion TEXT NOT NULL,
        required_evidence_sequence_json TEXT NOT NULL,
        self_report_can_complete INTEGER NOT NULL CHECK (self_report_can_complete IN (0, 1)),
        single_success_can_complete INTEGER NOT NULL CHECK (single_success_can_complete IN (0, 1)),
        recommended_recheck_days_json TEXT NOT NULL,
        regression_trigger TEXT NOT NULL,
        source_pack_version TEXT NOT NULL,
        source_path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS curriculum_misconceptions (
        misconception_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        domain TEXT NOT NULL,
        observable_sign TEXT NOT NULL,
        possible_causes_json TEXT NOT NULL,
        random_vs_systematic TEXT NOT NULL,
        first_question TEXT NOT NULL,
        first_hint TEXT NOT NULL,
        second_hint TEXT NOT NULL,
        prerequisite_to_check TEXT,
        retry_task_rule TEXT NOT NULL,
        forbidden_inference TEXT NOT NULL,
        source_pack_version TEXT NOT NULL,
        source_path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS error_classification_entries (
        id TEXT PRIMARY KEY,
        entry_type TEXT NOT NULL CHECK (entry_type IN ('error_kind', 'classification_level', 'misconception_id', 'global_constraint')),
        entry_key TEXT NOT NULL,
        entry_json TEXT NOT NULL,
        source_pack_version TEXT NOT NULL,
        source_path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (entry_type, entry_key)
      );

      CREATE TABLE IF NOT EXISTS lesson_type_plans (
        phase TEXT PRIMARY KEY,
        goal TEXT NOT NULL,
        recommended_lesson_mix_json TEXT NOT NULL,
        transition_criteria_json TEXT NOT NULL,
        minimum_evidence TEXT NOT NULL,
        reflection_frequency TEXT NOT NULL,
        review_frequency TEXT NOT NULL,
        mock_exam_place TEXT NOT NULL,
        prerequisite_return_rule TEXT NOT NULL,
        source_pack_version TEXT NOT NULL,
        source_path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS task_bank_tasks (
        task_id TEXT PRIMARY KEY,
        topic_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        task_type_id TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        prompt TEXT NOT NULL,
        expected_answer TEXT NOT NULL,
        solution_steps_json TEXT NOT NULL,
        common_errors_json TEXT NOT NULL,
        hint_ladder_json TEXT NOT NULL,
        verifier_kind TEXT NOT NULL,
        source_type TEXT NOT NULL,
        verification_json TEXT NOT NULL,
        task_bank_file TEXT NOT NULL,
        source_pack_version TEXT NOT NULL,
        source_path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_task_bank_tasks_skill
        ON task_bank_tasks(skill_id, task_type_id, difficulty);

      CREATE INDEX IF NOT EXISTS idx_task_bank_tasks_topic
        ON task_bank_tasks(topic_id, task_type_id);
    `);

    this.applyMigration('009_knowledge_pack_runtime_repair', `
      ALTER TABLE knowledge_pack_imports
        ADD COLUMN schema_version TEXT;

      ALTER TABLE knowledge_pack_imports
        ADD COLUMN content_release TEXT;

      ALTER TABLE knowledge_pack_imports
        ADD COLUMN generated_at TEXT;

      ALTER TABLE knowledge_pack_imports
        ADD COLUMN pack_content_hash TEXT;

      ALTER TABLE knowledge_pack_imports
        ADD COLUMN import_mode TEXT NOT NULL DEFAULT 'strict'
          CHECK (import_mode IN ('strict', 'partial'));

      ALTER TABLE knowledge_pack_imports
        ADD COLUMN warnings_json TEXT NOT NULL DEFAULT '[]';

      ALTER TABLE curriculum_topics
        ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'active'
          CHECK (sync_status IN ('active', 'retired'));

      ALTER TABLE curriculum_topics
        ADD COLUMN retired_at TEXT;

      ALTER TABLE curriculum_task_types
        ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'active'
          CHECK (sync_status IN ('active', 'retired'));

      ALTER TABLE curriculum_task_types
        ADD COLUMN retired_at TEXT;

      ALTER TABLE curriculum_skills
        ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'active'
          CHECK (sync_status IN ('active', 'retired'));

      ALTER TABLE curriculum_skills
        ADD COLUMN retired_at TEXT;

      ALTER TABLE curriculum_prerequisite_edges
        ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'active'
          CHECK (sync_status IN ('active', 'retired'));

      ALTER TABLE curriculum_prerequisite_edges
        ADD COLUMN retired_at TEXT;

      ALTER TABLE curriculum_mastery_criteria
        ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'active'
          CHECK (sync_status IN ('active', 'retired'));

      ALTER TABLE curriculum_mastery_criteria
        ADD COLUMN retired_at TEXT;

      ALTER TABLE curriculum_misconceptions
        ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'active'
          CHECK (sync_status IN ('active', 'retired'));

      ALTER TABLE curriculum_misconceptions
        ADD COLUMN retired_at TEXT;

      ALTER TABLE error_classification_entries
        ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'active'
          CHECK (sync_status IN ('active', 'retired'));

      ALTER TABLE error_classification_entries
        ADD COLUMN retired_at TEXT;

      ALTER TABLE lesson_type_plans
        ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'active'
          CHECK (sync_status IN ('active', 'retired'));

      ALTER TABLE lesson_type_plans
        ADD COLUMN retired_at TEXT;

      ALTER TABLE task_bank_tasks
        ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'active'
          CHECK (sync_status IN ('active', 'retired'));

      ALTER TABLE task_bank_tasks
        ADD COLUMN retired_at TEXT;

      CREATE INDEX IF NOT EXISTS idx_curriculum_skills_runtime
        ON curriculum_skills(sync_status, skill_id, task_type_id);

      CREATE INDEX IF NOT EXISTS idx_task_bank_tasks_runtime
        ON task_bank_tasks(sync_status, skill_id, task_type_id, verifier_kind, difficulty);

      CREATE TABLE IF NOT EXISTS knowledge_pack_sync_jobs (
        id TEXT PRIMARY KEY,
        job_key TEXT NOT NULL UNIQUE,
        source_pack_version TEXT NOT NULL,
        vector_store_id TEXT NOT NULL,
        source_path TEXT,
        content_hash TEXT,
        job_kind TEXT NOT NULL CHECK (job_kind IN ('student_rag_file', 'student_rag_reconcile')),
        status TEXT NOT NULL CHECK (status IN (
          'planned',
          'running',
          'uploaded',
          'attached',
          'indexed',
          'cleanup_pending',
          'completed',
          'failed'
        )),
        attempts INTEGER NOT NULL DEFAULT 0,
        metadata_json TEXT NOT NULL,
        error_message TEXT,
        claimed_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_knowledge_pack_sync_jobs_status
        ON knowledge_pack_sync_jobs(status, updated_at);

      CREATE INDEX IF NOT EXISTS idx_knowledge_pack_sync_jobs_source
        ON knowledge_pack_sync_jobs(source_pack_version, source_path, status);
    `);

    this.applyMigration('010_mastery_policy_and_task_source', `
      PRAGMA legacy_alter_table = ON;

      ALTER TABLE lesson_tasks RENAME TO lesson_tasks_old;

      CREATE TABLE lesson_tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        lesson_session_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        lesson_type TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        task_type_id TEXT NOT NULL,
        prompt TEXT NOT NULL,
        expected_answer TEXT NOT NULL,
        verifier_kind TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN (
          'backend_generated',
          'model_imported',
          'task_bank_imported'
        )),
        status TEXT NOT NULL CHECK (status IN (
          'pending',
          'attempted',
          'verified_correct',
          'blocked'
        )),
        hint_ladder_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (lesson_session_id) REFERENCES lesson_sessions(id)
      );

      INSERT INTO lesson_tasks (
        id, user_id, lesson_session_id, conversation_id, lesson_type,
        topic_id, skill_id, task_type_id, prompt, expected_answer,
        verifier_kind, source, status, hint_ladder_json, created_at, updated_at
      )
      SELECT
        id, user_id, lesson_session_id, conversation_id, lesson_type,
        topic_id, skill_id, task_type_id, prompt, expected_answer,
        verifier_kind,
        CASE source
          WHEN 'model_imported' THEN 'task_bank_imported'
          ELSE source
        END,
        status,
        NULL,
        created_at,
        updated_at
      FROM lesson_tasks_old;

      DROP TABLE lesson_tasks_old;

      CREATE INDEX IF NOT EXISTS idx_lesson_tasks_lesson_status
        ON lesson_tasks(user_id, lesson_session_id, status, created_at);

      ALTER TABLE student_attempts
        ADD COLUMN mastery_policy_json TEXT;

      PRAGMA legacy_alter_table = OFF;
    `, { disableForeignKeys: true });

    this.applyMigration('011_task_identity_and_indexing_state', `
      PRAGMA legacy_alter_table = ON;

      ALTER TABLE lesson_tasks RENAME TO lesson_tasks_old;

      CREATE TABLE lesson_tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        lesson_session_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        lesson_type TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        task_type_id TEXT NOT NULL,
        source_task_id TEXT NOT NULL,
        prompt TEXT NOT NULL,
        expected_answer TEXT NOT NULL,
        verifier_kind TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN (
          'backend_generated',
          'model_imported',
          'task_bank_imported'
        )),
        status TEXT NOT NULL CHECK (status IN (
          'pending',
          'attempted',
          'verified_correct',
          'blocked'
        )),
        hint_ladder_json TEXT,
        common_errors_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (lesson_session_id) REFERENCES lesson_sessions(id)
      );

      INSERT INTO lesson_tasks (
        id, user_id, lesson_session_id, conversation_id, lesson_type,
        topic_id, skill_id, task_type_id, source_task_id, prompt,
        expected_answer, verifier_kind, source, status, hint_ladder_json,
        common_errors_json, created_at, updated_at
      )
      SELECT
        id, user_id, lesson_session_id, conversation_id, lesson_type,
        topic_id, skill_id, task_type_id,
        COALESCE(
          (
            SELECT task_bank_tasks.task_id
            FROM task_bank_tasks
            WHERE task_bank_tasks.skill_id = lesson_tasks_old.skill_id
              AND task_bank_tasks.task_type_id = lesson_tasks_old.task_type_id
              AND task_bank_tasks.prompt = lesson_tasks_old.prompt
            LIMIT 1
          ),
          CASE
            WHEN source = 'backend_generated'
              THEN 'generated:' || verifier_kind || ':' || replace(prompt, ' ', '_')
            ELSE 'legacy:' || id
          END
        ),
        prompt, expected_answer, verifier_kind, source, status,
        hint_ladder_json, NULL, created_at, updated_at
      FROM lesson_tasks_old;

      DROP TABLE lesson_tasks_old;

      CREATE INDEX IF NOT EXISTS idx_lesson_tasks_lesson_status
        ON lesson_tasks(user_id, lesson_session_id, status, created_at);

      CREATE INDEX IF NOT EXISTS idx_lesson_tasks_source_task
        ON lesson_tasks(user_id, skill_id, source_task_id, created_at);

      ALTER TABLE knowledge_files RENAME TO knowledge_files_old;

      CREATE TABLE knowledge_files (
        id TEXT PRIMARY KEY,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        openai_file_id TEXT NOT NULL,
        vector_store_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        source_kind TEXT NOT NULL DEFAULT 'manual_upload',
        source_path TEXT,
        source_pack_version TEXT,
        content_hash TEXT,
        sync_status TEXT NOT NULL DEFAULT 'active'
          CHECK (sync_status IN ('active', 'indexing', 'superseded', 'failed', 'cleanup_failed')),
        superseded_at TEXT,
        error_message TEXT
      );

      INSERT INTO knowledge_files (
        id, original_name, mime_type, size_bytes, openai_file_id,
        vector_store_id, status, created_at, updated_at, source_kind,
        source_path, source_pack_version, content_hash, sync_status,
        superseded_at, error_message
      )
      SELECT
        id, original_name, mime_type, size_bytes, openai_file_id,
        vector_store_id, status, created_at, updated_at, source_kind,
        source_path, source_pack_version, content_hash, sync_status,
        superseded_at, error_message
      FROM knowledge_files_old;

      DROP TABLE knowledge_files_old;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_files_source_hash
        ON knowledge_files(source_kind, source_path, content_hash, vector_store_id)
        WHERE source_path IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_knowledge_files_source_active
        ON knowledge_files(source_kind, source_path, sync_status, updated_at);

      PRAGMA legacy_alter_table = OFF;
    `, { disableForeignKeys: true });

    this.applyMigration('012_generated_task_identity_normalization', `
      UPDATE lesson_tasks
      SET source_task_id = 'generated:' || verifier_kind || ':' || replace(prompt, ' ', '_')
      WHERE source = 'backend_generated'
        AND source_task_id LIKE 'generated:%';
    `);

    this.applyMigration('013_student_profile_creation_idempotency', `
      CREATE TABLE IF NOT EXISTS student_profile_creation_runs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        transcript_hash TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
        attempts INTEGER NOT NULL DEFAULT 1,
        error_message TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, conversation_id, transcript_hash)
      );

      CREATE INDEX IF NOT EXISTS idx_student_profile_creation_runs_user_updated
        ON student_profile_creation_runs(user_id, updated_at);

      CREATE INDEX IF NOT EXISTS idx_student_profile_creation_runs_status
        ON student_profile_creation_runs(status, updated_at);
    `);

    this.applyMigration('014_profile_creation_conversation_lock', `
      UPDATE student_profile_creation_runs
      SET status = 'failed',
          error_message = COALESCE(error_message, 'Superseded by conversation-level profile creation lock'),
          completed_at = COALESCE(completed_at, updated_at),
          updated_at = updated_at
      WHERE status = 'running'
        AND EXISTS (
          SELECT 1
          FROM student_profile_creation_runs AS newer
          WHERE newer.user_id = student_profile_creation_runs.user_id
            AND newer.conversation_id = student_profile_creation_runs.conversation_id
            AND newer.status = 'running'
            AND (
              newer.updated_at > student_profile_creation_runs.updated_at
              OR (
                newer.updated_at = student_profile_creation_runs.updated_at
                AND newer.id > student_profile_creation_runs.id
              )
            )
        );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_student_profile_creation_runs_one_running_conversation
        ON student_profile_creation_runs(user_id, conversation_id)
        WHERE status = 'running';
    `);

    this.applyMigration('015_profile_creation_user_lock', `
      UPDATE student_profile_creation_runs
      SET status = 'failed',
          error_message = COALESCE(error_message, 'Superseded by user-level profile creation lock'),
          completed_at = COALESCE(completed_at, updated_at),
          updated_at = updated_at
      WHERE status = 'running'
        AND EXISTS (
          SELECT 1
          FROM student_profile_creation_runs AS newer
          WHERE newer.user_id = student_profile_creation_runs.user_id
            AND newer.status = 'running'
            AND (
              newer.updated_at > student_profile_creation_runs.updated_at
              OR (
                newer.updated_at = student_profile_creation_runs.updated_at
                AND newer.id > student_profile_creation_runs.id
              )
            )
        );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_student_profile_creation_runs_one_running_user
        ON student_profile_creation_runs(user_id)
        WHERE status = 'running';
    `);

    this.applyMigration('016_realtime_usage_ledger_metadata', `
      ALTER TABLE ai_usage_ledger
        ADD COLUMN duration_seconds INTEGER;

      ALTER TABLE ai_usage_ledger
        ADD COLUMN metadata_json TEXT;
    `);
  }

  private applyMigration(
    version: string,
    sql: string,
    options: MigrationOptions = {},
  ): void {
    const existing = this.get<{ version: string }>(
      'SELECT version FROM schema_migrations WHERE version = ?',
      [version],
    );
    if (existing) {
      return;
    }

    let transactionStarted = false;
    try {
      if (options.disableForeignKeys) {
        this.db.exec('PRAGMA foreign_keys = OFF;');
      }
      this.db.exec('BEGIN IMMEDIATE;');
      transactionStarted = true;
      this.db.exec(sql);
      if (options.disableForeignKeys) {
        this.assertForeignKeyIntegrity(version);
      }
      this.run('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [
        version,
        new Date().toISOString(),
      ]);
      this.db.exec('COMMIT;');
      transactionStarted = false;
    } catch (error) {
      if (transactionStarted) {
        this.rollbackTransaction();
      }
      throw error;
    } finally {
      if (options.disableForeignKeys) {
        this.db.exec('PRAGMA foreign_keys = ON;');
      }
    }
  }

  private assertForeignKeyIntegrity(version: string): void {
    const violations = this.all<{
      table: string;
      rowid: number | null;
      parent: string;
      fkid: number;
    }>('PRAGMA foreign_key_check');
    if (violations.length === 0) {
      return;
    }
    const first = violations[0];
    throw new Error(
      `Migration ${version} left ${violations.length} foreign key violation(s); ` +
        `first=${first.table}:${first.rowid ?? 'unknown'}->${first.parent}`,
    );
  }

  private rollbackTransaction(): void {
    try {
      this.db.exec('ROLLBACK;');
    } catch (rollbackError) {
      const message = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      this.logger.error(`SQLite rollback failed: ${message}`);
    }
  }
}
