import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { DatabaseService } from '../src/database/database.service';
import { MasteryPolicyService } from '../src/lesson/mastery-policy.service';
import { MathVerifierService } from '../src/lesson/math-verifier.service';
import { TaskBankService } from '../src/lesson/task-bank.service';

function createConfig(sqlitePath: string, taskBankRequired = false): ConfigService {
  return {
    get: <T>(key: string) =>
      ({
        'app.sqlitePath': sqlitePath,
        'app.taskBankRequired': taskBankRequired,
      })[key] as T,
  } as ConfigService;
}

describe('MathVerifierService', () => {
  let db: DatabaseService;
  let service: MathVerifierService;

  beforeEach(() => {
    const sqlitePath = join(tmpdir(), `egmathteacher-verifier-${randomUUID()}.sqlite`);
    const config = createConfig(sqlitePath);
    db = new DatabaseService(config);
    service = new MathVerifierService(
      db,
      new TaskBankService(db),
      new MasteryPolicyService(db),
      config,
    );
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
    const task = db.get<{ status: string }>('SELECT status FROM lesson_tasks WHERE id = ?', [
      'task-1',
    ]);
    expect(task?.status).toBe('pending');
  });

  it('stores verified attempts without mastery evidence until imported criteria are satisfied', () => {
    db.run(
      `INSERT INTO curriculum_mastery_criteria (
         skill_id, minimum_criterion, required_evidence_sequence_json,
         self_report_can_complete, single_success_can_complete,
         recommended_recheck_days_json, regression_trigger,
         source_pack_version, source_path, content_hash, created_at, updated_at
       )
       VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'algebra.linear.solve_one_variable',
        'Two independent verified attempts.',
        JSON.stringify(['attempt_submitted', 'deterministically_verified']),
        JSON.stringify([2, 7]),
        'Miss twice after success.',
        'v1.0',
        'rag-corpus/02-curriculum/curriculum-mastery-criteria.json',
        'hash',
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );

    const first = service.verifyPendingTaskAttempt({
      userId: 'student-1',
      lessonSessionId: 'lesson-1',
      conversationId: 'conv-1',
      message: 'x = 6',
    });

    expect(first).toEqual(
      expect.objectContaining({
        result: 'correct',
        masteryUpdateAllowed: false,
        masteryEvidenceLevel: 'deterministically_verified',
        verifiedSuccessCount: 1,
        independentSuccessCount: 1,
        requiredSuccessCount: 2,
      }),
    );
    expect(
      db.get<{ count: number }>('SELECT COUNT(*) AS count FROM mastery_evidence'),
    ).toEqual({ count: 0 });
    expect(
      db.get<{ status: string }>('SELECT status FROM lesson_tasks WHERE id = ?', ['task-1']),
    ).toEqual({ status: 'verified_correct' });

    const now = new Date().toISOString();
    db.run(
      `INSERT INTO lesson_tasks (
         id, user_id, lesson_session_id, conversation_id, lesson_type,
         topic_id, skill_id, task_type_id, prompt, expected_answer,
         verifier_kind, source, status, hint_ladder_json, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [
        'task-2',
        'student-1',
        'lesson-1',
        'conv-1',
        'practice',
        'algebra.linear_equations',
        'algebra.linear.solve_one_variable',
        'ege.base.linear_equation_numeric',
        'Реши уравнение: 3x = 9.',
        '3',
        'linear_equation_numeric',
        'task_bank_imported',
        JSON.stringify([]),
        now,
        now,
      ],
    );

    const second = service.verifyPendingTaskAttempt({
      userId: 'student-1',
      lessonSessionId: 'lesson-1',
      conversationId: 'conv-1',
      message: 'x = 3',
    });

    expect(second).toEqual(
      expect.objectContaining({
        result: 'correct',
        masteryUpdateAllowed: true,
        masteryEvidenceLevel: 'repeated_independent_success',
        verifiedSuccessCount: 2,
        independentSuccessCount: 2,
        requiredSuccessCount: 2,
      }),
    );
    expect(
      db.get<{ evidence_level: string }>(
        'SELECT evidence_level FROM mastery_evidence WHERE task_id = ?',
        ['task-2'],
      ),
    ).toEqual({ evidence_level: 'repeated_independent_success' });
  });

  it('creates pending lesson tasks from the imported task bank', () => {
    db.run('DELETE FROM lesson_tasks');
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO task_bank_tasks (
         task_id, topic_id, skill_id, task_type_id, difficulty, prompt,
         expected_answer, solution_steps_json, common_errors_json, hint_ladder_json,
         verifier_kind, source_type, verification_json, task_bank_file,
         source_pack_version, source_path, content_hash, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'bank-task-1',
        'algebra.linear_equations',
        'algebra.linear.solve_one_variable',
        'ege.base.linear_equation_numeric',
        'foundation',
        'Реши уравнение: 5x - 4 = 11.',
        '3',
        JSON.stringify(['5x=15', 'x=3']),
        JSON.stringify(['sign_error']),
        JSON.stringify(['Перенеси -4.', 'Раздели на 5.']),
        'linear_equation_numeric',
        'fixture',
        JSON.stringify({ status: 'checked' }),
        'tasks-base.jsonl',
        'v1.0',
        'rag-corpus/04-task-bank/tasks-base.jsonl',
        'hash',
        now,
        now,
      ],
    );

    const answer = {
      tasks: [],
      blocks: [],
      lessonLifecycle: {
        shouldStop: false,
        goalStatus: 'in_progress',
      },
      debug: {
        verifier: { masteryUpdateAllowed: false },
        decision: { recommendedNextAction: 'request_student_attempt' },
      },
    } as any;

    const evidence = service.ensureBackendTask({
      userId: 'student-1',
      lessonSessionId: 'lesson-1',
      conversationId: 'conv-1',
      lessonType: 'practice',
      curriculum: {
        topicId: 'algebra.linear_equations',
        topicTitle: 'Линейные уравнения',
        skillId: 'algebra.linear.solve_one_variable',
        skillTitle: 'Решение линейного уравнения',
        taskTypeId: 'ege.base.linear_equation_numeric',
        taskTypeTitle: 'Линейное уравнение',
        verifierKind: 'linear_equation_numeric',
        confidence: 'high',
      },
      answer,
    });

    expect(evidence?.prompt).toBe('Реши уравнение: 5x - 4 = 11.');
    expect(answer.tasks[0].prompt).toBe('Реши уравнение: 5x - 4 = 11.');
    expect(answer.tasks[0].hintLadder).toEqual(['Перенеси -4.', 'Раздели на 5.']);
    expect(
      db.get<{ expected_answer: string; source: string; hint_ladder_json: string }>(
        'SELECT expected_answer, source, hint_ladder_json FROM lesson_tasks LIMIT 1',
      ),
    ).toEqual({
      expected_answer: '3',
      source: 'task_bank_imported',
      hint_ladder_json: JSON.stringify(['Перенеси -4.', 'Раздели на 5.']),
    });
  });

  it('can require imported task-bank rows instead of silently using fallback tasks', () => {
    const sqlitePath = join(tmpdir(), `egmathteacher-verifier-required-${randomUUID()}.sqlite`);
    const config = createConfig(sqlitePath, true);
    const strictDb = new DatabaseService(config);
    try {
      const strictService = new MathVerifierService(
        strictDb,
        new TaskBankService(strictDb),
        new MasteryPolicyService(strictDb),
        config,
      );
      const now = new Date().toISOString();
      strictDb.run(
        'INSERT INTO users (id, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
        ['student-2', 'Ира', 'hash', 'student', now],
      );
      strictDb.run(
        `INSERT INTO lesson_sessions (
           id, user_id, conversation_id, lesson_type, status, goal_status,
           goal_text, success_criteria_json, active_learning_seconds, turn_count,
           started_at, last_activity_at, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, 'active', 'in_progress', ?, ?, 0, 1, ?, ?, ?, ?)`,
        [
          'lesson-2',
          'student-2',
          'conv-2',
          'practice',
          'Потренировать навык',
          JSON.stringify(['есть попытка']),
          now,
          now,
          now,
          now,
        ],
      );

      expect(() =>
        strictService.ensureBackendTask({
          userId: 'student-2',
          lessonSessionId: 'lesson-2',
          conversationId: 'conv-2',
          lessonType: 'practice',
          curriculum: {
            topicId: 'algebra.linear_equations',
            topicTitle: 'Линейные уравнения',
            skillId: 'algebra.linear.solve_one_variable',
            skillTitle: 'Решение линейного уравнения',
            taskTypeId: 'ege.base.linear_equation_numeric',
            taskTypeTitle: 'Линейное уравнение',
            verifierKind: 'linear_equation_numeric',
            confidence: 'high',
          },
          answer: {
            tasks: [],
            blocks: [],
            lessonLifecycle: {
              shouldStop: false,
              goalStatus: 'in_progress',
            },
            debug: {
              verifier: { masteryUpdateAllowed: false },
              decision: { recommendedNextAction: 'request_student_attempt' },
            },
          } as any,
        }),
      ).toThrow('Task bank task is required');
    } finally {
      strictDb.onModuleDestroy();
    }
  });
});
