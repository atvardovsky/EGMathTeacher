import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CurriculumContext } from './lesson.types';

interface CurriculumSkillRow {
  topic_id: string;
  topic_title: string;
  skill_id: string;
  skill_title: string;
  task_type_id: string;
  task_type_title: string;
  verifier_kind: string;
  description: string | null;
  prerequisites_json: string | null;
  task_type_ids_json: string | null;
  typical_misconceptions_json: string | null;
  explanation_methods_json: string | null;
  minimum_mastery_criterion: string | null;
  verification_methods_json: string | null;
  recommended_lesson_type: string | null;
  deterministic_verification: string | null;
  difficulty: string | null;
}

interface ScoredCurriculumSkill {
  skill: CurriculumSkillRow;
  score: number;
}

const UNKNOWN_CURRICULUM_CONTEXT: CurriculumContext = {
  topicId: 'unknown',
  topicTitle: 'Неизвестная тема',
  skillId: 'unknown',
  skillTitle: 'Нужно уточнить навык',
  taskTypeId: 'unknown',
  taskTypeTitle: 'Нужно уточнить тип задания',
  verifierKind: 'unsupported',
  confidence: 'low',
  resolutionReason: 'no_match',
};

@Injectable()
export class CurriculumService {
  constructor(private readonly db: DatabaseService) {}

  resolve(message: string): CurriculumContext {
    const normalized = message.toLowerCase();
    const rows = this.getRuntimeSkills();
    const highSignal = this.resolveHighSignalContext(normalized, rows);
    if (highSignal) {
      return highSignal;
    }
    const scored: ScoredCurriculumSkill[] = rows
      .map((skill) => ({
        skill,
        score: this.scoreSkill(normalized, skill),
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score);
    const selected = scored[0]?.skill;
    const score = scored[0]?.score ?? 0;
    if (!selected || score < 2) {
      return this.unknownContext(score > 0 ? 'low_confidence' : 'no_match', scored);
    }
    const secondScore = scored[1]?.score ?? 0;
    if (secondScore === score) {
      return this.unknownContext('ambiguous', scored);
    }

    return {
      topicId: selected.topic_id,
      topicTitle: selected.topic_title,
      skillId: selected.skill_id,
      skillTitle: selected.skill_title,
      taskTypeId: selected.task_type_id,
      taskTypeTitle: selected.task_type_title,
      verifierKind:
        selected.verifier_kind === 'linear_equation_numeric'
          ? 'linear_equation_numeric'
          : 'unsupported',
      confidence: score >= 4 ? 'high' : 'medium',
      resolutionReason: 'resolved',
      candidates: this.toCandidates(scored.slice(0, 3)),
    };
  }

  getSupportedPracticeContext(message: string): CurriculumContext {
    const resolved = this.resolve(message);
    return resolved.verifierKind === 'linear_equation_numeric' ? resolved : UNKNOWN_CURRICULUM_CONTEXT;
  }

  private getRuntimeSkills(): CurriculumSkillRow[] {
    return this.db.all<CurriculumSkillRow>(
      `SELECT topic_id, topic_title, skill_id, skill_title, task_type_id,
              task_type_title, verifier_kind, description, prerequisites_json,
              task_type_ids_json, typical_misconceptions_json,
              explanation_methods_json, minimum_mastery_criterion,
              verification_methods_json, recommended_lesson_type,
              deterministic_verification, difficulty
       FROM curriculum_skills
       WHERE COALESCE(sync_status, 'active') = 'active'
       ORDER BY source_pack_version IS NULL ASC, skill_id`,
    );
  }

  private scoreSkill(normalizedMessage: string, skill: CurriculumSkillRow): number {
    const terms = this.searchTermsFor(skill);
    return terms.filter((term) => normalizedMessage.includes(term)).length;
  }

  private resolveHighSignalContext(
    normalizedMessage: string,
    rows: CurriculumSkillRow[],
  ): CurriculumContext | undefined {
    const intersectionSignal =
      /(ось\s*o?x|ox\b|пересеч|f\s*\(\s*x\s*\)\s*=\s*0|кор(е|ё)н[ьи]? функц|нули? функц)/iu.test(
        normalizedMessage,
      );
    if (intersectionSignal) {
      return this.contextFromSkill(
        rows.find((row) => row.skill_id === 'functions.graphs.intersections'),
        'resolved_high_signal',
      );
    }

    const graphReadingSignal =
      /(координат|точк[аиу]?\s*\(|\([^)]+;[^)]+\)|значени[ея]\s*y|чему равно\s*y|график)/iu.test(
        normalizedMessage,
      ) &&
      !/(производн|касательн|скорост[ьи]|derivative)/iu.test(normalizedMessage);
    if (graphReadingSignal) {
      return this.contextFromSkill(
        rows.find((row) => row.skill_id === 'functions.graphs.read_value'),
        'resolved_high_signal',
      );
    }

    return undefined;
  }

  private contextFromSkill(
    selected: CurriculumSkillRow | undefined,
    resolutionReason: CurriculumContext['resolutionReason'] | 'resolved_high_signal',
  ): CurriculumContext | undefined {
    if (!selected) {
      return undefined;
    }
    return {
      topicId: selected.topic_id,
      topicTitle: selected.topic_title,
      skillId: selected.skill_id,
      skillTitle: selected.skill_title,
      taskTypeId: selected.task_type_id,
      taskTypeTitle: selected.task_type_title,
      verifierKind:
        selected.verifier_kind === 'linear_equation_numeric'
          ? 'linear_equation_numeric'
          : 'unsupported',
      confidence: 'high',
      resolutionReason,
      candidates: [
        {
          topicId: selected.topic_id,
          skillId: selected.skill_id,
          taskTypeId: selected.task_type_id,
          score: 99,
        },
      ],
    };
  }

  private searchTermsFor(skill: CurriculumSkillRow): string[] {
    const raw = [
      skill.topic_id,
      skill.topic_title,
      skill.skill_id,
      skill.skill_title,
      skill.task_type_id,
      skill.task_type_title,
      skill.description,
      ...this.arrayStrings(skill.prerequisites_json),
      ...this.arrayStrings(skill.task_type_ids_json),
      ...this.arrayStrings(skill.typical_misconceptions_json),
      ...this.arrayStrings(skill.explanation_methods_json),
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    const terms = new Set<string>();
    for (const value of raw) {
      const normalized = value.toLowerCase();
      terms.add(normalized);
      for (const part of normalized.split(/[^a-zа-яё0-9]+/iu)) {
        if (part.length < 3) {
          continue;
        }
        if (this.isNoisyTerm(part)) {
          continue;
        }
        terms.add(part);
        if (part.length > 5) {
          terms.add(part.slice(0, 6));
        }
      }
    }
    return Array.from(terms).filter((term) => term.length >= 3);
  }

  private unknownContext(
    resolutionReason: 'no_match' | 'low_confidence' | 'ambiguous',
    scored: ScoredCurriculumSkill[],
  ): CurriculumContext {
    return {
      ...UNKNOWN_CURRICULUM_CONTEXT,
      resolutionReason,
      candidates: this.toCandidates(scored.slice(0, 3)),
    };
  }

  private toCandidates(scored: ScoredCurriculumSkill[]): CurriculumContext['candidates'] {
    return scored.map((candidate) => ({
      topicId: candidate.skill.topic_id,
      skillId: candidate.skill.skill_id,
      taskTypeId: candidate.skill.task_type_id,
      score: candidate.score,
    }));
  }

  private isNoisyTerm(term: string): boolean {
    return new Set([
      'base',
      'medium',
      'advanced',
      'foundation',
      'planned',
      'student',
      'lesson',
      'practice',
      'diagnostic',
      'concept',
      'worked',
      'example',
      'егэ',
      'база',
      'пример',
      'задача',
      'урок',
      'ученик',
    ]).has(term);
  }

  private arrayStrings(json: string | null): string[] {
    if (!json) {
      return [];
    }
    try {
      const parsed = JSON.parse(json) as unknown;
      return Array.isArray(parsed) ? parsed.map((value) => String(value)) : [];
    } catch {
      return [];
    }
  }
}
