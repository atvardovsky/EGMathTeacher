import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { LessonType, TutorTask } from '../tutor/tutor.types';
import { CurriculumContext } from './lesson.types';

interface TaskBankRow {
  task_id: string;
  topic_id: string;
  skill_id: string;
  task_type_id: string;
  difficulty: string;
  prompt: string;
  expected_answer: string;
  hint_ladder_json: string;
  common_errors_json: string;
  verifier_kind: string;
}

export interface TaskBankSelection {
  sourceTaskId: string;
  prompt: string;
  expectedAnswer: string;
  hintLadder: string[];
  commonErrors: string[];
  task: TutorTask;
}

@Injectable()
export class TaskBankService {
  constructor(private readonly db: DatabaseService) {}

  selectTask(input: {
    userId: string;
    lessonType: LessonType;
    curriculum: CurriculumContext;
  }): TaskBankSelection | undefined {
    if (input.curriculum.verifierKind !== 'linear_equation_numeric') {
      return undefined;
    }
    const row = this.selectFreshTask(input) ?? this.selectReusableTask(input);
    if (!row) {
      return undefined;
    }
    const hintLadder = this.parseStringArray(row.hint_ladder_json);
    const commonErrors = this.parseStringArray(row.common_errors_json);
    return {
      sourceTaskId: row.task_id,
      prompt: row.prompt,
      expectedAnswer: row.expected_answer,
      hintLadder,
      commonErrors,
      task: {
        title: input.curriculum.taskTypeTitle,
        prompt: row.prompt,
        difficulty: this.toTutorDifficulty(row.difficulty),
        hintLadder,
      },
    };
  }

  private selectFreshTask(input: {
    userId: string;
    lessonType: LessonType;
    curriculum: CurriculumContext;
  }): TaskBankRow | undefined {
    return this.db.get<TaskBankRow>(
      `SELECT task_id, topic_id, skill_id, task_type_id, difficulty, prompt,
              expected_answer, hint_ladder_json, common_errors_json, verifier_kind
       FROM task_bank_tasks
       WHERE COALESCE(sync_status, 'active') = 'active'
         AND topic_id = ?
         AND skill_id = ?
         AND task_type_id = ?
         AND verifier_kind = ?
         AND NOT EXISTS (
           SELECT 1
           FROM lesson_tasks
           WHERE lesson_tasks.user_id = ?
             AND lesson_tasks.skill_id = task_bank_tasks.skill_id
             AND lesson_tasks.source_task_id = task_bank_tasks.task_id
         )
       ORDER BY
         CASE difficulty
           WHEN 'foundation' THEN 0
           WHEN 'base' THEN 1
           WHEN 'medium' THEN 2
           WHEN 'advanced' THEN 3
           ELSE 4
         END,
         task_id
       LIMIT 1`,
      [
        input.curriculum.topicId,
        input.curriculum.skillId,
        input.curriculum.taskTypeId,
        input.curriculum.verifierKind,
        input.userId,
      ],
    );
  }

  private selectReusableTask(input: {
    userId: string;
    lessonType: LessonType;
    curriculum: CurriculumContext;
  }): TaskBankRow | undefined {
    return this.db.get<TaskBankRow>(
      `SELECT task_id, topic_id, skill_id, task_type_id, difficulty, prompt,
              expected_answer, hint_ladder_json, common_errors_json, verifier_kind
       FROM task_bank_tasks
       LEFT JOIN (
         SELECT source_task_id, COUNT(*) AS use_count, MAX(created_at) AS last_used_at
         FROM lesson_tasks
         WHERE user_id = ?
           AND skill_id = ?
         GROUP BY source_task_id
       ) AS task_usage ON task_usage.source_task_id = task_bank_tasks.task_id
       WHERE COALESCE(sync_status, 'active') = 'active'
         AND topic_id = ?
         AND skill_id = ?
         AND task_type_id = ?
         AND verifier_kind = ?
       ORDER BY
         COALESCE(task_usage.use_count, 0),
         task_usage.last_used_at,
         CASE difficulty
           WHEN 'foundation' THEN 0
           WHEN 'base' THEN 1
           WHEN 'medium' THEN 2
           WHEN 'advanced' THEN 3
           ELSE 4
         END,
         task_id
       LIMIT 1`,
      [
        input.userId,
        input.curriculum.skillId,
        input.curriculum.topicId,
        input.curriculum.skillId,
        input.curriculum.taskTypeId,
        input.curriculum.verifierKind,
      ],
    );
  }

  private toTutorDifficulty(value: string): TutorTask['difficulty'] {
    if (value === 'medium' || value === 'advanced') {
      return value;
    }
    return 'base';
  }

  private parseStringArray(value: string): string[] {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed)
        ? parsed.map((item) => String(item)).filter((item) => item.trim().length > 0)
        : [];
    } catch {
      return [];
    }
  }
}
