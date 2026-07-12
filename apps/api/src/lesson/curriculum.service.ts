import { Injectable } from '@nestjs/common';
import { CurriculumContext } from './lesson.types';

interface CurriculumSkillDefinition {
  topicId: string;
  topicTitle: string;
  skillId: string;
  skillTitle: string;
  taskTypeId: string;
  taskTypeTitle: string;
  verifierKind: CurriculumContext['verifierKind'];
  keywords: string[];
}

const CURRICULUM_SKILLS: CurriculumSkillDefinition[] = [
  {
    topicId: 'algebra.linear_equations',
    topicTitle: 'Линейные уравнения',
    skillId: 'algebra.linear.solve_one_variable',
    skillTitle: 'Решение линейного уравнения с одной переменной',
    taskTypeId: 'ege.base.linear_equation_numeric',
    taskTypeTitle: 'ЕГЭ: линейное уравнение с числовым ответом',
    verifierKind: 'linear_equation_numeric',
    keywords: [
      'linear',
      'equation',
      'уравнение',
      'линейное',
      'линейные',
      'x=',
      'x =',
    ],
  },
  {
    topicId: 'algebra.quadratic_equations',
    topicTitle: 'Квадратные уравнения',
    skillId: 'algebra.quadratic.discriminant',
    skillTitle: 'Дискриминант и корни квадратного уравнения',
    taskTypeId: 'ege.base.quadratic_roots',
    taskTypeTitle: 'ЕГЭ: корни квадратного уравнения',
    verifierKind: 'unsupported',
    keywords: ['quadratic', 'discriminant', 'parabola', 'квадрат', 'дискриминант', 'парабол'],
  },
  {
    topicId: 'calculus.derivatives',
    topicTitle: 'Производная',
    skillId: 'calculus.derivative.basic_rules',
    skillTitle: 'Базовые правила вычисления производной',
    taskTypeId: 'ege.base.derivative_value',
    taskTypeTitle: 'ЕГЭ: вычисление производной',
    verifierKind: 'unsupported',
    keywords: ['derivative', 'производн'],
  },
];

@Injectable()
export class CurriculumService {
  resolve(message: string): CurriculumContext {
    const normalized = message.toLowerCase();
    const scored = CURRICULUM_SKILLS.map((skill) => ({
      skill,
      score: skill.keywords.filter((keyword) => normalized.includes(keyword)).length,
    }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score);
    const selected = scored[0]?.skill ?? CURRICULUM_SKILLS[0];
    const score = scored[0]?.score ?? 0;

    return {
      topicId: selected.topicId,
      topicTitle: selected.topicTitle,
      skillId: selected.skillId,
      skillTitle: selected.skillTitle,
      taskTypeId: selected.taskTypeId,
      taskTypeTitle: selected.taskTypeTitle,
      verifierKind: selected.verifierKind,
      confidence: score >= 2 ? 'high' : score === 1 ? 'medium' : 'low',
    };
  }

  getSupportedPracticeContext(message: string): CurriculumContext {
    const resolved = this.resolve(message);
    if (resolved.verifierKind === 'linear_equation_numeric') {
      return resolved;
    }
    const fallback = CURRICULUM_SKILLS[0];
    return {
      topicId: fallback.topicId,
      topicTitle: fallback.topicTitle,
      skillId: fallback.skillId,
      skillTitle: fallback.skillTitle,
      taskTypeId: fallback.taskTypeId,
      taskTypeTitle: fallback.taskTypeTitle,
      verifierKind: fallback.verifierKind,
      confidence: 'low',
    };
  }
}
