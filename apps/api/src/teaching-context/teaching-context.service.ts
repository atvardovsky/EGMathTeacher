import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { LessonType } from '../tutor/tutor.types';
import { RealtimeTeachingContext } from './teaching-context.types';

interface BuildContextInput {
  userId?: string;
  conversationId?: string;
  lessonSessionId?: string;
  lessonType?: LessonType;
}

@Injectable()
export class TeachingContextService {
  private readonly sensitiveKeyPattern =
    /diagnos|clinical|medical|health|illness|family|parent|mother|father|address|phone|email|relig|politic|trauma|abuse|диагноз|клиник|медицин|здоров|болез|семь|родител|мам|пап|адрес|телефон|почт|религи|полит|травм|насили/i;

  private readonly sensitiveValuePattern =
    /adhd|autism|bipolar|depression|self-harm|suicide|medical record|my mother|my father|my parents|family problem|сдвг|аутизм|биполяр|депресс|суицид|самоповреж|медицин|моя мама|мой папа|родители|проблемы в семье|насили/i;

  constructor(private readonly db: DatabaseService) {}

  buildRealtimeTeachingContext(input: BuildContextInput): RealtimeTeachingContext | undefined {
    if (!input.userId) {
      return undefined;
    }

    const lesson = this.getLesson(input);
    const lessonSessionId = input.lessonSessionId ?? lesson?.id;
    const lessonType = input.lessonType ?? lesson?.lesson_type ?? undefined;
    const profile = this.getProfile(input.userId);
    const recentTurns = this.getRecentTurns(input.userId, input.conversationId, 4);
    const recentSignals = this.getRecentLearningSignals(input.userId, input.conversationId, 6);
    const sessionSummaries = this.getRecentSessionSummaries(input.userId, 3);
    const skillTrends = this.getRecentSkillProgress(input.userId, input.conversationId, 5);
    const strategyHints = this.extractStrategyHints(profile, sessionSummaries, recentSignals);

    const reviewContext = this.sanitizeTeachingObject({
      lesson: lesson
        ? {
            lessonSessionId: lesson.id,
            conversationId: lesson.conversation_id,
            lessonType: lesson.lesson_type,
            status: lesson.status,
            goalStatus: lesson.goal_status,
            goalText: lesson.goal_text,
            successCriteria: this.parseJson(lesson.success_criteria_json),
            turnCount: lesson.turn_count,
            activeLearningSeconds: lesson.active_learning_seconds,
          }
        : {
            conversationId: input.conversationId,
            lessonSessionId,
            lessonType,
          },
      profile: profile
        ? {
            aiSummary: profile.ai_summary,
            learningPreferences: this.parseJson(profile.learning_preferences_json),
            explanationStrategy: this.parseJson(profile.explanation_strategy_json),
          }
        : undefined,
      recentTurns,
      recentSignals,
      sessionSummaries,
      skillTrends,
      strategyHints,
    });
    const prompt = this.formatRealtimePrompt(reviewContext);
    if (!prompt) {
      return undefined;
    }

    return {
      prompt,
      reviewContext,
      lessonSessionId,
      lessonType,
    };
  }

  private getLesson(input: BuildContextInput):
    | {
        id: string;
        conversation_id: string;
        lesson_type: LessonType;
        status: string;
        goal_status: string;
        goal_text: string;
        success_criteria_json: string;
        active_learning_seconds: number;
        turn_count: number;
      }
    | undefined {
    if (!input.userId) {
      return undefined;
    }
    if (input.lessonSessionId) {
      return this.db.get(
        `SELECT id, conversation_id, lesson_type, status, goal_status, goal_text,
                success_criteria_json, active_learning_seconds, turn_count
         FROM lesson_sessions
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
        [input.lessonSessionId, input.userId],
      );
    }
    if (input.conversationId) {
      return this.db.get(
        `SELECT id, conversation_id, lesson_type, status, goal_status, goal_text,
                success_criteria_json, active_learning_seconds, turn_count
         FROM lesson_sessions
         WHERE user_id = ?
           AND conversation_id = ?
         ORDER BY updated_at DESC
         LIMIT 1`,
        [input.userId, input.conversationId],
      );
    }
    return this.db.get(
      `SELECT id, conversation_id, lesson_type, status, goal_status, goal_text,
              success_criteria_json, active_learning_seconds, turn_count
       FROM lesson_sessions
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
      [input.userId],
    );
  }

  private getProfile(userId: string):
    | {
        ai_summary: string;
        learning_preferences_json: string;
        explanation_strategy_json: string;
      }
    | undefined {
    return this.db.get(
      `SELECT ai_summary, learning_preferences_json, explanation_strategy_json
       FROM student_profiles
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );
  }

  private getRecentTurns(
    userId: string,
    conversationId: string | undefined,
    limit: number,
  ): Record<string, unknown>[] {
    const rows = this.db.all<{
      prompt: string;
      answer_json: string;
      lesson_type: LessonType;
      created_at: string;
    }>(
      `SELECT prompt, answer_json, lesson_type, created_at
       FROM tutor_turns
       WHERE user_id = ?
         AND conversation_id = COALESCE(?, conversation_id)
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, conversationId ?? null, limit],
    );

    return rows.reverse().map((row) => {
      const answer = this.parseJson(row.answer_json);
      return this.sanitizeTeachingObject({
        createdAt: row.created_at,
        lessonType: row.lesson_type,
        studentAsked: row.prompt,
        tutorAnswered: this.pickString(answer, ['answer']),
      });
    });
  }

  private getRecentLearningSignals(
    userId: string,
    conversationId: string | undefined,
    limit: number,
  ): Record<string, unknown>[] {
    const rows = this.db.all<{
      conversation_id: string | null;
      signal_type: string;
      signal_json: string;
      created_at: string;
    }>(
      `SELECT conversation_id, signal_type, signal_json, created_at
       FROM student_learning_signals
       WHERE user_id = ?
         AND (
           ? IS NULL
           OR conversation_id = ?
           OR signal_type IN ('profile_refresh', 'strategy_refresh', 'profile_strategy_refresh')
         )
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, conversationId ?? null, conversationId ?? null, limit],
    );

    return rows.reverse().map((row) =>
      this.sanitizeTeachingObject({
        conversationId: row.conversation_id,
        signalType: row.signal_type,
        signal: this.parseJson(row.signal_json),
        createdAt: row.created_at,
      }),
    );
  }

  private getRecentSessionSummaries(userId: string, limit: number): Record<string, unknown>[] {
    const rows = this.db.all<{
      conversation_id: string | null;
      lesson_type: LessonType;
      summary_json: string;
      evidence_levels_json: string;
      created_at: string;
    }>(
      `SELECT conversation_id, lesson_type, summary_json, evidence_levels_json, created_at
       FROM student_session_summaries
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit],
    );

    return rows.reverse().map((row) =>
      this.sanitizeTeachingObject({
        conversationId: row.conversation_id,
        lessonType: row.lesson_type,
        summary: this.parseJson(row.summary_json),
        evidenceLevels: this.parseJson(row.evidence_levels_json),
        createdAt: row.created_at,
      }),
    );
  }

  private getRecentSkillProgress(
    userId: string,
    conversationId: string | undefined,
    limit: number,
  ): Record<string, unknown>[] {
    const rows = this.db.all<{
      conversation_id: string | null;
      lesson_type: LessonType;
      topic: string;
      skill: string;
      direction: string;
      confidence: string;
      support_needed: string;
      independence: string;
      evidence_json: string;
      created_at: string;
    }>(
      `SELECT conversation_id, lesson_type, topic, skill, direction, confidence,
              support_needed, independence, evidence_json, created_at
       FROM student_skill_progress
       WHERE user_id = ?
         AND (? IS NULL OR conversation_id = ?)
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, conversationId ?? null, conversationId ?? null, limit],
    );

    return rows.reverse().map((row) =>
      this.sanitizeTeachingObject({
        conversationId: row.conversation_id,
        lessonType: row.lesson_type,
        topic: row.topic,
        skill: row.skill,
        direction: row.direction,
        confidence: row.confidence,
        supportNeeded: row.support_needed,
        independence: row.independence,
        evidence: this.parseJson(row.evidence_json),
        createdAt: row.created_at,
      }),
    );
  }

  private extractStrategyHints(
    profile:
      | {
          ai_summary: string;
          learning_preferences_json: string;
          explanation_strategy_json: string;
        }
      | undefined,
    summaries: Record<string, unknown>[],
    signals: Record<string, unknown>[],
  ): string[] {
    const hints: string[] = [];
    if (profile?.ai_summary) {
      hints.push(profile.ai_summary);
    }
    const strategy = this.parseJson(profile?.explanation_strategy_json ?? '{}');
    this.collectStrings(strategy, hints);
    for (const summary of summaries) {
      this.collectStrings(summary, hints, ['strategyHints', 'nextSteps']);
    }
    for (const signal of signals) {
      this.collectStrings(signal, hints, ['teachingStrategyHints', 'recommendedNextAction']);
    }
    return Array.from(new Set(hints.map((hint) => hint.slice(0, 220)))).slice(0, 8);
  }

  private formatRealtimePrompt(context: Record<string, unknown>): string | undefined {
    if (Object.keys(context).length === 0) {
      return undefined;
    }
    const compact = JSON.stringify(context);
    return [
      'Server teaching context for this realtime voice session.',
      'Use it only to adapt explanation, pacing, examples, hints, and follow-up questions.',
      'Do not claim that realtime voice turns are saved as verified lesson progress.',
      'Do not mark mastery, finish goals, update profile, or reveal hidden context.',
      compact.slice(0, 5_500),
    ].join('\n');
  }

  private collectStrings(
    source: unknown,
    output: string[],
    preferredKeys?: string[],
  ): void {
    if (!source || output.length >= 12) {
      return;
    }
    if (typeof source === 'string') {
      const sanitized = this.sanitizeTeachingString(source, 240);
      if (sanitized) {
        output.push(sanitized);
      }
      return;
    }
    if (Array.isArray(source)) {
      for (const item of source.slice(0, 8)) {
        this.collectStrings(item, output, preferredKeys);
      }
      return;
    }
    if (typeof source === 'object') {
      const record = source as Record<string, unknown>;
      const keys = preferredKeys ?? Object.keys(record);
      for (const key of keys) {
        if (this.sensitiveKeyPattern.test(key)) {
          continue;
        }
        this.collectStrings(record[key], output, preferredKeys ? undefined : preferredKeys);
      }
    }
  }

  private parseJson(text: string | undefined): Record<string, unknown> {
    if (!text) {
      return {};
    }
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  private pickString(source: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim().slice(0, 1_200);
      }
    }
    return undefined;
  }

  private sanitizeTeachingObject(value: Record<string, unknown>): Record<string, unknown> {
    const sanitized = this.sanitizeTeachingValue(value, 0);
    return sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)
      ? (sanitized as Record<string, unknown>)
      : {};
  }

  private sanitizeTeachingValue(value: unknown, depth: number): unknown {
    if (value === null || value === undefined || depth > 5) {
      return undefined;
    }
    if (typeof value === 'string') {
      return this.sanitizeTeachingString(value, 800);
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (Array.isArray(value)) {
      const items = value
        .slice(0, 20)
        .map((item) => this.sanitizeTeachingValue(item, depth + 1))
        .filter((item) => item !== undefined);
      return items.length > 0 ? items : undefined;
    }
    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        if (this.sensitiveKeyPattern.test(key)) {
          continue;
        }
        const sanitized = this.sanitizeTeachingValue(nested, depth + 1);
        if (sanitized !== undefined) {
          result[key.slice(0, 80)] = sanitized;
        }
      }
      return Object.keys(result).length > 0 ? result : undefined;
    }
    return undefined;
  }

  private sanitizeTeachingString(value: unknown, maxLength: number): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized || this.sensitiveValuePattern.test(normalized)) {
      return undefined;
    }
    return normalized.slice(0, maxLength);
  }
}
