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
