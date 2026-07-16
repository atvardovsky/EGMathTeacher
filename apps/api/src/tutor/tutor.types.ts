export interface TutorTask {
  title: string;
  prompt: string;
  difficulty?: string;
  hintLadder?: string[];
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

export type LessonGoalStatusEvidence =
  | 'none'
  | 'model_suggested_pending'
  | 'backend_observed'
  | 'learning_limit';

export type LessonEvidenceLevel =
  | 'none'
  | 'self_reported'
  | 'agent_interpreted'
  | 'attempt_submitted'
  | 'deterministically_verified'
  | 'repeated_independent_success';

export type LessonLimitStatus = 'ok' | 'soft_limit' | 'hard_limit';

export type LessonVerifierResult =
  | 'none'
  | 'correct'
  | 'incorrect'
  | 'equivalent'
  | 'partially_correct'
  | 'invalid_format'
  | 'cannot_verify';

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
  goalStatusEvidence: LessonGoalStatusEvidence;
  goalEvidenceLevel: LessonEvidenceLevel;
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

export interface TutorDebugDecision {
  acceptedActions: string[];
  rejectedActions: Array<{
    toolName: string;
    reason: string;
    requiredAction?: string;
  }>;
  evidenceLevel: LessonEvidenceLevel;
  verifierResult: LessonVerifierResult;
  recommendedNextAction?: string;
  goalCompletionAccepted: boolean;
  goalCompletionReason: string;
  latencyMs: number;
  fallbackUsed: boolean;
}

export interface TutorDebugVerifier {
  attemptSubmitted: boolean;
  taskId?: string;
  attemptId?: string;
  sourceTaskId?: string;
  result: LessonVerifierResult;
  errorCode?: string;
  confidence: 'low' | 'medium' | 'high' | 'unknown';
  masteryUpdateAllowed: boolean;
  masteryPolicyReason?: string;
  masteryEvidenceLevel?: LessonEvidenceLevel;
  currentLessonVerifiedSuccessCount?: number;
  currentLessonIndependentSuccessCount?: number;
  cumulativeVerifiedSuccessCount?: number;
  cumulativeIndependentSuccessCount?: number;
  verifiedSuccessCount?: number;
  independentSuccessCount?: number;
  requiredSuccessCount?: number;
  nextHint?: string;
  nextHintRoute?: string;
  misconceptionId?: string;
}

export interface TutorDebugCurriculum {
  topicId: string;
  topicTitle: string;
  skillId: string;
  skillTitle: string;
  taskTypeId: string;
  taskTypeTitle: string;
}

export interface TutorDebugInfo {
  curriculum: TutorDebugCurriculum;
  decision: TutorDebugDecision;
  verifier: TutorDebugVerifier;
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
  prompt?: string;
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
  turnId?: string;
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
  debug?: TutorDebugInfo;
}

export interface TutorLessonHistoryTurn {
  id: string;
  prompt: string;
  lessonType: LessonType;
  source: 'text' | 'voice';
  answer: TutorAnswer;
  createdAt: string;
}

export interface TutorLessonHistoryItem {
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
  startedAt: string;
  lastActivityAt: string;
  updatedAt: string;
  summary?: Record<string, unknown>;
  evidenceLevels?: Record<string, unknown>;
  turns: TutorLessonHistoryTurn[];
}

export interface TutorLessonHistory {
  lessons: TutorLessonHistoryItem[];
}
