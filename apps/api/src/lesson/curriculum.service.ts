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

const UNKNOWN_CURRICULUM_CONTEXT: CurriculumContext = {
  topicId: 'unknown',
  topicTitle: 'Неизвестная тема',
  skillId: 'unknown',
  skillTitle: 'Нужно уточнить навык',
  taskTypeId: 'unknown',
  taskTypeTitle: 'Нужно уточнить тип задания',
  verifierKind: 'unsupported',
  confidence: 'low',
};

@Injectable()
export class CurriculumService {
  constructor(private readonly db: DatabaseService) {}

  resolve(message: string): CurriculumContext {
    const normalized = message.toLowerCase();
    const rows = this.getRuntimeSkills();
    const scored = rows
      .map((skill) => ({
        skill,
        score: this.scoreSkill(normalized, skill),
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score);
    const selected = scored[0]?.skill;
    const score = scored[0]?.score ?? 0;
    if (!selected) {
      return UNKNOWN_CURRICULUM_CONTEXT;
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
      confidence: score >= 2 ? 'high' : score === 1 ? 'medium' : 'low',
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

  private searchTermsFor(skill: CurriculumSkillRow): string[] {
    const raw = [
      skill.topic_id,
      skill.topic_title,
      skill.skill_id,
      skill.skill_title,
      skill.task_type_id,
      skill.task_type_title,
      skill.description,
      skill.minimum_mastery_criterion,
      skill.recommended_lesson_type,
      skill.difficulty,
      ...this.arrayStrings(skill.prerequisites_json),
      ...this.arrayStrings(skill.task_type_ids_json),
      ...this.arrayStrings(skill.typical_misconceptions_json),
      ...this.arrayStrings(skill.explanation_methods_json),
      ...this.arrayStrings(skill.verification_methods_json),
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    const terms = new Set<string>();
    for (const value of raw) {
      const normalized = value.toLowerCase();
      terms.add(normalized);
      for (const part of normalized.split(/[^a-zа-яё0-9]+/iu)) {
        if (part.length < 3) {
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
