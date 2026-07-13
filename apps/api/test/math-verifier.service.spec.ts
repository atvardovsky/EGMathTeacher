import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { DatabaseService } from '../src/database/database.service';
import { HintRoutingService } from '../src/lesson/hint-routing.service';
import { MasteryPolicyService } from '../src/lesson/mastery-policy.service';
import { MathVerifierService } from '../src/lesson/math-verifier.service';
import { TaskBankService } from '../src/lesson/task-bank.service';

function createConfig(
  sqlitePath: string,
  taskBankRequired = false,
  masteryCriteriaRequired = true,
): ConfigService {
  return {
    get: <T>(key: string) =>
      ({
        'app.sqlitePath': sqlitePath,
        'app.taskBankRequired': taskBankRequired,
        'app.masteryCriteriaRequired': masteryCriteriaRequired,
      })[key] as T,
  } as ConfigService;
}

const GENERATED_LINEAR_SOURCE_TASK_ID =
  'generated:linear_equation_numeric:Реши_уравнение:_2x_+_3_=_15.';
const GENERATED_FALLBACK_SOURCE_TASK_ID =
  'generated:linear_equation_numeric:Реши_уравнение:_2x_+_3_=_15._В_ответе_напиши_значение_x.';

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
      new MasteryPolicyService(db, config),
      new HintRoutingService(db),
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
         topic_id, skill_id, task_type_id, source_task_id, prompt, expected_answer,
         verifier_kind, source, status, hint_ladder_json, common_errors_json, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [
        'task-1',
        'student-1',
        'lesson-1',
        'conv-1',
        'practice',
        'algebra.linear_equations',
        'algebra.linear.solve_one_variable',
        'ege.base.linear_equation_numeric',
        GENERATED_LINEAR_SOURCE_TASK_ID,
        'Реши уравнение: 2x + 3 = 15.',
        '6',
        'linear_equation_numeric',
        'backend_generated',
        JSON.stringify([]),
        JSON.stringify([]),
        now,
        now,
      ],
    );
  });

  afterEach(() => {
    db.onModuleDestroy();
  });

  it('stores verified attempts and mastery evidence for correct numeric answers', () => {
    insertMasteryCriteria(db, true);

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
        sourceTaskId: GENERATED_LINEAR_SOURCE_TASK_ID,
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

  it('stores invalid-format answer attempts and returns a format hint', () => {
    const evidence = service.verifyPendingTaskAttempt({
      userId: 'student-1',
      lessonSessionId: 'lesson-1',
      conversationId: 'conv-1',
      message: 'ответ: шесть',
    });

    expect(evidence).toEqual(
      expect.objectContaining({
        attemptSubmitted: true,
        result: 'invalid_format',
        errorCode: 'answer_format_not_numeric',
        masteryUpdateAllowed: false,
        nextHint: 'Напиши ответ числом или в виде x = число.',
        nextHintRoute: 'format_error',
      }),
    );
    expect(
      db.get<{ verifier_result: string; error_code: string }>(
        'SELECT verifier_result, error_code FROM student_attempts WHERE task_id = ?',
        ['task-1'],
      ),
    ).toEqual({
      verifier_result: 'invalid_format',
      error_code: 'answer_format_not_numeric',
    });
    expect(
      db.get<{ status: string }>('SELECT status FROM lesson_tasks WHERE id = ?', ['task-1']),
    ).toEqual({ status: 'pending' });
  });

  it('blocks mastery when imported criteria are required but missing', () => {
    const evidence = service.verifyPendingTaskAttempt({
      userId: 'student-1',
      lessonSessionId: 'lesson-1',
      conversationId: 'conv-1',
      message: 'x = 6',
    });

    expect(evidence).toEqual(
      expect.objectContaining({
        result: 'correct',
        masteryUpdateAllowed: false,
        masteryPolicyReason: 'Active mastery criteria are required for this supported verifier skill.',
      }),
    );
    expect(db.get<{ count: number }>('SELECT COUNT(*) AS count FROM mastery_evidence')).toEqual({
      count: 0,
    });
  });

  it('stores verified attempts without mastery evidence until imported criteria are satisfied', () => {
    insertMasteryCriteria(db, false);

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
         topic_id, skill_id, task_type_id, source_task_id, prompt, expected_answer,
         verifier_kind, source, status, hint_ladder_json, common_errors_json, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [
        'task-2',
        'student-1',
        'lesson-1',
        'conv-1',
        'practice',
        'algebra.linear_equations',
        'algebra.linear.solve_one_variable',
        'ege.base.linear_equation_numeric',
        'bank-task-linear-2',
        'Реши уравнение: 3x = 9.',
        '3',
        'linear_equation_numeric',
        'task_bank_imported',
        JSON.stringify([]),
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
        cumulativeIndependentSuccessCount: 2,
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

  it('does not count repeated copies of the same source task as independent successes', () => {
    insertMasteryCriteria(db, false);

    const first = service.verifyPendingTaskAttempt({
      userId: 'student-1',
      lessonSessionId: 'lesson-1',
      conversationId: 'conv-1',
      message: 'x = 6',
    });
    expect(first.masteryUpdateAllowed).toBe(false);

    const now = new Date().toISOString();
    db.run(
      `INSERT INTO lesson_tasks (
         id, user_id, lesson_session_id, conversation_id, lesson_type,
         topic_id, skill_id, task_type_id, source_task_id, prompt, expected_answer,
         verifier_kind, source, status, hint_ladder_json, common_errors_json, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [
        'task-1-copy',
        'student-1',
        'lesson-1',
        'conv-1',
        'practice',
        'algebra.linear_equations',
        'algebra.linear.solve_one_variable',
        'ege.base.linear_equation_numeric',
        GENERATED_LINEAR_SOURCE_TASK_ID,
        'Реши уравнение: 2x + 3 = 15.',
        '6',
        'linear_equation_numeric',
        'backend_generated',
        JSON.stringify([]),
        JSON.stringify([]),
        now,
        now,
      ],
    );

    const second = service.verifyPendingTaskAttempt({
      userId: 'student-1',
      lessonSessionId: 'lesson-1',
      conversationId: 'conv-1',
      message: 'x = 6',
    });

    expect(second).toEqual(
      expect.objectContaining({
        result: 'correct',
        masteryUpdateAllowed: false,
        cumulativeVerifiedSuccessCount: 2,
        cumulativeIndependentSuccessCount: 1,
        requiredSuccessCount: 2,
      }),
    );
    expect(db.get<{ count: number }>('SELECT COUNT(*) AS count FROM mastery_evidence')).toEqual({
      count: 0,
    });
  });

  it('uses previous lesson successes for cumulative independent mastery', () => {
    insertMasteryCriteria(db, false);

    service.verifyPendingTaskAttempt({
      userId: 'student-1',
      lessonSessionId: 'lesson-1',
      conversationId: 'conv-1',
      message: 'x = 6',
    });

    const now = new Date().toISOString();
    db.run(
      `INSERT INTO lesson_sessions (
         id, user_id, conversation_id, lesson_type, status, goal_status,
         goal_text, success_criteria_json, active_learning_seconds, turn_count,
         started_at, last_activity_at, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, 'active', 'in_progress', ?, ?, 0, 1, ?, ?, ?, ?)`,
      [
        'lesson-2',
        'student-1',
        'conv-2',
        'practice',
        'Потренировать тот же навык',
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
         topic_id, skill_id, task_type_id, source_task_id, prompt, expected_answer,
         verifier_kind, source, status, hint_ladder_json, common_errors_json, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [
        'task-lesson-2',
        'student-1',
        'lesson-2',
        'conv-2',
        'practice',
        'algebra.linear_equations',
        'algebra.linear.solve_one_variable',
        'ege.base.linear_equation_numeric',
        'bank-task-linear-2',
        'Реши уравнение: 3x = 9.',
        '3',
        'linear_equation_numeric',
        'task_bank_imported',
        JSON.stringify([]),
        JSON.stringify([]),
        now,
        now,
      ],
    );

    const secondLesson = service.verifyPendingTaskAttempt({
      userId: 'student-1',
      lessonSessionId: 'lesson-2',
      conversationId: 'conv-2',
      message: 'x = 3',
    });

    expect(secondLesson).toEqual(
      expect.objectContaining({
        result: 'correct',
        masteryUpdateAllowed: true,
        currentLessonIndependentSuccessCount: 1,
        cumulativeIndependentSuccessCount: 2,
        masteryEvidenceLevel: 'repeated_independent_success',
      }),
    );
  });

  it('routes hints through imported misconceptions before generic hint ladder entries', () => {
    db.run(
      `INSERT INTO curriculum_misconceptions (
         misconception_id, title, domain, observable_sign, possible_causes_json,
         random_vs_systematic, first_question, first_hint, second_hint,
         prerequisite_to_check, retry_task_rule, forbidden_inference,
         source_pack_version, source_path, content_hash, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'sign_error',
        'Ошибка со знаком',
        'algebra',
        'Ответ меньше ожидаемого после переноса слагаемого.',
        JSON.stringify(['перенос слагаемого']),
        'systematic',
        'Что станет с -3 при переносе?',
        'Проверь знак при переносе слагаемого через равно.',
        'Запиши новый шаг: 2x = 15 - 3 или 2x = 15 + 3?',
        null,
        'give_same_skill_retry',
        'Не называй это невнимательностью без повторного evidence.',
        'v1.0',
        'rag-corpus/02-curriculum/curriculum-misconceptions.json',
        'hash',
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );
    db.run(
      `UPDATE lesson_tasks
       SET hint_ladder_json = ?,
           common_errors_json = ?
       WHERE id = ?`,
      [JSON.stringify(['Обычная подсказка.']), JSON.stringify(['sign_error']), 'task-1'],
    );

    const evidence = service.verifyPendingTaskAttempt({
      userId: 'student-1',
      lessonSessionId: 'lesson-1',
      conversationId: 'conv-1',
      message: 'ответ 5',
    });

    expect(evidence).toEqual(
      expect.objectContaining({
        result: 'incorrect',
        nextHint: 'Проверь знак при переносе слагаемого через равно.',
        nextHintRoute: 'misconception:sign_error',
        misconceptionId: 'sign_error',
      }),
    );
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
      db.get<{
        expected_answer: string;
        source: string;
        source_task_id: string;
        hint_ladder_json: string;
        common_errors_json: string;
      }>(
        'SELECT expected_answer, source, source_task_id, hint_ladder_json, common_errors_json FROM lesson_tasks LIMIT 1',
      ),
    ).toEqual({
      expected_answer: '3',
      source: 'task_bank_imported',
      source_task_id: 'bank-task-1',
      hint_ladder_json: JSON.stringify(['Перенеси -4.', 'Раздели на 5.']),
      common_errors_json: JSON.stringify(['sign_error']),
    });
  });

  it('uses migration-compatible source task ids for generated fallback tasks', () => {
    db.run('DELETE FROM lesson_tasks');
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

    expect(evidence).toEqual(
      expect.objectContaining({
        source: 'backend_generated',
        sourceTaskId: GENERATED_FALLBACK_SOURCE_TASK_ID,
      }),
    );
    expect(
      db.get<{ source_task_id: string }>(
        'SELECT source_task_id FROM lesson_tasks WHERE id = ?',
        [evidence?.taskId],
      ),
    ).toEqual({ source_task_id: GENERATED_FALLBACK_SOURCE_TASK_ID });
  });

  it('can require imported task-bank rows instead of silently using fallback tasks', () => {
    const sqlitePath = join(tmpdir(), `egmathteacher-verifier-required-${randomUUID()}.sqlite`);
    const config = createConfig(sqlitePath, true);
    const strictDb = new DatabaseService(config);
    try {
      const strictService = new MathVerifierService(
        strictDb,
        new TaskBankService(strictDb),
        new MasteryPolicyService(strictDb, config),
        new HintRoutingService(strictDb),
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

function insertMasteryCriteria(db: DatabaseService, singleSuccessCanComplete: boolean): void {
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO curriculum_mastery_criteria (
       skill_id, minimum_criterion, required_evidence_sequence_json,
       self_report_can_complete, single_success_can_complete,
       recommended_recheck_days_json, regression_trigger,
       source_pack_version, source_path, content_hash, created_at, updated_at
     )
     VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'algebra.linear.solve_one_variable',
      singleSuccessCanComplete
        ? 'One verified attempt is enough for this fixture.'
        : 'Two independent verified attempts.',
      JSON.stringify(['attempt_submitted', 'deterministically_verified']),
      singleSuccessCanComplete ? 1 : 0,
      JSON.stringify([2, 7]),
      'Miss twice after success.',
      'v1.0',
      'rag-corpus/02-curriculum/curriculum-mastery-criteria.json',
      `hash-${singleSuccessCanComplete ? 'single' : 'repeated'}`,
      now,
      now,
    ],
  );
}
