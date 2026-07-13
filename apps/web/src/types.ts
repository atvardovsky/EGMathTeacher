export type UserRole = 'admin' | 'student';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

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

export interface UsageTotals {
  estimatedCostUsd: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  imageCount: number;
  pricingConfigured: boolean;
}

export interface UsageLedgerItem {
  id: string;
  correlationId: string | null;
  lessonSessionId: string | null;
  conversationId: string | null;
  lessonType: LessonType | null;
  operationKey: string;
  operation: string;
  assistantRole: string;
  provider: string;
  model: string;
  responseFormat: 'json' | 'text' | 'image';
  serviceTier?: string;
  estimatedCostUsd: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  imageCount: number;
  pricingSource: string;
  createdAt: string;
}

export interface LessonDecisionUsageItem {
  id: string;
  correlationId: string | null;
  toolName: string;
  accepted: boolean;
  rejectionReason?: string;
  evidenceLevel: LessonEvidenceLevel | string;
  verifierResult?: LessonVerifierResult | string;
  latencyMs: number;
  fallbackUsed: boolean;
  lessonOutcome?: string;
  createdAt: string;
}

export interface LessonUsageSummary {
  lessonSessionId: string;
  conversationId: string | null;
  lessonType: LessonType | null;
  status: string | null;
  goalStatus: string | null;
  total: UsageTotals;
  items: UsageLedgerItem[];
  decisions: LessonDecisionUsageItem[];
  verifiedOutcomes: number;
  costPerVerifiedOutcomeUsd: number | null;
}

export interface UserUsageSummary {
  currency: 'USD';
  today: UsageTotals;
  currentLesson: LessonUsageSummary | null;
  recentLessons: LessonUsageSummary[];
}

export interface TutorUsageSnapshot {
  currency: 'USD';
  lesson: UsageTotals;
  today: UsageTotals;
}

export interface TutorDebugInfo {
  curriculum: {
    topicId: string;
    topicTitle: string;
    skillId: string;
    skillTitle: string;
    taskTypeId: string;
    taskTypeTitle: string;
  };
  decision: {
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
  };
  verifier: {
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
  };
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
  lessonType?: LessonType;
  lessonLifecycle: TutorLessonLifecycle;
  usage?: TutorUsageSnapshot;
  answer: string;
  blocks?: TutorResponseBlock[];
  tasks: TutorTask[];
  examples: TutorExample[];
  needsImage: boolean;
  imagePrompt?: string;
  citations: TutorCitation[];
  debug?: TutorDebugInfo;
}

export interface TutorTurn {
  id: string;
  prompt: string;
  lessonType: LessonType;
  source: 'text' | 'voice';
  answer?: TutorAnswer;
  imageUrls?: Record<string, string>;
  loadingImages?: Record<string, boolean>;
}

export interface DiagnosticAnswer {
  prompt: string;
  answer: string;
}

export interface StudentOnboardingAnswers {
  exam?: string;
  grade?: string;
  examYear?: string;
  targetScore?: number;
  currentLevel?: string;
  confidence?: string;
  mathFeeling?: string;
  motivation?: string;
  weakTopics: string[];
  explanationStyle?: string;
  pacing?: string;
  visualPreference?: boolean;
  hintPreference?: string;
  practicePreference?: string;
  feedbackStyle?: string;
  analogyInterests: string[];
  diagnosticAnswers: DiagnosticAnswer[];
  freeform?: string;
}

export interface StudentProfile {
  userId: string;
  onboardingCompletedAt: string;
  onboardingAnswers: StudentOnboardingAnswers;
  knowledgeState: Record<string, unknown>;
  learningPreferences: Record<string, unknown>;
  psychologicalProfile: Record<string, unknown>;
  explanationStrategy: Record<string, unknown>;
  recentSessionSummaries: StudentSessionSummary[];
  skillProgress: StudentSkillProgress[];
  aiSummary: string;
  createdAt: string;
  updatedAt: string;
}

export type SkillProgressDirection = 'progress' | 'regression' | 'stable' | 'unknown';

export interface StudentSessionSummary {
  id: string;
  conversationId: string | null;
  lessonType: LessonType;
  summary: Record<string, unknown>;
  evidenceLevels: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface StudentSkillProgress {
  id: string;
  conversationId: string | null;
  lessonType: LessonType;
  topic: string;
  skill: string;
  direction: SkillProgressDirection;
  confidence: 'low' | 'medium' | 'high' | 'unknown';
  supportNeeded: 'none' | 'hint' | 'step_by_step' | 'full_explanation' | 'unknown';
  independence: 'low' | 'medium' | 'high' | 'unknown';
  evidence: Record<string, unknown>;
  createdAt: string;
}

export interface StudentProfileStatus {
  onboardingRequired: boolean;
  profile: StudentProfile | null;
}

export interface KnowledgeFile {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  openaiFileId: string;
  vectorStoreId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeStatus {
  vectorStoreIds: string[];
  files: KnowledgeFile[];
}

export interface TutorImageResult {
  dataUrl: string;
  mimeType?: string;
  usage?: TutorUsageSnapshot;
}
