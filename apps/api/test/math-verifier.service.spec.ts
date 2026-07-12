import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { DatabaseService } from '../src/database/database.service';
import { MathVerifierService } from '../src/lesson/math-verifier.service';

function createConfig(sqlitePath: string): ConfigService {
  return {
    get: <T>(key: string) =>
      ({
        'app.sqlitePath': sqlitePath,
      })[key] as T,
  } as ConfigService;
}

describe('MathVerifierService', () => {
  let db: DatabaseService;
  let service: MathVerifierService;

  beforeEach(() => {
    const sqlitePath = join(tmpdir(), `egmathteacher-verifier-${randomUUID()}.sqlite`);
    db = new DatabaseService(createConfig(sqlitePath));
    service = new MathVerifierService(db);
    const now = new Date().toISOString();
    db.run(
      'INSERT INTO users (id, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
      ['student-1', 'Маша', 'hash', 'student', now],
    );
    db.run(
      `INSERT INTO lesson_sessions (
         id, user_id, conversation_id, lesson_type, status, goal_status,
         goal_text, success_criteria_json, active_learning_seconds, turn_count,
         started_at, last_activity_at, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, 'active', 'in_progress', ?, ?, 0, 1, ?, ?, ?, ?)`,
      [
        'lesson-1',
        'student-1',
        'conv-1',
        'practice',
        'Потренировать навык',
        JSON.stringify(['есть попытка']),
        now,
        now,
        now,
        now,
      ],
    );
    db.run(
      `INSERT INTO lesson_tasks (
         id, user_id, lesson_session_id, conversation_id, lesson_type,
         topic_id, skill_id, task_type_id, prompt, expected_answer,
         verifier_kind, source, status, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        'task-1',
        'student-1',
        'lesson-1',
        'conv-1',
        'practice',
        'algebra.linear_equations',
        'algebra.linear.solve_one_variable',
        'ege.base.linear_equation_numeric',
        'Реши уравнение: 2x + 3 = 15.',
        '6',
        'linear_equation_numeric',
        'backend_generated',
        now,
        now,
      ],
    );
  });

  afterEach(() => {
    db.onModuleDestroy();
  });

  it('stores verified attempts and mastery evidence for correct numeric answers', () => {
    const evidence = service.verifyPendingTaskAttempt({
      userId: 'student-1',
      lessonSessionId: 'lesson-1',
      conversationId: 'conv-1',
      message: 'x = 6',
    });

    expect(evidence).toEqual(
      expect.objectContaining({
        attemptSubmitted: true,
        result: 'correct',
        masteryUpdateAllowed: true,
        skillId: 'algebra.linear.solve_one_variable',
      }),
    );
    const task = db.get<{ status: string }>('SELECT status FROM lesson_tasks WHERE id = ?', [
      'task-1',
    ]);
    expect(task?.status).toBe('verified_correct');
    const mastery = db.get<{ outcome: string }>(
      'SELECT outcome FROM mastery_evidence WHERE task_id = ?',
      ['task-1'],
    );
    expect(mastery?.outcome).toBe('verified_learning_outcome');
  });

  it('stores incorrect attempts without mastery evidence', () => {
    const evidence = service.verifyPendingTaskAttempt({
      userId: 'student-1',
      lessonSessionId: 'lesson-1',
      conversationId: 'conv-1',
      message: 'ответ 5',
    });

    expect(evidence).toEqual(
      expect.objectContaining({
        attemptSubmitted: true,
        result: 'incorrect',
        errorCode: 'answer_too_small',
        masteryUpdateAllowed: false,
      }),
    );
    const mastery = db.get<{ count: number | null }>(
      'SELECT COUNT(*) AS count FROM mastery_evidence WHERE task_id = ?',
      ['task-1'],
    );
    expect(mastery?.count).toBe(0);
  });
});
