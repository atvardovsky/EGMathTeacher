import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import type { LessonType, TutorAnswer, TutorTask } from '../tutor/tutor.types';
import {
  CurriculumContext,
  LessonTaskEvidence,
  LessonVerifierEvidence,
  LessonVerifierResult,
} from './lesson.types';

interface LessonTaskRecord {
  id: string;
  user_id: string;
  lesson_session_id: string;
  conversation_id: string;
  lesson_type: LessonType;
  topic_id: string;
  skill_id: string;
  task_type_id: string;
  prompt: string;
  expected_answer: string;
  verifier_kind: string;
  status: LessonTaskEvidence['status'];
  created_at: string;
  updated_at: string;
}

interface VerifyInput {
  userId: string;
  lessonSessionId: string;
  conversationId: string;
  message: string;
}

interface EnsureTaskInput {
  userId: string;
  lessonSessionId: string;
  conversationId: string;
  lessonType: LessonType;
  curriculum: CurriculumContext;
  answer: TutorAnswer;
}

const EMPTY_VERIFIER_EVIDENCE: LessonVerifierEvidence = {
  attemptSubmitted: false,
  result: 'none',
  confidence: 'unknown',
  masteryUpdateAllowed: false,
};

@Injectable()
export class MathVerifierService {
  constructor(private readonly db: DatabaseService) {}

  verifyPendingTaskAttempt(input: VerifyInput): LessonVerifierEvidence {
    const task = this.getLatestPendingTask(input.userId, input.lessonSessionId);
    if (!task) {
      return EMPTY_VERIFIER_EVIDENCE;
    }

    const submittedAnswer = this.extractNumericAnswer(input.message);
    if (!submittedAnswer) {
      return EMPTY_VERIFIER_EVIDENCE;
    }

    const expected = this.normalizeNumber(task.expected_answer);
    const actual = this.normalizeNumber(submittedAnswer);
    const result = this.verifyNumber(actual, expected);
    const now = new Date().toISOString();
    const attemptId = randomUUID();
    const masteryUpdateAllowed = result === 'correct' || result === 'equivalent';
    const errorCode = this.errorCodeFor(result, actual, expected);

    this.db.run(
      `INSERT INTO student_attempts (
         id, task_id, user_id, lesson_session_id, conversation_id,
         answer_text, verifier_result, expected_answer, error_code,
         confidence, mastery_update_allowed, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attemptId,
        task.id,
        input.userId,
        input.lessonSessionId,
        input.conversationId,
        input.message.slice(0, 1_000),
        result,
        task.expected_answer,
        errorCode ?? null,
        'high',
        masteryUpdateAllowed ? 1 : 0,
        now,
      ],
    );

    this.db.run(
      `UPDATE lesson_tasks
       SET status = ?, updated_at = ?
       WHERE id = ?`,
      [masteryUpdateAllowed ? 'verified_correct' : 'attempted', now, task.id],
    );

    if (masteryUpdateAllowed) {
      this.db.run(
        `INSERT INTO mastery_evidence (
           id, user_id, lesson_session_id, task_id, attempt_id,
           topic_id, skill_id, task_type_id, evidence_level,
           verifier_result, outcome, created_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          input.userId,
          input.lessonSessionId,
          task.id,
          attemptId,
          task.topic_id,
          task.skill_id,
          task.task_type_id,
          'deterministically_verified',
          result,
          'verified_learning_outcome',
          now,
        ],
      );

      this.persistSkillProgress(input, task, attemptId, now);
    }

    return {
      attemptSubmitted: true,
      taskId: task.id,
      attemptId,
      result,
      expectedAnswer: task.expected_answer,
      errorCode,
      confidence: 'high',
      masteryUpdateAllowed,
      topicId: task.topic_id,
      skillId: task.skill_id,
      taskTypeId: task.task_type_id,
    };
  }

  ensureBackendTask(input: EnsureTaskInput): LessonTaskEvidence | undefined {
    if (!this.shouldAttachBackendTask(input.lessonType, input.curriculum, input.answer)) {
      return undefined;
    }
    const existing = this.getLatestPendingTask(input.userId, input.lessonSessionId);
    if (existing) {
      return this.toTaskEvidence(existing);
    }

    const generated = this.generateTask(input.curriculum);
    const taskId = `task_${randomUUID()}`;
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO lesson_tasks (
         id, user_id, lesson_session_id, conversation_id, lesson_type,
         topic_id, skill_id, task_type_id, prompt, expected_answer,
         verifier_kind, source, status, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        taskId,
        input.userId,
        input.lessonSessionId,
        input.conversationId,
        input.lessonType,
        input.curriculum.topicId,
        input.curriculum.skillId,
        input.curriculum.taskTypeId,
        generated.prompt,
        generated.expectedAnswer,
        input.curriculum.verifierKind,
        'backend_generated',
        now,
        now,
      ],
    );

    this.attachTaskToAnswer(input.answer, generated.task);

    return {
      taskId,
      prompt: generated.prompt,
      topicId: input.curriculum.topicId,
      skillId: input.curriculum.skillId,
      taskTypeId: input.curriculum.taskTypeId,
      status: 'pending',
    };
  }

  private shouldAttachBackendTask(
    lessonType: LessonType,
    curriculum: CurriculumContext,
    answer: TutorAnswer,
  ): boolean {
    if (curriculum.verifierKind !== 'linear_equation_numeric') {
      return false;
    }
    if (answer.lessonLifecycle.shouldStop || answer.lessonLifecycle.goalStatus === 'reached') {
      return false;
    }
    if (answer.debug?.verifier.masteryUpdateAllowed) {
      return false;
    }
    if (lessonType === 'practice' || lessonType === 'mistake_review') {
      return true;
    }
    return answer.debug?.decision.recommendedNextAction === 'request_student_attempt';
  }

  private generateTask(curriculum: CurriculumContext): {
    task: TutorTask;
    prompt: string;
    expectedAnswer: string;
  } {
    const prompt = 'Реши уравнение: 2x + 3 = 15. В ответе напиши значение x.';
    return {
      task: {
        title: curriculum.taskTypeTitle,
        prompt,
        difficulty: 'base',
      },
      prompt,
      expectedAnswer: '6',
    };
  }

  private attachTaskToAnswer(answer: TutorAnswer, task: TutorTask): void {
    if (answer.tasks.some((existing) => existing.prompt === task.prompt)) {
      return;
    }
    answer.tasks.push(task);
    const nextIndex = answer.blocks.filter((block) => block.type === 'task').length + 1;
    answer.blocks.push({
      id: `task-${nextIndex}`,
      type: 'task',
      title: task.title,
      prompt: task.prompt,
      difficulty: task.difficulty,
    });
  }

  private getLatestPendingTask(
    userId: string,
    lessonSessionId: string,
  ): LessonTaskRecord | undefined {
    return this.db.get<LessonTaskRecord>(
      `SELECT id, user_id, lesson_session_id, conversation_id, lesson_type,
              topic_id, skill_id, task_type_id, prompt, expected_answer,
              verifier_kind, status, created_at, updated_at
       FROM lesson_tasks
       WHERE user_id = ?
         AND lesson_session_id = ?
         AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, lessonSessionId],
    );
  }

  private toTaskEvidence(task: LessonTaskRecord): LessonTaskEvidence {
    return {
      taskId: task.id,
      prompt: task.prompt,
      topicId: task.topic_id,
      skillId: task.skill_id,
      taskTypeId: task.task_type_id,
      status: task.status,
    };
  }

  private extractNumericAnswer(message: string): string | undefined {
    const normalized = message.trim().replace(',', '.');
    const explicit = normalized.match(/(?:x|х)\s*=\s*(-?\d+(?:\.\d+)?)/i);
    if (explicit?.[1]) {
      return explicit[1];
    }
    const answer = normalized.match(/(?:ответ|answer)\s*:?\s*(-?\d+(?:\.\d+)?)/i);
    if (answer?.[1]) {
      return answer[1];
    }
    if (/^-?\d+(?:\.\d+)?$/.test(normalized)) {
      return normalized;
    }
    return undefined;
  }

  private normalizeNumber(value: string): number | undefined {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private verifyNumber(
    actual: number | undefined,
    expected: number | undefined,
  ): LessonVerifierResult {
    if (actual === undefined || expected === undefined) {
      return 'invalid_format';
    }
    return Math.abs(actual - expected) < 1e-9 ? 'correct' : 'incorrect';
  }

  private errorCodeFor(
    result: LessonVerifierResult,
    actual: number | undefined,
    expected: number | undefined,
  ): string | undefined {
    if (result === 'correct' || result === 'equivalent') {
      return undefined;
    }
    if (result === 'invalid_format') {
      return 'answer_format_not_numeric';
    }
    if (actual !== undefined && expected !== undefined) {
      return actual < expected ? 'answer_too_small' : 'answer_too_large';
    }
    return 'cannot_classify';
  }

  private persistSkillProgress(
    input: VerifyInput,
    task: LessonTaskRecord,
    attemptId: string,
    now: string,
  ): void {
    this.db.run(
      `INSERT INTO student_skill_progress (
         id, user_id, conversation_id, lesson_type, topic, skill, direction,
         confidence, support_needed, independence, evidence_json, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, 'progress', 'high', 'none', 'high', ?, ?)`,
      [
        randomUUID(),
        input.userId,
        input.conversationId,
        task.lesson_type,
        task.topic_id,
        task.skill_id,
        JSON.stringify({
          source: 'deterministic_verifier',
          attemptId,
          taskId: task.id,
          verifierResult: 'correct',
        }),
        now,
      ],
    );
  }
}
