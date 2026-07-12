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
        'algebra.logarithms.basic_properties',
        'algebra.logarithms',
        'Логарифмы',
        'Базовые свойства логарифмов',
        'ege.base.logarithm_simplification',
        'ЕГЭ: свойства логарифмов',
        'unsupported',
        now,
        'Упрощает выражения с логарифмами.',
        JSON.stringify([]),
        JSON.stringify(['ege.base.logarithm_simplification']),
        JSON.stringify([]),
        JSON.stringify(['worked_example']),
        'Explains one property and applies it once.',
        JSON.stringify(['student_explanation']),
        'concept',
        'planned',
        'base',
        25,
        'v1.0',
        'rag-corpus/02-curriculum/curriculum-skills.json',
        'hash',
        now,
      ],
    );

    expect(service.resolve('помоги понять свойства логарифмов')).toEqual(
      expect.objectContaining({
        topicId: 'algebra.logarithms',
        skillId: 'algebra.logarithms.basic_properties',
        taskTypeId: 'ege.base.logarithm_simplification',
        verifierKind: 'unsupported',
      }),
    );
  });
});
