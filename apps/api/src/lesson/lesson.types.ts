import type { LessonType } from '../tutor/tutor.types';

export type LessonSessionStatus =
  | 'active'
  | 'soft_limit_reached'
  | 'hard_limit_reached'
  | 'goal_reached'
  | 'finished';

export type LessonGoalStatus =
  | 'in_progress'
  | 'reached'
  | 'blocked'
  | 'stopped_by_limit';

export type LessonLimitStatus = 'ok' | 'soft_limit' | 'hard_limit';

export interface LessonLimitState {
  status: LessonLimitStatus;
  softLimitSeconds: number;
  hardLimitSeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
}

export interface LessonStrategySignal {
  direction: 'progress' | 'regression' | 'stable' | 'unknown';
  summary: string;
  recommendedAdjustment: string;
}

export interface LessonLifecycleDto {
  lessonSessionId: string;
  conversationId: string;
  lessonType: LessonType;
  status: LessonSessionStatus;
  goalStatus: LessonGoalStatus;
  lessonGoal: string;
  successCriteria: string[];
  finishReason?: string;
  turnCount: number;
  activeLearningSeconds: number;
  dayActiveLearningSeconds: number;
  dailyLimit: LessonLimitState;
  continuousLimit: LessonLimitState;
  shouldSuggestBreak: boolean;
  shouldStop: boolean;
  strategySignal: LessonStrategySignal;
}

export interface LessonSessionRecord {
  id: string;
  user_id: string;
  conversation_id: string;
  lesson_type: LessonType;
  status: LessonSessionStatus;
  goal_status: LessonGoalStatus;
  goal_text: string;
  success_criteria_json: string;
  finish_reason: string | null;
  active_learning_seconds: number;
  turn_count: number;
  started_at: string;
  last_activity_at: string;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}
