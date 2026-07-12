import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import type { LessonType } from '../tutor/tutor.types';
import {
  LessonDecisionPolicyResult,
  LessonEvidenceLevel,
  LessonGoalStatus,
  LessonGoalStatusEvidence,
  LessonLifecycleDto,
  LessonLimitState,
  LessonLimitStatus,
  LessonSessionRecord,
  LessonSessionStatus,
  LessonStrategySignal,
} from './lesson.types';

interface BeginTurnInput {
  userId: string;
  conversationId: string;
  lessonType: LessonType;
  topicHint?: string;
}

interface CompleteTurnInput {
  userId: string;
  studentMessage: string;
  lifecycle: LessonLifecycleDto;
  goalStatus: LessonGoalStatus;
  finishReason?: string;
  decisionPolicy?: LessonDecisionPolicyResult;
  answerShape: {
    tasksCount: number;
    examplesCount: number;
    imageBlocksCount: number;
  };
}

const TERMINAL_STATUSES: LessonSessionStatus[] = [
  'hard_limit_reached',
  'goal_reached',
  'finished',
];

const LESSON_GOALS: Record<LessonType, { goal: string; criteria: string[] }> = {
  meeting: {
    goal: 'Понять стартовый учебный контекст ученика.',
    criteria: ['получены ответы о цели', 'понят текущий уровень', 'выбрана безопасная стратегия'],
  },
  tutor: {
    goal: 'Дать понятный разбор вопроса и проверить понимание.',
    criteria: ['объяснен главный шаг', 'ученик получил проверочный вопрос или мини-задачу'],
  },
  concept: {
    goal: 'Объяснить понятие через короткие смысловые шаги.',
    criteria: ['понятие объяснено простыми словами', 'есть пример', 'есть проверка понимания'],
  },
  practice: {
    goal: 'Потренировать навык и оценить самостоятельность.',
    criteria: ['дана задача подходящей сложности', 'видно, нужна ли подсказка'],
  },
  diagnostic: {
    goal: 'Мягко понять текущий уровень и пробелы.',
    criteria: ['получены диагностические ответы', 'названы следующие учебные шаги'],
  },
  exam_strategy: {
    goal: 'Показать экзаменационную стратегию решения.',
    criteria: ['объяснен формат задания', 'названы ловушки', 'дан тренировочный шаг'],
  },
  mistake_review: {
    goal: 'Найти причину ошибки и закрепить корректирующий шаг.',
    criteria: ['найден источник ошибки', 'показано исправление', 'дан похожий проверочный шаг'],
  },
  visual_explanation: {
    goal: 'Связать объяснение с полезной визуальной опорой.',
    criteria: ['текст понятен без картинки', 'визуальная опора действительно помогает'],
  },
  reflection: {
    goal: 'Понять, что помогает ученику, и скорректировать стратегию.',
    criteria: ['собран сигнал о темпе', 'есть следующий безопасный учебный шаг'],
  },
};

@Injectable()
export class LessonService {
  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  beginTurn(input: BeginTurnInput): LessonLifecycleDto {
    const now = new Date();
    const nowIso = now.toISOString();
    const session = this.getOrCreateSession(input, nowIso);
    const incrementSeconds = this.estimateActiveSeconds(
      session.last_activity_at,
      session.turn_count,
      now,
    );
    const activeLearningSeconds = session.active_learning_seconds + incrementSeconds;
    const dayActiveLearningSeconds =
      this.getTodayActiveSeconds(input.userId, session.id) + activeLearningSeconds;
    const dailyLimit = this.buildLimitState(
      dayActiveLearningSeconds,
      this.dailySoftLimitSeconds,
      this.dailyHardLimitSeconds,
    );
    const continuousLimit = this.buildLimitState(
      activeLearningSeconds,
      this.continuousSoftLimitSeconds,
      this.continuousHardLimitSeconds,
    );
    const hardLimitReached =
      dailyLimit.status === 'hard_limit' || continuousLimit.status === 'hard_limit';
    const softLimitReached =
      dailyLimit.status === 'soft_limit' || continuousLimit.status === 'soft_limit';
    const status: LessonSessionStatus = hardLimitReached
      ? 'hard_limit_reached'
      : softLimitReached
        ? 'soft_limit_reached'
        : 'active';
    const goalStatus: LessonGoalStatus = hardLimitReached
      ? 'stopped_by_limit'
      : session.goal_status === 'reached'
        ? 'reached'
        : session.goal_status === 'blocked'
          ? 'blocked'
          : 'in_progress';
    const finishReason = hardLimitReached
      ? this.limitFinishReason(dailyLimit, continuousLimit)
      : session.finish_reason ?? undefined;

    this.db.run(
      `UPDATE lesson_sessions
       SET status = ?, goal_status = ?, finish_reason = ?, active_learning_seconds = ?,
           turn_count = turn_count + 1, last_activity_at = ?, finished_at = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        status,
        goalStatus,
        finishReason ?? null,
        activeLearningSeconds,
        nowIso,
        hardLimitReached ? nowIso : session.finished_at,
        nowIso,
        session.id,
      ],
    );

    const updatedSession: LessonSessionRecord = {
      ...session,
      status,
      goal_status: goalStatus,
      finish_reason: finishReason ?? null,
      active_learning_seconds: activeLearningSeconds,
      turn_count: session.turn_count + 1,
      last_activity_at: nowIso,
      finished_at: hardLimitReached ? nowIso : session.finished_at,
      updated_at: nowIso,
    };

    return this.toLifecycle(
      updatedSession,
      dayActiveLearningSeconds,
      dailyLimit,
      continuousLimit,
      input.topicHint,
    );
  }

  completeTurn(input: CompleteTurnInput): LessonLifecycleDto {
    const nowIso = new Date().toISOString();
    const requestedGoalStatus = this.normalizeGoalStatus(input.goalStatus);
    const hardStop = input.lifecycle.shouldStop || requestedGoalStatus === 'stopped_by_limit';
    const policyAcceptedGoalReached = Boolean(input.decisionPolicy?.goalCompletion.accepted);
    const policyBlockedGoal = Boolean(input.decisionPolicy?.goalBlocked);
    const modelSuggestedGoalReached = requestedGoalStatus === 'reached';
    const goalReached = policyAcceptedGoalReached && !hardStop;
    const pendingGoalSuggestion =
      (modelSuggestedGoalReached || Boolean(input.decisionPolicy?.goalCompletion.proposed)) &&
      !goalReached &&
      !hardStop;
    const status: LessonSessionStatus = hardStop
      ? 'hard_limit_reached'
      : goalReached
        ? 'goal_reached'
        : input.lifecycle.status === 'soft_limit_reached'
          ? 'soft_limit_reached'
          : 'active';
    const goalStatus: LessonGoalStatus = hardStop
      ? 'stopped_by_limit'
      : goalReached
        ? 'reached'
        : policyBlockedGoal || requestedGoalStatus === 'blocked'
          ? 'blocked'
          : 'in_progress';
    const goalStatusEvidence: LessonGoalStatusEvidence = hardStop
      ? 'learning_limit'
      : goalReached
        ? 'backend_observed'
        : pendingGoalSuggestion
          ? 'model_suggested_pending'
          : input.lifecycle.goalStatusEvidence;
    const goalEvidenceLevel: LessonEvidenceLevel = hardStop
      ? input.lifecycle.goalEvidenceLevel
      : goalReached
        ? (input.decisionPolicy?.goalCompletion.evidenceLevel ?? 'agent_interpreted')
        : pendingGoalSuggestion
          ? (input.decisionPolicy?.goalCompletion.evidenceLevel ??
            input.decisionPolicy?.evidenceLevel ??
            input.lifecycle.goalEvidenceLevel)
          : policyBlockedGoal
            ? (input.decisionPolicy?.evidenceLevel ?? input.lifecycle.goalEvidenceLevel)
          : (input.decisionPolicy?.evidenceLevel ?? input.lifecycle.goalEvidenceLevel);
    const finishReason =
      input.finishReason ||
      (goalReached
        ? 'lesson_goal_reached'
        : hardStop
          ? input.lifecycle.finishReason ?? 'learning_limit_reached'
          : policyBlockedGoal
            ? 'lesson_goal_blocked_by_backend_policy'
          : pendingGoalSuggestion
            ? 'model_suggested_goal_reached_pending_student_evidence'
            : undefined);
    const persistedFinishReason =
      goalReached || hardStop || policyBlockedGoal ? finishReason : input.lifecycle.finishReason;

    this.db.run(
      `UPDATE lesson_sessions
       SET status = ?, goal_status = ?, finish_reason = ?, finished_at = ?,
           updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [
        status,
        goalStatus,
        persistedFinishReason ?? null,
        goalReached || hardStop ? nowIso : null,
        nowIso,
        input.lifecycle.lessonSessionId,
        input.userId,
      ],
    );

    this.recordEffectivenessSignal(input, goalStatus, finishReason);

    return {
      ...input.lifecycle,
      status,
      goalStatus,
      goalStatusEvidence,
      goalEvidenceLevel,
      finishReason,
      shouldStop: hardStop || goalReached,
      shouldSuggestBreak:
        input.lifecycle.shouldSuggestBreak ||
        goalReached ||
        Boolean(input.decisionPolicy?.shouldSuggestBreak),
    };
  }

  private getOrCreateSession(input: BeginTurnInput, nowIso: string): LessonSessionRecord {
    const existing = this.db.get<LessonSessionRecord>(
      `SELECT id, user_id, conversation_id, lesson_type, status, goal_status, goal_text,
              success_criteria_json, finish_reason, active_learning_seconds, turn_count,
              started_at, last_activity_at, finished_at, created_at, updated_at
       FROM lesson_sessions
       WHERE user_id = ?
         AND conversation_id = ?
         AND lesson_type = ?
         AND status NOT IN (${TERMINAL_STATUSES.map(() => '?').join(', ')})
       ORDER BY created_at DESC
       LIMIT 1`,
      [input.userId, input.conversationId, input.lessonType, ...TERMINAL_STATUSES],
    );
    if (existing) {
      return existing;
    }

    const differentActiveSession = this.db.get<LessonSessionRecord>(
      `SELECT id, user_id, conversation_id, lesson_type, status, goal_status, goal_text,
              success_criteria_json, finish_reason, active_learning_seconds, turn_count,
              started_at, last_activity_at, finished_at, created_at, updated_at
       FROM lesson_sessions
       WHERE user_id = ?
         AND conversation_id = ?
         AND status NOT IN (${TERMINAL_STATUSES.map(() => '?').join(', ')})
       ORDER BY created_at DESC
       LIMIT 1`,
      [input.userId, input.conversationId, ...TERMINAL_STATUSES],
    );
    if (differentActiveSession && differentActiveSession.lesson_type !== input.lessonType) {
      this.finishSessionForLessonTypeChange(differentActiveSession, input.lessonType, nowIso);
    }

    const defaults = LESSON_GOALS[input.lessonType];
    const id = `lesson_${randomUUID()}`;
    this.db.run(
      `INSERT INTO lesson_sessions (
         id, user_id, conversation_id, lesson_type, status, goal_status, goal_text,
         success_criteria_json, active_learning_seconds, turn_count, started_at,
         last_activity_at, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, 'active', 'in_progress', ?, ?, 0, 0, ?, ?, ?, ?)`,
      [
        id,
        input.userId,
        input.conversationId,
        input.lessonType,
        defaults.goal,
        JSON.stringify(defaults.criteria),
        nowIso,
        nowIso,
        nowIso,
        nowIso,
      ],
    );

    return this.db.get<LessonSessionRecord>(
      `SELECT id, user_id, conversation_id, lesson_type, status, goal_status, goal_text,
              success_criteria_json, finish_reason, active_learning_seconds, turn_count,
              started_at, last_activity_at, finished_at, created_at, updated_at
       FROM lesson_sessions
       WHERE id = ?`,
      [id],
    )!;
  }

  private toLifecycle(
    session: LessonSessionRecord,
    dayActiveLearningSeconds: number,
    dailyLimit: LessonLimitState,
    continuousLimit: LessonLimitState,
    topicHint?: string,
  ): LessonLifecycleDto {
    const strategySignal = this.getStrategySignal(
      session.user_id,
      session.conversation_id,
      session.lesson_type,
      topicHint,
    );
    return {
      lessonSessionId: session.id,
      conversationId: session.conversation_id,
      lessonType: session.lesson_type,
      status: session.status,
      goalStatus: session.goal_status,
      goalStatusEvidence: this.getGoalStatusEvidence(session),
      goalEvidenceLevel: this.getLatestGoalEvidenceLevel(session.id),
      lessonGoal: session.goal_text,
      successCriteria: this.parseStringArray(session.success_criteria_json),
      finishReason: session.finish_reason ?? undefined,
      turnCount: session.turn_count,
      activeLearningSeconds: session.active_learning_seconds,
      dayActiveLearningSeconds,
      dailyLimit,
      continuousLimit,
      shouldSuggestBreak:
        dailyLimit.status !== 'ok' ||
        continuousLimit.status !== 'ok' ||
        session.goal_status === 'reached',
      shouldStop:
        dailyLimit.status === 'hard_limit' ||
        continuousLimit.status === 'hard_limit' ||
        session.status === 'hard_limit_reached',
      strategySignal,
    };
  }

  private getTodayActiveSeconds(userId: string, excludingSessionId: string): number {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const row = this.db.get<{ total: number | null }>(
      `SELECT SUM(active_learning_seconds) AS total
       FROM lesson_sessions
       WHERE user_id = ?
         AND id <> ?
         AND started_at >= ?`,
      [userId, excludingSessionId, start.toISOString()],
    );
    return this.normalizeSeconds(row?.total);
  }

  private estimateActiveSeconds(
    previousActivityIso: string,
    turnCount: number,
    now: Date,
  ): number {
    if (turnCount <= 0) {
      return 0;
    }
    const previous = new Date(previousActivityIso).getTime();
    if (!Number.isFinite(previous)) {
      return this.minTurnSeconds;
    }
    const elapsedSeconds = Math.floor((now.getTime() - previous) / 1000);
    if (elapsedSeconds <= 0) {
      return this.minTurnSeconds;
    }
    return Math.min(this.maxTurnGapSeconds, Math.max(this.minTurnSeconds, elapsedSeconds));
  }

  private buildLimitState(
    usedSeconds: number,
    softLimitSeconds: number,
    hardLimitSeconds: number,
  ): LessonLimitState {
    const status: LessonLimitStatus =
      usedSeconds >= hardLimitSeconds
        ? 'hard_limit'
        : usedSeconds >= softLimitSeconds
          ? 'soft_limit'
          : 'ok';
    return {
      status,
      softLimitSeconds,
      hardLimitSeconds,
      usedSeconds,
      remainingSeconds: Math.max(0, hardLimitSeconds - usedSeconds),
    };
  }

  private getStrategySignal(
    userId: string,
    conversationId: string,
    lessonType: LessonType,
    topicHint?: string,
  ): LessonStrategySignal {
    const rows = this.getScopedSkillProgressRows(userId, conversationId, lessonType, topicHint);
    if (rows.length === 0) {
      return {
        direction: 'unknown',
        summary: topicHint
          ? `Пока нет накопленных сигналов по текущей теме: ${topicHint}.`
          : 'Пока нет накопленных сигналов по текущему занятию.',
        recommendedAdjustment: 'Объясняй короткими шагами и собирай сигналы понимания.',
      };
    }

    const regression = rows.find((row) => row.direction === 'regression');
    if (regression) {
      return {
        direction: 'regression',
        summary: `${regression.topic}: ${regression.skill}`,
        recommendedAdjustment:
          'Смени стратегию объяснения: уменьши шаг, добавь пример или визуальную опору, проверь базовое понимание.',
      };
    }

    const progressCount = rows.filter((row) => row.direction === 'progress').length;
    if (progressCount >= 2) {
      return {
        direction: 'progress',
        summary: 'Есть несколько релевантных сигналов прогресса по текущему занятию.',
        recommendedAdjustment:
          'Дай ученику больше самостоятельности, но оставь короткую проверку понимания.',
      };
    }

    return {
      direction: 'stable',
      summary: 'Релевантные сигналы стабильны или неоднозначны.',
      recommendedAdjustment:
        'Продолжай текущую стратегию и собирай больше evidence через мини-задачи.',
    };
  }

  private getScopedSkillProgressRows(
    userId: string,
    conversationId: string,
    lessonType: LessonType,
    topicHint?: string,
  ): Array<{
    topic: string;
    skill: string;
    direction: LessonStrategySignal['direction'];
    support_needed: string;
    independence: string;
  }> {
    const topicPattern = topicHint ? `%${topicHint}%` : undefined;
    if (topicPattern) {
      return this.db.all<{
        topic: string;
        skill: string;
        direction: LessonStrategySignal['direction'];
        support_needed: string;
        independence: string;
      }>(
        `SELECT topic, skill, direction, support_needed, independence
         FROM student_skill_progress
         WHERE user_id = ?
           AND lesson_type = ?
           AND (
             conversation_id = ?
             OR topic LIKE ?
             OR skill LIKE ?
           )
         ORDER BY
           CASE WHEN conversation_id = ? THEN 0 ELSE 1 END,
           created_at DESC
         LIMIT 8`,
        [userId, lessonType, conversationId, topicPattern, topicPattern, conversationId],
      );
    }

    return this.db.all<{
      topic: string;
      skill: string;
      direction: LessonStrategySignal['direction'];
      support_needed: string;
      independence: string;
    }>(
      `SELECT topic, skill, direction, support_needed, independence
       FROM student_skill_progress
       WHERE user_id = ?
         AND conversation_id = ?
         AND lesson_type = ?
       ORDER BY created_at DESC
       LIMIT 8`,
      [userId, conversationId, lessonType],
    );
  }

  private getGoalStatusEvidence(session: LessonSessionRecord): LessonGoalStatusEvidence {
    if (session.goal_status === 'stopped_by_limit' || session.status === 'hard_limit_reached') {
      return 'learning_limit';
    }
    if (session.goal_status === 'reached' || session.status === 'goal_reached') {
      return 'backend_observed';
    }
    return 'none';
  }

  private getLatestGoalEvidenceLevel(lessonSessionId: string): LessonEvidenceLevel {
    const row = this.db.get<{ evidence_level: LessonEvidenceLevel }>(
      `SELECT evidence_level
       FROM lesson_decisions
       WHERE lesson_session_id = ?
         AND tool_name = 'propose_goal_completion'
         AND accepted = 1
       ORDER BY created_at DESC
       LIMIT 1`,
      [lessonSessionId],
    );
    return row?.evidence_level ?? 'none';
  }

  private finishSessionForLessonTypeChange(
    session: LessonSessionRecord,
    nextLessonType: LessonType,
    nowIso: string,
  ): void {
    this.db.run(
      `UPDATE lesson_sessions
       SET status = 'finished', finish_reason = ?, finished_at = ?, updated_at = ?
       WHERE id = ?`,
      [`lesson_type_changed_to_${nextLessonType}`, nowIso, nowIso, session.id],
    );
  }

  private recordEffectivenessSignal(
    input: CompleteTurnInput,
    goalStatus: LessonGoalStatus,
    finishReason: string | undefined,
  ): void {
    this.db.run(
      `INSERT INTO lesson_effectiveness_signals (
         id, user_id, lesson_session_id, conversation_id, lesson_type,
         goal_status, strategy_signal_json, answer_shape_json,
         recommended_adjustment, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        input.userId,
        input.lifecycle.lessonSessionId,
        input.lifecycle.conversationId,
        input.lifecycle.lessonType,
        goalStatus,
        JSON.stringify(input.lifecycle.strategySignal),
        JSON.stringify(input.answerShape),
        finishReason ?? input.lifecycle.strategySignal.recommendedAdjustment,
        new Date().toISOString(),
      ],
    );
  }

  private limitFinishReason(
    dailyLimit: LessonLimitState,
    continuousLimit: LessonLimitState,
  ): string {
    if (dailyLimit.status === 'hard_limit') {
      return 'daily_learning_limit_reached';
    }
    if (continuousLimit.status === 'hard_limit') {
      return 'continuous_learning_limit_reached';
    }
    return 'learning_limit_reached';
  }

  private normalizeGoalStatus(status: LessonGoalStatus): LessonGoalStatus {
    return ['in_progress', 'reached', 'blocked', 'stopped_by_limit'].includes(status)
      ? status
      : 'in_progress';
  }

  private parseStringArray(value: string): string[] {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : [];
    } catch {
      return [];
    }
  }

  private normalizeSeconds(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? Math.floor(value)
      : 0;
  }

  private get dailySoftLimitSeconds(): number {
    return this.minutesConfig('app.lessonDailySoftLimitMinutes', 90) * 60;
  }

  private get dailyHardLimitSeconds(): number {
    return this.minutesConfig('app.lessonDailyHardLimitMinutes', 120) * 60;
  }

  private get continuousSoftLimitSeconds(): number {
    return this.minutesConfig('app.lessonContinuousSoftLimitMinutes', 45) * 60;
  }

  private get continuousHardLimitSeconds(): number {
    return this.minutesConfig('app.lessonContinuousHardLimitMinutes', 60) * 60;
  }

  private get minTurnSeconds(): number {
    return this.secondsConfig('app.lessonMinTurnSeconds', 30);
  }

  private get maxTurnGapSeconds(): number {
    return this.secondsConfig('app.lessonMaxTurnGapSeconds', 900);
  }

  private minutesConfig(path: string, fallback: number): number {
    const value = this.configService.get<number>(path);
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private secondsConfig(path: string, fallback: number): number {
    const value = this.configService.get<number>(path);
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
