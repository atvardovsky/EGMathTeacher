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
