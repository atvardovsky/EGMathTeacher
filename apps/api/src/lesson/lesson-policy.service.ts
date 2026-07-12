import { Injectable } from '@nestjs/common';
import type { LessonType } from '../tutor/tutor.types';
import {
  LessonDecision,
  LessonDecisionAction,
  LessonDecisionActionName,
  LessonDecisionActionPolicyResult,
  LessonDecisionPolicyResult,
  LessonEvidenceLevel,
  LessonVerifierEvidence,
  LessonLifecycleDto,
} from './lesson.types';

interface EvaluateDecisionInput {
  lessonType: LessonType;
  lifecycle: LessonLifecycleDto;
  decision: LessonDecision;
  verifierEvidence?: LessonVerifierEvidence;
}

const EVIDENCE_RANK: Record<LessonEvidenceLevel, number> = {
  none: 0,
  self_reported: 1,
  agent_interpreted: 2,
  attempt_submitted: 3,
  deterministically_verified: 4,
  repeated_independent_success: 5,
};

const COMPLETION_THRESHOLDS: Record<
  LessonType,
  {
    minimum: LessonEvidenceLevel;
    requiresVerifier: boolean;
    requiresAttempt: boolean;
    requiredAction: LessonDecisionActionName;
  }
> = {
  meeting: {
    minimum: 'agent_interpreted',
    requiresVerifier: false,
    requiresAttempt: false,
    requiredAction: 'request_student_explanation',
  },
  tutor: {
    minimum: 'attempt_submitted',
    requiresVerifier: false,
    requiresAttempt: true,
    requiredAction: 'request_student_attempt',
  },
  concept: {
    minimum: 'attempt_submitted',
    requiresVerifier: false,
    requiresAttempt: true,
    requiredAction: 'request_student_attempt',
  },
  practice: {
    minimum: 'deterministically_verified',
    requiresVerifier: true,
    requiresAttempt: true,
    requiredAction: 'check_student_answer',
  },
  diagnostic: {
    minimum: 'agent_interpreted',
    requiresVerifier: false,
    requiresAttempt: false,
    requiredAction: 'request_student_attempt',
  },
  exam_strategy: {
    minimum: 'attempt_submitted',
    requiresVerifier: false,
    requiresAttempt: true,
    requiredAction: 'request_student_attempt',
  },
  mistake_review: {
    minimum: 'deterministically_verified',
    requiresVerifier: true,
    requiresAttempt: true,
    requiredAction: 'check_student_answer',
  },
  visual_explanation: {
    minimum: 'attempt_submitted',
    requiresVerifier: false,
    requiresAttempt: true,
    requiredAction: 'request_student_attempt',
  },
  reflection: {
    minimum: 'agent_interpreted',
    requiresVerifier: false,
    requiresAttempt: false,
    requiredAction: 'request_student_explanation',
  },
};

@Injectable()
export class LessonPolicyService {
  evaluateDecision(input: EvaluateDecisionInput): LessonDecisionPolicyResult {
    const actionResults = input.decision.actions.map((action) =>
      this.evaluateAction(action, input),
    );
    const goalCompletion = this.evaluateGoalCompletion(input);
    const acceptedActions = actionResults
      .filter((result) => result.accepted)
      .map((result) => result.toolName);
    const rejectedActions = actionResults.filter((result) => !result.accepted);

    return {
      decisionId: input.decision.id,
      evidenceLevel: input.decision.evidenceLevel,
      actionResults,
      acceptedActions,
      rejectedActions,
      goalCompletion,
      shouldSuggestBreak: actionResults.some(
        (result) => result.accepted && result.toolName === 'suggest_break',
      ),
      goalBlocked: actionResults.some(
        (result) => result.accepted && result.toolName === 'mark_goal_blocked',
      ),
      recommendedNextAction: this.pickRecommendedNextAction(actionResults),
      verifierResult: input.decision.verifierResult,
    };
  }

  private evaluateAction(
    action: LessonDecisionAction,
    input: EvaluateDecisionInput,
  ): LessonDecisionActionPolicyResult {
    switch (action.name) {
      case 'propose_goal_completion':
        return {
          toolName: action.name,
          accepted: this.evaluateGoalCompletion(input).accepted,
          reason: this.evaluateGoalCompletion(input).reason,
          requiredAction: this.evaluateGoalCompletion(input).requiredAction,
          evidenceLevel: input.decision.evidenceLevel,
        };
      case 'finish_lesson':
        return {
          toolName: action.name,
          accepted: false,
          reason:
            'The agent cannot finish a lesson directly; backend policy must accept a goal-completion proposal or enforce a hard limit.',
          requiredAction: 'propose_goal_completion',
          evidenceLevel: input.decision.evidenceLevel,
        };
      case 'propose_profile_delta':
        return {
          toolName: action.name,
          accepted: false,
          reason:
            'Profile changes are not applied from the immediate decision path; they must pass background evidence aggregation and profile filtering.',
          requiredAction: 'record_learning_observation',
          evidenceLevel: input.decision.evidenceLevel,
        };
      case 'mark_goal_blocked':
        return {
          toolName: action.name,
          accepted: input.lifecycle.turnCount >= 2 && input.decision.confidence !== 'low',
          reason:
            input.lifecycle.turnCount >= 2 && input.decision.confidence !== 'low'
              ? 'Goal blockage can be recorded after repeated evidence in the current lesson.'
              : 'Goal blockage needs more lesson evidence or higher decision confidence.',
          requiredAction:
            input.lifecycle.turnCount >= 2 && input.decision.confidence !== 'low'
              ? undefined
              : 'continue_lesson',
          evidenceLevel: input.decision.evidenceLevel,
        };
      default:
        return {
          toolName: action.name,
          accepted: true,
          reason: 'Teaching action is allowed; durable state changes remain backend-controlled.',
          evidenceLevel: input.decision.evidenceLevel,
        };
    }
  }

  private evaluateGoalCompletion(input: EvaluateDecisionInput): LessonDecisionPolicyResult['goalCompletion'] {
    const proposed = input.decision.actions.some((action) => action.name === 'propose_goal_completion');
    const threshold = COMPLETION_THRESHOLDS[input.lessonType];
    if (!proposed) {
      return {
        proposed: false,
        accepted: false,
        reason: 'No goal-completion action was proposed.',
        evidenceLevel: input.decision.evidenceLevel,
      };
    }
    if (input.lifecycle.turnCount < 2) {
      return {
        proposed,
        accepted: false,
        reason: 'Goal completion needs at least two lesson turns.',
        requiredAction: threshold.requiredAction,
        evidenceLevel: input.decision.evidenceLevel,
      };
    }
    if (!this.hasMinimumEvidence(input.decision.evidenceLevel, threshold.minimum)) {
      return {
        proposed,
        accepted: false,
        reason: `Goal completion for ${input.lessonType} requires ${threshold.minimum} evidence or stronger.`,
        requiredAction: threshold.requiredAction,
        evidenceLevel: input.decision.evidenceLevel,
      };
    }
    if (threshold.requiresAttempt && !input.verifierEvidence?.attemptSubmitted) {
      return {
        proposed,
        accepted: false,
        reason: `Goal completion for ${input.lessonType} requires a backend-observed student attempt.`,
        requiredAction: threshold.requiredAction,
        evidenceLevel: input.decision.evidenceLevel,
      };
    }
    if (
      threshold.requiresVerifier &&
      !this.hasBackendVerifierEvidence(input.decision, input.verifierEvidence)
    ) {
      return {
        proposed,
        accepted: false,
        reason: `Goal completion for ${input.lessonType} requires backend verifier evidence.`,
        requiredAction: threshold.requiredAction,
        evidenceLevel: input.decision.evidenceLevel,
      };
    }

    return {
      proposed,
      accepted: true,
      reason: 'Backend policy accepted goal completion for this lesson type.',
      evidenceLevel: input.decision.evidenceLevel,
    };
  }

  private hasMinimumEvidence(value: LessonEvidenceLevel, minimum: LessonEvidenceLevel): boolean {
    return EVIDENCE_RANK[value] >= EVIDENCE_RANK[minimum];
  }

  private hasBackendVerifierEvidence(
    decision: LessonDecision,
    verifierEvidence: LessonVerifierEvidence | undefined,
  ): boolean {
    if (!verifierEvidence?.masteryUpdateAllowed) {
      return false;
    }
    if (
      decision.evidenceLevel !== 'deterministically_verified' &&
      decision.evidenceLevel !== 'repeated_independent_success'
    ) {
      return false;
    }
    const verifierResult = decision.verifierResult?.toLowerCase();
    if (verifierResult !== 'correct' && verifierResult !== 'equivalent') {
      return false;
    }
    return decision.actions.some((action) => {
      if (action.name !== 'propose_goal_completion') {
        return false;
      }
      const source = this.pickString(action.arguments, 'verificationSource');
      return source === 'backend_verifier';
    });
  }

  private pickRecommendedNextAction(
    results: LessonDecisionActionPolicyResult[],
  ): LessonDecisionActionName | undefined {
    return results.find(
      (result) =>
        result.accepted &&
        result.toolName !== 'record_learning_observation' &&
        result.toolName !== 'propose_goal_completion',
    )?.toolName;
  }

  private pickString(source: Record<string, unknown> | undefined, key: string): string | undefined {
    const value = source?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
