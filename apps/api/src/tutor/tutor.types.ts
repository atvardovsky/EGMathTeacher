export interface TutorTask {
  title: string;
  prompt: string;
  difficulty?: string;
}

export interface TutorExample {
  title: string;
  explanation: string;
}

export interface TutorCitation {
  fileId: string;
  filename?: string;
  quote?: string;
}

export type LessonType =
  | 'meeting'
  | 'tutor'
  | 'concept'
  | 'practice'
  | 'diagnostic'
  | 'exam_strategy'
  | 'mistake_review'
  | 'visual_explanation'
  | 'reflection';

export interface LessonTypeConfig {
  type: LessonType;
  title: string;
  description: string;
  goal: string;
  responseBlocks: Array<'text' | 'example' | 'task' | 'image'>;
  usesRag: boolean;
  usesStudentProfile: boolean;
  updatesStudentProfile: boolean;
  backgroundAnalysis: boolean;
}

export type TutorImageStatus = 'suggested' | 'queued' | 'ready' | 'failed';

export type TutorImagePriority = 'optional' | 'important' | 'required';

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

export interface TutorLessonLifecycle {
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

export interface TutorUsageTotals {
  estimatedCostUsd: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  imageCount: number;
  pricingConfigured: boolean;
}

export interface TutorUsageSnapshot {
  currency: 'USD';
  lesson: TutorUsageTotals;
  today: TutorUsageTotals;
}

export interface TutorTextBlock {
  id: string;
  type: 'text';
  text: string;
}

export interface TutorTaskBlock extends TutorTask {
  id: string;
  type: 'task';
}

export interface TutorExampleBlock extends TutorExample {
  id: string;
  type: 'example';
}

export interface TutorImageBlock {
  id: string;
  type: 'image';
  status: TutorImageStatus;
  prompt: string;
  caption: string;
  altText: string;
  priority: TutorImagePriority;
  url?: string;
}

export type TutorResponseBlock =
  | TutorTextBlock
  | TutorTaskBlock
  | TutorExampleBlock
  | TutorImageBlock;

export interface TutorAnswer {
  conversationId: string;
  lessonType: LessonType;
  lessonLifecycle: TutorLessonLifecycle;
  usage?: TutorUsageSnapshot;
  answer: string;
  blocks: TutorResponseBlock[];
  tasks: TutorTask[];
  examples: TutorExample[];
  needsImage: boolean;
  imagePrompt?: string;
  citations: TutorCitation[];
}
