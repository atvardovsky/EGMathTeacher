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
        correlationId: 'turn-1',
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
        correlationId: 'turn-1',
      }),
    );
  });

  it('returns decision observability and cost per verified outcome', () => {
    service.recordOperation(
      policy,
      {
        userId: 'student-1',
        conversationId: 'conv-1',
        lessonSessionId: 'lesson-1',
        lessonType: 'tutor',
        correlationId: 'turn-verified',
      },
      { model: 'gpt-test' },
      {
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
        },
      },
    );
    db.run(
      `INSERT INTO lesson_decisions (
         id, user_id, lesson_session_id, conversation_id, lesson_type,
         operation_key, operation, assistant_role, provider, model, tool_name,
         decision_json, policy_result_json, accepted, rejection_reason,
         evidence_level, verifier_result, latency_ms, retry_count,
         lesson_outcome, created_at, usage_correlation_id, fallback_used,
         profile_delta_routed
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?, 12, 0, ?, ?, ?, 0, 0)`,
      [
        'decision-1',
        'student-1',
        'lesson-1',
        'conv-1',
        'tutor',
        'lessonDecision',
        'lesson.decide_next_action',
        'lesson_decision_agent',
        'openai',
        'gpt-test',
        'propose_goal_completion',
        '{}',
        '{}',
        'deterministically_verified',
        'correct',
        'goal_completion_accepted',
        new Date().toISOString(),
        'turn-verified',
      ],
    );
    db.run(
      `INSERT INTO lesson_tasks (
         id, user_id, lesson_session_id, conversation_id, lesson_type,
         topic_id, skill_id, task_type_id, prompt, expected_answer,
         verifier_kind, source, status, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified_correct', ?, ?)`,
      [
        'task-1',
        'student-1',
        'lesson-1',
        'conv-1',
        'tutor',
        'algebra.linear_equations',
        'algebra.linear.solve_one_variable',
        'ege.base.linear_equation_numeric',
        '2x + 3 = 15',
        '6',
        'linear_equation_numeric',
        'backend_generated',
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );
    db.run(
      `INSERT INTO student_attempts (
         id, task_id, user_id, lesson_session_id, conversation_id,
         answer_text, verifier_result, expected_answer, error_code,
         confidence, mastery_update_allowed, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, 'correct', ?, NULL, 'high', 1, ?)`,
      [
        'attempt-1',
        'task-1',
        'student-1',
        'lesson-1',
        'conv-1',
        'x = 6',
        '6',
        new Date().toISOString(),
      ],
    );
    db.run(
      `INSERT INTO mastery_evidence (
         id, user_id, lesson_session_id, task_id, attempt_id,
         topic_id, skill_id, task_type_id, evidence_level,
         verifier_result, outcome, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'mastery-1',
        'student-1',
        'lesson-1',
        'task-1',
        'attempt-1',
        'algebra.linear_equations',
        'algebra.linear.solve_one_variable',
        'ege.base.linear_equation_numeric',
        'deterministically_verified',
        'correct',
        'verified_learning_outcome',
        new Date().toISOString(),
      ],
    );

    const summary = service.getUserSummary('student-1', 'lesson-1');

    expect(summary.currentLesson?.decisions[0]).toEqual(
      expect.objectContaining({
        toolName: 'propose_goal_completion',
        accepted: true,
        correlationId: 'turn-verified',
      }),
    );
    expect(summary.currentLesson?.verifiedOutcomes).toBe(1);
    expect(summary.currentLesson?.costPerVerifiedOutcomeUsd).toBe(0.007);
  });
});
