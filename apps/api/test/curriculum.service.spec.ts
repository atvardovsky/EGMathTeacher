import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { DatabaseService } from '../src/database/database.service';
import { CurriculumService } from '../src/lesson/curriculum.service';

function createConfig(sqlitePath: string): ConfigService {
  return {
    get: <T>(key: string) =>
      ({
        'app.sqlitePath': sqlitePath,
      })[key] as T,
  } as ConfigService;
}

describe('CurriculumService', () => {
  let db: DatabaseService;
  let service: CurriculumService;

  beforeEach(() => {
    const sqlitePath = join(tmpdir(), `egmathteacher-curriculum-${randomUUID()}.sqlite`);
    db = new DatabaseService(createConfig(sqlitePath));
    service = new CurriculumService(db);
  });

  afterEach(() => {
    db.onModuleDestroy();
  });

  it('keeps unrelated messages unknown instead of falling back to linear equations', () => {
    expect(service.resolve('поговорим о вероятности и случайных событиях')).toEqual(
      expect.objectContaining({
        topicId: 'unknown',
        skillId: 'unknown',
        verifierKind: 'unsupported',
      }),
    );
  });

  it('resolves active imported curriculum skills from SQLite', () => {
    insertCurriculumSkill(db, {
      skillId: 'algebra.logarithms.basic_properties',
      topicId: 'algebra.logarithms',
      topicTitle: 'Логарифмы',
      skillTitle: 'Базовые свойства логарифмов',
      taskTypeId: 'ege.base.logarithm_simplification',
      taskTypeTitle: 'ЕГЭ: свойства логарифмов',
      description: 'Упрощает выражения с логарифмами.',
      taskTypeIds: ['ege.base.logarithm_simplification'],
      explanationMethods: ['worked_example'],
      minimumMasteryCriterion: 'Explains one property and applies it once.',
      verificationMethods: ['student_explanation'],
      recommendedLessonType: 'concept',
    });

    expect(service.resolve('помоги понять свойства логарифмов')).toEqual(
      expect.objectContaining({
        topicId: 'algebra.logarithms',
        skillId: 'algebra.logarithms.basic_properties',
        taskTypeId: 'ege.base.logarithm_simplification',
        verifierKind: 'unsupported',
      }),
    );
  });

  it('keeps a one-term curriculum match as low-confidence unknown', () => {
    insertCurriculumSkill(db, {
      skillId: 'test.low.one_term',
      topicId: 'test.low',
      topicTitle: 'Низкая уверенность',
      skillTitle: 'zqx',
      taskTypeId: 'test.low.task',
      taskTypeTitle: 'Редкий тип',
      description: '',
    });

    expect(service.resolve('zqx')).toEqual(
      expect.objectContaining({
        topicId: 'unknown',
        skillId: 'unknown',
        resolutionReason: 'low_confidence',
        candidates: [
          expect.objectContaining({
            skillId: 'test.low.one_term',
            score: 1,
          }),
        ],
      }),
    );
  });

  it('keeps equal-score curriculum matches as ambiguous unknown', () => {
    insertCurriculumSkill(db, {
      skillId: 'test.ambiguous.first',
      topicId: 'test.ambiguous',
      topicTitle: 'Общая тема',
      skillTitle: 'двойной навык',
      taskTypeId: 'test.ambiguous.first_task',
      taskTypeTitle: 'Одинаковая формулировка',
      description: '',
    });
    insertCurriculumSkill(db, {
      skillId: 'test.ambiguous.second',
      topicId: 'test.ambiguous',
      topicTitle: 'Общая тема',
      skillTitle: 'двойной навык',
      taskTypeId: 'test.ambiguous.second_task',
      taskTypeTitle: 'Одинаковая формулировка',
      description: '',
    });

    const resolved = service.resolve('двойной навык');

    expect(resolved).toEqual(
      expect.objectContaining({
        topicId: 'unknown',
        skillId: 'unknown',
        resolutionReason: 'ambiguous',
      }),
    );
    expect(resolved.candidates).toHaveLength(2);
  });
});

function insertCurriculumSkill(
  db: DatabaseService,
  input: {
    skillId: string;
    topicId: string;
    topicTitle: string;
    skillTitle: string;
    taskTypeId: string;
    taskTypeTitle: string;
    description?: string;
    taskTypeIds?: string[];
    explanationMethods?: string[];
    minimumMasteryCriterion?: string;
    verificationMethods?: string[];
    recommendedLessonType?: string;
  },
): void {
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO curriculum_skills (
       skill_id, topic_id, topic_title, skill_title, task_type_id,
       task_type_title, verifier_kind, created_at, description,
       prerequisites_json, task_type_ids_json, typical_misconceptions_json,
       explanation_methods_json, minimum_mastery_criterion,
       verification_methods_json, recommended_lesson_type,
       deterministic_verification, difficulty, estimated_learning_minutes,
       source_pack_version, source_path, content_hash, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.skillId,
      input.topicId,
      input.topicTitle,
      input.skillTitle,
      input.taskTypeId,
      input.taskTypeTitle,
      'unsupported',
      now,
      input.description ?? '',
      JSON.stringify([]),
      JSON.stringify(input.taskTypeIds ?? [input.taskTypeId]),
      JSON.stringify([]),
      JSON.stringify(input.explanationMethods ?? []),
      input.minimumMasteryCriterion ?? 'Fixture criterion.',
      JSON.stringify(input.verificationMethods ?? []),
      input.recommendedLessonType ?? 'practice',
      'planned',
      'base',
      25,
      'v1.0',
      'rag-corpus/02-curriculum/curriculum-skills.json',
      `hash-${input.skillId}`,
      now,
    ],
  );
}
