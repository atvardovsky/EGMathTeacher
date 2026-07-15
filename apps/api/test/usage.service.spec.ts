import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { tmpdir } from 'os';
import { ResolvedAiOperationPolicy } from '../src/ai-model/ai-model.types';
import { DatabaseService } from '../src/database/database.service';
import { UsageService } from '../src/usage/usage.service';

function createConfig(
  sqlitePath: string,
  overrides: Record<string, unknown> = {},
): ConfigService {
  const values: Record<string, unknown> = {
    'app.sqlitePath': sqlitePath,
    'ai.usage.trackingEnabled': true,
    'ai.usage.defaultInputUsdPer1M': 2,
    'ai.usage.defaultCachedInputUsdPer1M': 0.5,
    'ai.usage.defaultOutputUsdPer1M': 10,
    'ai.usage.defaultImageUsd': 0.04,
    ...overrides,
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

  it('records failed provider attempts as usage-unavailable debug ledger rows', () => {
    service.recordOperationFailure(
      policy,
      {
        userId: 'student-1',
        conversationId: 'conv-1',
        lessonSessionId: 'lesson-1',
        lessonType: 'tutor',
        correlationId: 'turn-aborted',
      },
      { model: 'gpt-test' },
      'caller_abort',
    );

    const summary = service.getUserSummary('student-1', 'lesson-1');

    expect(summary.today.estimatedCostUsd).toBe(0);
    expect(summary.today.totalTokens).toBe(0);
    expect(summary.today.pricingConfigured).toBe(false);
    expect(summary.currentLesson?.items[0]).toEqual(
      expect.objectContaining({
        operation: 'tutor.answer',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        pricingSource: 'usage_unavailable:caller_abort',
        correlationId: 'turn-aborted',
      }),
    );
  });

  it('records realtime session usage and exposes it in lesson and day details', () => {
    const startedAtMs = Date.now() - 65_000;

    service.recordRealtimeSession({
      userId: 'student-1',
      conversationId: 'conv-1',
      lessonSessionId: 'lesson-1',
      lessonType: 'tutor',
      sessionId: 'rtc-session-1',
      model: 'gpt-realtime-test',
      startedAtMs,
      closedAtMs: startedAtMs + 65_000,
      inputTokens: 100,
      outputTokens: 50,
      turnCount: 4,
    });

    const summary = service.getUserSummary('student-1', 'lesson-1');

    expect(summary.today.estimatedCostUsd).toBe(0.0007);
    expect(summary.todayItems[0]).toEqual(
      expect.objectContaining({
        operationKey: 'webrtcRealtimeSession',
        operation: 'webrtc.realtime_session',
        provider: 'openai-realtime',
        model: 'gpt-realtime-test',
        durationSeconds: 65,
        totalTokens: 150,
        correlationId: 'rtc-session-1',
      }),
    );
    expect(summary.currentLesson?.items[0]).toEqual(
      expect.objectContaining({
        operation: 'webrtc.realtime_session',
        durationSeconds: 65,
        metadata: expect.objectContaining({
          webrtcSessionId: 'rtc-session-1',
          turnCount: 4,
        }),
      }),
    );
  });

  it('records realtime session duration when provider token usage is unavailable', () => {
    const startedAtMs = Date.now() - 4_000;

    service.recordRealtimeSession({
      userId: 'student-1',
      conversationId: 'conv-voice-only',
      sessionId: 'rtc-session-no-usage',
      model: 'gpt-realtime-test',
      startedAtMs,
      closedAtMs: startedAtMs + 4_000,
    });

    const summary = service.getUserSummary('student-1');

    expect(summary.todayItems[0]).toEqual(
      expect.objectContaining({
        operation: 'webrtc.realtime_session',
        durationSeconds: 4,
        totalTokens: 0,
        pricingSource: 'usage_unavailable:realtime_tokens',
      }),
    );
  });

  it('uses service-tier model pricing overrides when they are configured', () => {
    db.onModuleDestroy();
    const sqlitePath = join(tmpdir(), `egmathteacher-usage-${randomUUID()}.sqlite`);
    const config = createConfig(sqlitePath, {
      'ai.usage.modelPricingJson': JSON.stringify({
        'gpt-test:flex': {
          inputUsdPer1M: 1,
          cachedInputUsdPer1M: 0.1,
          outputUsdPer1M: 2,
          source: 'tier_test',
        },
      }),
    });
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

    service.recordOperation(
      {
        ...policy,
        serviceTier: 'flex',
      },
      {
        userId: 'student-1',
        conversationId: 'conv-1',
        lessonSessionId: 'lesson-1',
        lessonType: 'tutor',
        correlationId: 'turn-flex',
      },
      { model: 'gpt-test' },
      {
        usage: {
          input_tokens: 1000,
          input_tokens_details: { cached_tokens: 100 },
          output_tokens: 500,
          total_tokens: 1500,
        },
      },
    );

    const summary = service.getUserSummary('student-1', 'lesson-1');

    expect(summary.today.estimatedCostUsd).toBe(0.00191);
    expect(summary.currentLesson?.items[0]).toEqual(
      expect.objectContaining({
        pricingSource: 'tier_test',
        serviceTier: 'flex',
      }),
    );
  });

  it('stores image token usage when the provider returns it', () => {
    service.recordOperation(
      {
        ...policy,
        operationKey: 'tutorImage',
        operation: 'tutor.generate_image',
        role: 'image_explainer',
        model: 'gpt-image-test',
        responseFormat: 'image',
      },
      {
        userId: 'student-1',
        conversationId: 'conv-1',
        lessonSessionId: 'lesson-1',
        lessonType: 'visual_explanation',
        correlationId: 'image-1',
      },
      { model: 'gpt-image-test', n: 1 },
      {
        data: [{ url: 'https://example.test/image.png' }],
        usage: {
          input_tokens: 1000,
          input_tokens_details: { cached_tokens: 100 },
          output_tokens: 500,
          total_tokens: 1500,
        },
      },
    );

    const summary = service.getUserSummary('student-1', 'lesson-1');

    expect(summary.today.estimatedCostUsd).toBe(0.04685);
    expect(summary.today.imageCount).toBe(1);
    expect(summary.currentLesson?.items[0]).toEqual(
      expect.objectContaining({
        inputTokens: 1000,
        cachedInputTokens: 100,
        outputTokens: 500,
        imageCount: 1,
      }),
    );
  });

  it('estimates GPT image output tokens when the provider omits usage', () => {
    db.onModuleDestroy();
    const sqlitePath = join(tmpdir(), `egmathteacher-usage-${randomUUID()}.sqlite`);
    const config = createConfig(sqlitePath, {
      'ai.usage.defaultInputUsdPer1M': 0,
      'ai.usage.defaultCachedInputUsdPer1M': 0,
      'ai.usage.defaultOutputUsdPer1M': 0,
      'ai.usage.defaultImageUsd': 0,
      'ai.usage.modelPricingJson': JSON.stringify({
        'gpt-image-2': {
          inputUsdPer1M: 5,
          cachedInputUsdPer1M: 1.25,
          outputUsdPer1M: 30,
          source: 'gpt_image_2_token_estimate',
        },
      }),
    });
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
        'visual_explanation',
        'Разобрать схему',
        JSON.stringify(['схема показана']),
        new Date().toISOString(),
        new Date().toISOString(),
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );

    service.recordOperation(
      {
        ...policy,
        operationKey: 'tutorImage',
        operation: 'tutor.generate_image',
        role: 'image_explainer',
        model: 'gpt-image-2',
        responseFormat: 'image',
      },
      {
        userId: 'student-1',
        conversationId: 'conv-1',
        lessonSessionId: 'lesson-1',
        lessonType: 'visual_explanation',
        correlationId: 'image-estimated',
      },
      { model: 'gpt-image-2', size: '1024x1024', quality: 'low' },
      { data: [{ b64_json: 'abc' }] },
    );

    const summary = service.getUserSummary('student-1', 'lesson-1');

    expect(summary.today.estimatedCostUsd).toBe(0.00588);
    expect(summary.currentLesson?.items[0]).toEqual(
      expect.objectContaining({
        outputTokens: 196,
        totalTokens: 196,
        imageCount: 1,
        pricingSource: 'gpt_image_2_token_estimate',
      }),
    );
  });

  it('returns signed-in user background job responses and failures', () => {
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO background_ai_jobs (
         id, type, status, user_id, conversation_id, attempts, payload_json,
         result_json, error_message, scheduled_at, completed_at, created_at, updated_at
       )
       VALUES (?, ?, 'succeeded', ?, ?, 1, ?, ?, NULL, ?, ?, ?, ?)`,
      [
        'job-success',
        'session_summary',
        'student-1',
        'conv-1',
        JSON.stringify({ lessonSessionId: 'lesson-1' }),
        JSON.stringify({
          sessionSummary: {
            summary: 'Ученик закрепил линейное уравнение и готов к повторной задаче.',
          },
        }),
        now,
        now,
        now,
        now,
      ],
    );
    db.run(
      `INSERT INTO background_ai_jobs (
         id, type, status, user_id, conversation_id, attempts, payload_json,
         result_json, error_message, scheduled_at, completed_at, created_at, updated_at
       )
       VALUES (?, ?, 'failed', ?, ?, 2, ?, NULL, ?, ?, ?, ?, ?)`,
      [
        'job-failed',
        'learning_window_analysis',
        'student-1',
        'conv-1',
        JSON.stringify({ lessonSessionId: 'lesson-1' }),
        'OpenAI request failed with status 400',
        now,
        now,
        now,
        now,
      ],
    );

    const summary = service.getUserSummary('student-1', 'lesson-1');

    expect(summary.backgroundJobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'job-success',
          resultPreview: 'Ученик закрепил линейное уравнение и готов к повторной задаче.',
          lessonSessionId: 'lesson-1',
        }),
        expect.objectContaining({
          id: 'job-failed',
          errorMessage: 'OpenAI request failed with status 400',
          attempts: 2,
        }),
      ]),
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
       topic_id, skill_id, task_type_id, source_task_id, prompt, expected_answer,
       verifier_kind, source, status, hint_ladder_json, common_errors_json, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified_correct', ?, ?, ?, ?)`,
    [
      'task-1',
      'student-1',
        'lesson-1',
        'conv-1',
        'tutor',
      'algebra.linear_equations',
      'algebra.linear.solve_one_variable',
      'ege.base.linear_equation_numeric',
      'generated:linear_equation_numeric:2x_+_3_=_15',
      '2x + 3 = 15',
      '6',
      'linear_equation_numeric',
      'backend_generated',
      JSON.stringify([]),
      JSON.stringify([]),
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
