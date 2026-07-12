import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { tmpdir } from 'os';
import { DatabaseService } from '../src/database/database.service';
import { LessonService } from '../src/lesson/lesson.service';

function createConfig(sqlitePath: string, overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    'app.sqlitePath': sqlitePath,
    'app.lessonDailySoftLimitMinutes': 90,
    'app.lessonDailyHardLimitMinutes': 120,
    'app.lessonContinuousSoftLimitMinutes': 45,
    'app.lessonContinuousHardLimitMinutes': 60,
    'app.lessonMinTurnSeconds': 30,
    'app.lessonMaxTurnGapSeconds': 900,
    ...overrides,
  };
  return {
    get: <T>(key: string) => values[key] as T,
  } as ConfigService;
}

describe('LessonService', () => {
  let db: DatabaseService;
  let service: LessonService;

  beforeEach(() => {
    const sqlitePath = join(tmpdir(), `egmathteacher-lesson-${randomUUID()}.sqlite`);
    const config = createConfig(sqlitePath);
    db = new DatabaseService(config);
    service = new LessonService(db, config);
    db.run(
      'INSERT INTO users (id, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
      ['student-1', 'Маша', 'hash', 'student', new Date().toISOString()],
    );
  });

  afterEach(() => {
    db.onModuleDestroy();
  });

  it('starts a new lesson session when the lesson type changes on the same conversation', () => {
    const tutorLifecycle = service.beginTurn({
      userId: 'student-1',
      conversationId: 'conv-1',
      lessonType: 'tutor',
    });

    const practiceLifecycle = service.beginTurn({
      userId: 'student-1',
      conversationId: 'conv-1',
      lessonType: 'practice',
    });

    expect(practiceLifecycle.lessonType).toBe('practice');
    expect(practiceLifecycle.lessonSessionId).not.toBe(tutorLifecycle.lessonSessionId);

    const oldSession = db.get<{ status: string; finish_reason: string | null }>(
      'SELECT status, finish_reason FROM lesson_sessions WHERE id = ?',
      [tutorLifecycle.lessonSessionId],
    );
    expect(oldSession).toEqual({
      status: 'finished',
      finish_reason: 'lesson_type_changed_to_practice',
    });
  });

  it('does not charge active learning time for the first turn', () => {
    const lifecycle = service.beginTurn({
      userId: 'student-1',
      conversationId: 'conv-time',
      lessonType: 'tutor',
    });

    expect(lifecycle.turnCount).toBe(1);
    expect(lifecycle.activeLearningSeconds).toBe(0);
    expect(lifecycle.dayActiveLearningSeconds).toBe(0);
  });

  it('uses only scoped progress rows for the current lesson strategy signal', () => {
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO student_skill_progress (
         id, user_id, conversation_id, lesson_type, topic, skill, direction,
         confidence, support_needed, independence, evidence_json, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'progress-geometry',
        'student-1',
        'other-conv',
        'tutor',
        'геометрия',
        'окружность',
        'regression',
        'medium',
        'step_by_step',
        'low',
        JSON.stringify({ evidence: ['старый сигнал'] }),
        now,
      ],
    );
    db.run(
      `INSERT INTO student_skill_progress (
         id, user_id, conversation_id, lesson_type, topic, skill, direction,
         confidence, support_needed, independence, evidence_json, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'progress-derivative',
        'student-1',
        'other-conv',
        'tutor',
        'производная',
        'смысл производной',
        'progress',
        'medium',
        'hint',
        'medium',
        JSON.stringify({ evidence: ['релевантный сигнал'] }),
        now,
      ],
    );

    const lifecycle = service.beginTurn({
      userId: 'student-1',
      conversationId: 'conv-derivative',
      lessonType: 'tutor',
      topicHint: 'производ',
    });

    expect(lifecycle.strategySignal.direction).toBe('stable');
    expect(lifecycle.strategySignal.summary).toContain('Релевантные');
  });

  it('keeps model goal completion pending without backend policy acceptance', () => {
    const firstLifecycle = service.beginTurn({
      userId: 'student-1',
      conversationId: 'conv-goal',
      lessonType: 'tutor',
    });

    const pendingCompletion = service.completeTurn({
      userId: 'student-1',
      studentMessage: 'Объясни производную',
      lifecycle: firstLifecycle,
      goalStatus: 'reached',
      answerShape: {
        tasksCount: 1,
        examplesCount: 1,
        imageBlocksCount: 0,
      },
    });

    expect(pendingCompletion.goalStatus).toBe('in_progress');
    expect(pendingCompletion.goalStatusEvidence).toBe('model_suggested_pending');
    expect(pendingCompletion.shouldStop).toBe(false);

    const secondLifecycle = service.beginTurn({
      userId: 'student-1',
      conversationId: 'conv-goal',
      lessonType: 'tutor',
    });
    const selfReportedCompletion = service.completeTurn({
      userId: 'student-1',
      studentMessage: 'Поняла, получилось: ответ равен 6',
      lifecycle: secondLifecycle,
      goalStatus: 'reached',
      answerShape: {
        tasksCount: 0,
        examplesCount: 0,
        imageBlocksCount: 0,
      },
    });

    expect(selfReportedCompletion.goalStatus).toBe('in_progress');
    expect(selfReportedCompletion.goalStatusEvidence).toBe('model_suggested_pending');
    expect(selfReportedCompletion.shouldStop).toBe(false);
  });

  it('accepts goal completion only when backend policy accepted it', () => {
    service.beginTurn({
      userId: 'student-1',
      conversationId: 'conv-policy',
      lessonType: 'tutor',
    });
    const lifecycle = service.beginTurn({
      userId: 'student-1',
      conversationId: 'conv-policy',
      lessonType: 'tutor',
    });

    const acceptedCompletion = service.completeTurn({
      userId: 'student-1',
      studentMessage: 'x = 6',
      lifecycle,
      goalStatus: 'in_progress',
      decisionPolicy: {
        decisionId: 'decision-1',
        evidenceLevel: 'attempt_submitted',
        actionResults: [
          {
            toolName: 'propose_goal_completion',
            accepted: true,
            reason: 'Backend policy accepted goal completion for this lesson type.',
            evidenceLevel: 'attempt_submitted',
          },
        ],
        acceptedActions: ['propose_goal_completion'],
        rejectedActions: [],
        goalCompletion: {
          proposed: true,
          accepted: true,
          reason: 'Backend policy accepted goal completion for this lesson type.',
          evidenceLevel: 'attempt_submitted',
        },
        shouldSuggestBreak: false,
        goalBlocked: false,
        recommendedNextAction: 'propose_goal_completion',
        verifierResult: 'cannot_verify',
      },
      answerShape: {
        tasksCount: 0,
        examplesCount: 0,
        imageBlocksCount: 0,
      },
    });

    expect(acceptedCompletion.goalStatus).toBe('reached');
    expect(acceptedCompletion.goalStatusEvidence).toBe('backend_observed');
    expect(acceptedCompletion.goalEvidenceLevel).toBe('attempt_submitted');
    expect(acceptedCompletion.status).toBe('goal_reached');
    expect(acceptedCompletion.shouldStop).toBe(true);
  });

  it('persists goal blocked when backend policy accepts blockage', () => {
    service.beginTurn({
      userId: 'student-1',
      conversationId: 'conv-blocked',
      lessonType: 'tutor',
    });
    const lifecycle = service.beginTurn({
      userId: 'student-1',
      conversationId: 'conv-blocked',
      lessonType: 'tutor',
    });

    const blocked = service.completeTurn({
      userId: 'student-1',
      studentMessage: 'Я все еще путаюсь',
      lifecycle,
      goalStatus: 'in_progress',
      decisionPolicy: {
        decisionId: 'decision-blocked',
        evidenceLevel: 'agent_interpreted',
        actionResults: [
          {
            toolName: 'mark_goal_blocked',
            accepted: true,
            reason: 'Goal blockage can be recorded after repeated evidence in the current lesson.',
            evidenceLevel: 'agent_interpreted',
          },
        ],
        acceptedActions: ['mark_goal_blocked'],
        rejectedActions: [],
        goalCompletion: {
          proposed: false,
          accepted: false,
          reason: 'No goal-completion action was proposed.',
          evidenceLevel: 'agent_interpreted',
        },
        shouldSuggestBreak: false,
        goalBlocked: true,
        recommendedNextAction: 'mark_goal_blocked',
        verifierResult: 'cannot_verify',
      },
      answerShape: {
        tasksCount: 0,
        examplesCount: 1,
        imageBlocksCount: 0,
      },
    });

    expect(blocked.goalStatus).toBe('blocked');
    expect(blocked.finishReason).toBe('lesson_goal_blocked_by_backend_policy');
    const row = db.get<{ goal_status: string; finish_reason: string | null }>(
      'SELECT goal_status, finish_reason FROM lesson_sessions WHERE id = ?',
      [lifecycle.lessonSessionId],
    );
    expect(row).toEqual({
      goal_status: 'blocked',
      finish_reason: 'lesson_goal_blocked_by_backend_policy',
    });

    const nextTurn = service.beginTurn({
      userId: 'student-1',
      conversationId: 'conv-blocked',
      lessonType: 'tutor',
    });
    expect(nextTurn.goalStatus).toBe('blocked');
  });
});
