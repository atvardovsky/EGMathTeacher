import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { DatabaseService } from '../src/database/database.service';
import { LessonDecisionService } from '../src/lesson/lesson-decision.service';
import { LessonPolicyService } from '../src/lesson/lesson-policy.service';
import { LessonService } from '../src/lesson/lesson.service';

function createConfig(sqlitePath: string): ConfigService {
  const values: Record<string, unknown> = {
    'app.sqlitePath': sqlitePath,
    'app.lessonDailySoftLimitMinutes': 90,
    'app.lessonDailyHardLimitMinutes': 120,
    'app.lessonContinuousSoftLimitMinutes': 45,
    'app.lessonContinuousHardLimitMinutes': 60,
    'app.lessonMinTurnSeconds': 30,
    'app.lessonMaxTurnGapSeconds': 900,
    'ai.lessonDecision.enabled': true,
    'ai.lessonDecision.timeoutMs': 4000,
  };
  return {
    get: <T>(key: string) => values[key] as T,
  } as ConfigService;
}

describe('LessonDecisionService', () => {
  let db: DatabaseService;
  let lessonService: LessonService;
  let service: LessonDecisionService;
  let aiModel: {
    resolveOperationPolicy: jest.Mock;
    createOperationResponse: jest.Mock;
  };

  beforeEach(() => {
    const sqlitePath = join(tmpdir(), `egmathteacher-decision-${randomUUID()}.sqlite`);
    const config = createConfig(sqlitePath);
    db = new DatabaseService(config);
    lessonService = new LessonService(db, config);
    aiModel = {
      resolveOperationPolicy: jest.fn(() => ({
        operationKey: 'lessonDecision',
        operation: 'lesson.decide_next_action',
        role: 'lesson_decision_agent',
        provider: 'openai',
        model: 'gpt-lesson',
        responseFormat: 'json',
        promptCacheKeyEnabled: false,
      })),
      createOperationResponse: jest.fn(async () => ({
        output_text: JSON.stringify({
          actions: [
            {
              name: 'propose_goal_completion',
              reason: 'The student said they understood.',
              expectedEvidence: 'attempt_submitted',
              confidence: 'medium',
            },
          ],
          evidenceLevel: 'self_reported',
          confidence: 'medium',
          reason: 'Self-reported understanding is not enough to finish the lesson.',
          verifierResult: 'cannot_verify',
        }),
      })),
    };
    service = new LessonDecisionService(
      db,
      aiModel as any,
      new LessonPolicyService(),
      config,
    );
    db.run(
      'INSERT INTO users (id, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
      ['student-1', 'Маша', 'hash', 'student', new Date().toISOString()],
    );
  });

  afterEach(() => {
    db.onModuleDestroy();
  });

  it('rejects self-reported goal completion and stores decision observability', async () => {
    lessonService.beginTurn({
      userId: 'student-1',
      conversationId: 'conv-decision',
      lessonType: 'tutor',
    });
    const lifecycle = lessonService.beginTurn({
      userId: 'student-1',
      conversationId: 'conv-decision',
      lessonType: 'tutor',
    });

    const result = await service.decide({
      userId: 'student-1',
      userName: 'Маша',
      conversationId: 'conv-decision',
      lessonType: 'tutor',
      lifecycle,
      studentMessage: 'Я понял, спасибо',
      source: 'text',
      usageContext: {
        userId: 'student-1',
        conversationId: 'conv-decision',
        lessonSessionId: lifecycle.lessonSessionId,
        lessonType: 'tutor',
      },
    });

    expect(result.policy.goalCompletion.accepted).toBe(false);
    expect(result.policy.goalCompletion.requiredAction).toBe('request_student_attempt');
    expect(aiModel.createOperationResponse).toHaveBeenCalledWith(
      'lessonDecision',
      expect.objectContaining({
        usageContext: expect.objectContaining({
          lessonSessionId: lifecycle.lessonSessionId,
        }),
      }),
    );

    const row = db.get<{
      accepted: number;
      rejection_reason: string;
      evidence_level: string;
      model: string;
    }>(
      `SELECT accepted, rejection_reason, evidence_level, model
       FROM lesson_decisions
       WHERE lesson_session_id = ?
         AND tool_name = 'propose_goal_completion'`,
      [lifecycle.lessonSessionId],
    );
    expect(row).toEqual(
      expect.objectContaining({
        accepted: 0,
        evidence_level: 'self_reported',
        model: 'gpt-lesson',
      }),
    );
    expect(row?.rejection_reason).toContain('requires attempt_submitted evidence');
  });

  it('accepts practice goal completion only from backend verifier evidence', async () => {
    aiModel.createOperationResponse.mockResolvedValueOnce({
      output_text: JSON.stringify({
        actions: [{ name: 'continue_lesson', confidence: 'medium' }],
        evidenceLevel: 'agent_interpreted',
        confidence: 'medium',
        reason: 'The student submitted an answer.',
        verifierResult: 'cannot_verify',
      }),
    });
    lessonService.beginTurn({
      userId: 'student-1',
      conversationId: 'conv-verified',
      lessonType: 'practice',
    });
    const lifecycle = lessonService.beginTurn({
      userId: 'student-1',
      conversationId: 'conv-verified',
      lessonType: 'practice',
    });

    const result = await service.decide({
      userId: 'student-1',
      userName: 'Маша',
      conversationId: 'conv-verified',
      lessonType: 'practice',
      lifecycle,
      studentMessage: 'x = 6',
      source: 'text',
      verifierEvidence: {
        attemptSubmitted: true,
        taskId: 'task-1',
        attemptId: 'attempt-1',
        result: 'correct',
        confidence: 'high',
        masteryUpdateAllowed: true,
        topicId: 'algebra.linear_equations',
        skillId: 'algebra.linear.solve_one_variable',
        taskTypeId: 'ege.base.linear_equation_numeric',
      },
      usageContext: {
        userId: 'student-1',
        conversationId: 'conv-verified',
        lessonSessionId: lifecycle.lessonSessionId,
        lessonType: 'practice',
        correlationId: 'turn-test',
      },
    });

    expect(result.policy.goalCompletion.accepted).toBe(true);
    expect(result.policy.verifierResult).toBe('correct');
    expect(result.decision.actions.some((action) => action.name === 'propose_goal_completion')).toBe(
      true,
    );

    const row = db.get<{
      accepted: number;
      verifier_result: string;
      usage_correlation_id: string;
    }>(
      `SELECT accepted, verifier_result, usage_correlation_id
       FROM lesson_decisions
       WHERE lesson_session_id = ?
         AND tool_name = 'propose_goal_completion'`,
      [lifecycle.lessonSessionId],
    );
    expect(row).toEqual({
      accepted: 1,
      verifier_result: 'correct',
      usage_correlation_id: 'turn-test',
    });
  });

  it('routes profile delta proposals into background observations instead of applying them directly', async () => {
    aiModel.createOperationResponse.mockResolvedValueOnce({
      output_text: JSON.stringify({
        actions: [
          {
            name: 'propose_profile_delta',
            arguments: {
              field: 'explanation_preference',
              value: 'example_before_rule',
              confidence: 'medium',
              scope: 'algebra',
            },
            reason: 'The student solved faster after an example.',
            confidence: 'medium',
          },
        ],
        evidenceLevel: 'agent_interpreted',
        confidence: 'medium',
        reason: 'Profile hypothesis should be reviewed in background.',
        verifierResult: 'none',
      }),
    });
    const lifecycle = lessonService.beginTurn({
      userId: 'student-1',
      conversationId: 'conv-profile-delta',
      lessonType: 'tutor',
    });

    const result = await service.decide({
      userId: 'student-1',
      userName: 'Маша',
      conversationId: 'conv-profile-delta',
      lessonType: 'tutor',
      lifecycle,
      studentMessage: 'Мне легче после примера',
      source: 'text',
    });

    expect(result.policy.rejectedActions[0]).toEqual(
      expect.objectContaining({
        toolName: 'propose_profile_delta',
        requiredAction: 'record_learning_observation',
      }),
    );
    const observation = db.get<{ observation_json: string }>(
      `SELECT observation_json
       FROM background_learning_observations
       WHERE user_id = ?
         AND conversation_id = ?`,
      ['student-1', 'conv-profile-delta'],
    );
    expect(observation?.observation_json).toContain('profile_delta_candidate');
  });
});
