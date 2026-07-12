import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { tmpdir } from 'os';
import { ResolvedAiOperationPolicy } from '../src/ai-model/ai-model.types';
import { DatabaseService } from '../src/database/database.service';
import { UsageService } from '../src/usage/usage.service';

function createConfig(sqlitePath: string): ConfigService {
  const values: Record<string, unknown> = {
    'app.sqlitePath': sqlitePath,
    'ai.usage.trackingEnabled': true,
    'ai.usage.defaultInputUsdPer1M': 2,
    'ai.usage.defaultCachedInputUsdPer1M': 0.5,
    'ai.usage.defaultOutputUsdPer1M': 10,
    'ai.usage.defaultImageUsd': 0.04,
  };
  return {
    get: <T>(key: string) => values[key] as T,
  } as ConfigService;
}

describe('UsageService', () => {
  let db: DatabaseService;
  let service: UsageService;
  const policy: ResolvedAiOperationPolicy = {
    operationKey: 'tutorAnswer',
    operation: 'tutor.answer',
    role: 'tutor',
    provider: 'openai',
    model: 'gpt-test',
    responseFormat: 'json',
    promptCacheKeyEnabled: false,
  };

  beforeEach(() => {
    const sqlitePath = join(tmpdir(), `egmathteacher-usage-${randomUUID()}.sqlite`);
    const config = createConfig(sqlitePath);
    db = new DatabaseService(config);
    service = new UsageService(db, config);
    db.run(
      'INSERT INTO users (id, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
      ['student-1', 'Маша', 'hash', 'student', new Date().toISOString()],
    );
    db.run(
      `INSERT INTO lesson_sessions (
         id, user_id, conversation_id, lesson_type, status, goal_status,
         goal_text, success_criteria_json, active_learning_seconds, turn_count,
         started_at, last_activity_at, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, 'active', 'in_progress', ?, ?, 120, 1, ?, ?, ?, ?)`,
      [
        'lesson-1',
        'student-1',
        'conv-1',
        'tutor',
        'Разобрать вопрос',
        JSON.stringify(['понят главный шаг']),
        new Date().toISOString(),
        new Date().toISOString(),
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );
  });

  afterEach(() => {
    db.onModuleDestroy();
  });

  it('stores token usage and returns user-visible lesson totals', () => {
    service.recordOperation(
      policy,
      {
        userId: 'student-1',
        conversationId: 'conv-1',
        lessonSessionId: 'lesson-1',
        lessonType: 'tutor',
      },
      { model: 'gpt-test' },
      {
        usage: {
          input_tokens: 1000,
          input_tokens_details: { cached_tokens: 200 },
          output_tokens: 500,
          total_tokens: 1500,
        },
      },
    );

    const summary = service.getUserSummary('student-1', 'lesson-1');

    expect(summary.today.estimatedCostUsd).toBe(0.0067);
    expect(summary.today.totalTokens).toBe(1500);
    expect(summary.currentLesson?.items[0]).toEqual(
      expect.objectContaining({
        operation: 'tutor.answer',
        inputTokens: 1000,
        cachedInputTokens: 200,
        outputTokens: 500,
        model: 'gpt-test',
      }),
    );
  });
});
