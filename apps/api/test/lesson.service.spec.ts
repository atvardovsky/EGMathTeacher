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

  it('treats model goal completion as pending until student evidence is visible', () => {
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
    const acceptedCompletion = service.completeTurn({
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

    expect(acceptedCompletion.goalStatus).toBe('reached');
    expect(acceptedCompletion.goalStatusEvidence).toBe('backend_observed');
    expect(acceptedCompletion.status).toBe('goal_reached');
    expect(acceptedCompletion.shouldStop).toBe(true);
  });
});
