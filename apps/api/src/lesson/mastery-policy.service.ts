import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { LessonEvidenceLevel, LessonVerifierResult } from './lesson.types';

interface CurriculumMasteryCriteriaRow {
  skill_id: string;
  required_evidence_sequence_json: string;
  self_report_can_complete: number;
  single_success_can_complete: number;
  minimum_criterion: string;
}

interface VerifiedAttemptCounts {
  attempt_count: number;
  verified_success_count: number;
  independent_success_count: number;
}

export interface MasteryPolicyInput {
  userId: string;
  lessonSessionId: string;
  skillId: string;
  verifierResult: LessonVerifierResult;
}

export interface MasteryPolicyResult {
  allowed: boolean;
  evidenceLevel: LessonEvidenceLevel;
  reason: string;
  requiredEvidenceSequence: string[];
  currentLessonVerifiedSuccessCount: number;
  currentLessonIndependentSuccessCount: number;
  cumulativeVerifiedSuccessCount: number;
  cumulativeIndependentSuccessCount: number;
  verifiedSuccessCount: number;
  independentSuccessCount: number;
  requiredIndependentSuccessCount: number;
  criteriaSource: 'curriculum_mastery_criteria' | 'fallback' | 'missing_required';
}

@Injectable()
export class MasteryPolicyService {
  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  evaluateVerifiedAttempt(input: MasteryPolicyInput): MasteryPolicyResult {
    const currentCounts = this.countVerifiedAttempts(input, 'current_lesson');
    const cumulativeCounts = this.countVerifiedAttempts(input, 'cumulative_skill');
    const criteria = this.getCriteria(input.skillId);
    if (!this.isSuccessfulVerifierResult(input.verifierResult)) {
      return this.result({
        allowed: false,
        evidenceLevel: currentCounts.attempt_count > 0 ? 'attempt_submitted' : 'none',
        reason: 'Verifier result is not a successful independent answer.',
        criteria,
        currentCounts,
        cumulativeCounts,
      });
    }

    if (!criteria) {
      if (this.isMasteryCriteriaRequired()) {
        return this.result({
          allowed: false,
          evidenceLevel: this.currentEvidenceLevel(currentCounts, cumulativeCounts),
          reason: 'Active mastery criteria are required for this supported verifier skill.',
          criteria,
          currentCounts,
          cumulativeCounts,
          criteriaSourceOverride: 'missing_required',
        });
      }
      return this.result({
        allowed: cumulativeCounts.verified_success_count >= 1,
        evidenceLevel: this.currentEvidenceLevel(currentCounts, cumulativeCounts),
        reason:
          cumulativeCounts.verified_success_count >= 1
            ? 'No imported mastery criteria were found; POC fallback accepts one verified success.'
            : 'No verified success is available yet.',
        criteria,
        currentCounts,
        cumulativeCounts,
        requiredIndependentSuccessCount: 1,
      });
    }

    const sequence = this.readEvidenceSequence(criteria);
    const requiresRepeated =
      sequence.includes('repeated_independent_success') ||
      criteria.single_success_can_complete !== 1;
    const requiredIndependentSuccessCount = requiresRepeated ? 2 : 1;
    const missing = this.missingEvidence(sequence, currentCounts, cumulativeCounts, requiredIndependentSuccessCount);
    if (missing.length > 0) {
      return this.result({
        allowed: false,
        evidenceLevel: this.currentEvidenceLevel(currentCounts, cumulativeCounts),
        reason: `Mastery criteria are not satisfied yet: missing ${missing.join(', ')}.`,
        criteria,
        currentCounts,
        cumulativeCounts,
        requiredIndependentSuccessCount,
      });
    }

    return this.result({
      allowed: true,
      evidenceLevel: this.currentEvidenceLevel(currentCounts, cumulativeCounts),
      reason: 'Imported mastery criteria are satisfied.',
      criteria,
      currentCounts,
      cumulativeCounts,
      requiredIndependentSuccessCount,
    });
  }

  private getCriteria(skillId: string): CurriculumMasteryCriteriaRow | undefined {
    return this.db.get<CurriculumMasteryCriteriaRow>(
      `SELECT skill_id, required_evidence_sequence_json, self_report_can_complete,
              single_success_can_complete, minimum_criterion
       FROM curriculum_mastery_criteria
       WHERE skill_id = ?
         AND COALESCE(sync_status, 'active') = 'active'
       LIMIT 1`,
      [skillId],
    );
  }

  private countVerifiedAttempts(
    input: MasteryPolicyInput,
    scope: 'current_lesson' | 'cumulative_skill',
  ): VerifiedAttemptCounts {
    const lessonPredicate =
      scope === 'current_lesson' ? 'AND student_attempts.lesson_session_id = ?' : '';
    const params =
      scope === 'current_lesson'
        ? [input.userId, input.lessonSessionId, input.skillId]
        : [input.userId, input.skillId];
    const counts = this.db.get<Partial<VerifiedAttemptCounts>>(
      `SELECT
           COUNT(student_attempts.id) AS attempt_count,
           SUM(
             CASE
               WHEN student_attempts.verifier_result IN ('correct', 'equivalent') THEN 1
               ELSE 0
             END
           ) AS verified_success_count,
           COUNT(
             DISTINCT CASE
               WHEN student_attempts.verifier_result IN ('correct', 'equivalent')
               THEN COALESCE(lesson_tasks.source_task_id, student_attempts.task_id)
               ELSE NULL
             END
           ) AS independent_success_count
         FROM student_attempts
         INNER JOIN lesson_tasks ON lesson_tasks.id = student_attempts.task_id
         WHERE student_attempts.user_id = ?
           ${lessonPredicate}
           AND lesson_tasks.skill_id = ?`,
      params,
    );
    return {
      attempt_count: counts?.attempt_count ?? 0,
      verified_success_count: counts?.verified_success_count ?? 0,
      independent_success_count: counts?.independent_success_count ?? 0,
    };
  }

  private missingEvidence(
    sequence: string[],
    currentCounts: VerifiedAttemptCounts,
    cumulativeCounts: VerifiedAttemptCounts,
    requiredIndependentSuccessCount: number,
  ): string[] {
    const missing: string[] = [];
    if (sequence.includes('attempt_submitted') && currentCounts.attempt_count < 1) {
      missing.push('attempt_submitted');
    }
    if (
      sequence.includes('deterministically_verified') &&
      currentCounts.verified_success_count < 1
    ) {
      missing.push('deterministically_verified');
    }
    if (
      (sequence.includes('repeated_independent_success') ||
        requiredIndependentSuccessCount > 1) &&
      cumulativeCounts.independent_success_count < requiredIndependentSuccessCount
    ) {
      missing.push('repeated_independent_success');
    }
    return missing;
  }

  private readEvidenceSequence(criteria: CurriculumMasteryCriteriaRow): string[] {
    try {
      const parsed = JSON.parse(criteria.required_evidence_sequence_json) as unknown;
      return Array.isArray(parsed)
        ? parsed.map((value) => String(value)).filter((value) => value.length > 0)
        : ['attempt_submitted', 'deterministically_verified'];
    } catch {
      return ['attempt_submitted', 'deterministically_verified'];
    }
  }

  private currentEvidenceLevel(
    currentCounts: VerifiedAttemptCounts,
    cumulativeCounts: VerifiedAttemptCounts,
  ): LessonEvidenceLevel {
    if (cumulativeCounts.independent_success_count >= 2) {
      return 'repeated_independent_success';
    }
    if (currentCounts.verified_success_count >= 1) {
      return 'deterministically_verified';
    }
    if (currentCounts.attempt_count >= 1) {
      return 'attempt_submitted';
    }
    return 'none';
  }

  private result(input: {
    allowed: boolean;
    evidenceLevel: LessonEvidenceLevel;
    reason: string;
    criteria: CurriculumMasteryCriteriaRow | undefined;
    currentCounts: VerifiedAttemptCounts;
    cumulativeCounts: VerifiedAttemptCounts;
    requiredIndependentSuccessCount?: number;
    criteriaSourceOverride?: 'missing_required';
  }): MasteryPolicyResult {
    return {
      allowed: input.allowed,
      evidenceLevel: input.evidenceLevel,
      reason: input.reason,
      requiredEvidenceSequence: input.criteria
        ? this.readEvidenceSequence(input.criteria)
        : ['attempt_submitted', 'deterministically_verified'],
      currentLessonVerifiedSuccessCount: input.currentCounts.verified_success_count ?? 0,
      currentLessonIndependentSuccessCount: input.currentCounts.independent_success_count ?? 0,
      cumulativeVerifiedSuccessCount: input.cumulativeCounts.verified_success_count ?? 0,
      cumulativeIndependentSuccessCount: input.cumulativeCounts.independent_success_count ?? 0,
      verifiedSuccessCount: input.cumulativeCounts.verified_success_count ?? 0,
      independentSuccessCount: input.cumulativeCounts.independent_success_count ?? 0,
      requiredIndependentSuccessCount: input.requiredIndependentSuccessCount ?? 1,
      criteriaSource:
        input.criteriaSourceOverride ??
        (input.criteria ? 'curriculum_mastery_criteria' : 'fallback'),
    };
  }

  private isSuccessfulVerifierResult(result: LessonVerifierResult): boolean {
    return result === 'correct' || result === 'equivalent';
  }

  private isMasteryCriteriaRequired(): boolean {
    return this.configService.get<boolean>('app.masteryCriteriaRequired') ?? true;
  }
}
