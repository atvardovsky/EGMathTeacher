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

export type LessonDecisionConfidence = 'low' | 'medium' | 'high' | 'unknown';

export type LessonVerifierResult =
  | 'none'
  | 'correct'
  | 'incorrect'
  | 'equivalent'
  | 'partially_correct'
  | 'invalid_format'
  | 'cannot_verify';

export type LessonDecisionActionName =
  | 'continue_lesson'
  | 'explain_concept'
  | 'give_example'
  | 'give_task'
  | 'request_student_attempt'
  | 'request_student_explanation'
  | 'check_student_answer'
  | 'give_hint'
  | 'change_explanation_strategy'
  | 'suggest_visual_support'
  | 'propose_goal_completion'
  | 'mark_goal_blocked'
  | 'suggest_break'
  | 'finish_lesson'
  | 'record_learning_observation'
  | 'propose_profile_delta';

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

export interface LessonDecisionAction {
  name: LessonDecisionActionName;
  arguments?: Record<string, unknown>;
  reason?: string;
  expectedEvidence?: LessonEvidenceLevel;
  confidence?: LessonDecisionConfidence;
}

export interface LessonDecision {
  id: string;
  actions: LessonDecisionAction[];
  evidenceLevel: LessonEvidenceLevel;
  confidence: LessonDecisionConfidence;
  reason: string;
  fallback?: boolean;
  verifierResult?: LessonVerifierResult;
}

export interface LessonDecisionActionPolicyResult {
  toolName: LessonDecisionActionName;
  accepted: boolean;
  reason: string;
  requiredAction?: LessonDecisionActionName;
  evidenceLevel: LessonEvidenceLevel;
}

export interface LessonDecisionPolicyResult {
  decisionId: string;
  evidenceLevel: LessonEvidenceLevel;
  actionResults: LessonDecisionActionPolicyResult[];
  acceptedActions: LessonDecisionActionName[];
  rejectedActions: LessonDecisionActionPolicyResult[];
  goalCompletion: {
    proposed: boolean;
    accepted: boolean;
    reason: string;
    requiredAction?: LessonDecisionActionName;
    evidenceLevel: LessonEvidenceLevel;
  };
  shouldSuggestBreak: boolean;
  goalBlocked: boolean;
  recommendedNextAction?: LessonDecisionActionName;
  verifierResult?: LessonVerifierResult;
}

export interface LessonDecisionResult {
  decision: LessonDecision;
  policy: LessonDecisionPolicyResult;
  debug: LessonDecisionDebug;
}

export interface LessonDecisionDebug {
  decisionId: string;
  acceptedActions: LessonDecisionActionName[];
  rejectedActions: LessonDecisionActionPolicyResult[];
  evidenceLevel: LessonEvidenceLevel;
  verifierResult: LessonVerifierResult;
  recommendedNextAction?: LessonDecisionActionName;
  goalCompletionAccepted: boolean;
  goalCompletionReason: string;
  latencyMs: number;
  fallbackUsed: boolean;
}

export interface CurriculumContext {
  topicId: string;
  topicTitle: string;
  skillId: string;
  skillTitle: string;
  taskTypeId: string;
  taskTypeTitle: string;
  verifierKind: 'linear_equation_numeric' | 'unsupported';
  confidence: 'low' | 'medium' | 'high';
}

export interface LessonTaskEvidence {
  taskId: string;
  prompt: string;
  topicId: string;
  skillId: string;
  taskTypeId: string;
  status: 'pending' | 'attempted' | 'verified_correct' | 'blocked';
  source?: 'backend_generated' | 'model_imported' | 'task_bank_imported';
  hintLadder?: string[];
}

export interface LessonVerifierEvidence {
  attemptSubmitted: boolean;
  taskId?: string;
  attemptId?: string;
  result: LessonVerifierResult;
  expectedAnswer?: string;
  errorCode?: string;
  confidence: 'low' | 'medium' | 'high' | 'unknown';
  masteryUpdateAllowed: boolean;
  masteryPolicyReason?: string;
  masteryEvidenceLevel?: LessonEvidenceLevel;
  verifiedSuccessCount?: number;
  independentSuccessCount?: number;
  requiredSuccessCount?: number;
  nextHint?: string;
  hintLadder?: string[];
  topicId?: string;
  skillId?: string;
  taskTypeId?: string;
}

export interface LessonLifecycleDto {
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
