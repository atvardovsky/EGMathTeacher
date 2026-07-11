import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { DatabaseSync } from 'node:sqlite';

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
  }

  private applyMigration(version: string, sql: string): void {
    const existing = this.get<{ version: string }>(
      'SELECT version FROM schema_migrations WHERE version = ?',
      [version],
    );
    if (existing) {
      return;
    }

    this.db.exec(sql);
    this.run('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [
      version,
      new Date().toISOString(),
    ]);
  }
}
