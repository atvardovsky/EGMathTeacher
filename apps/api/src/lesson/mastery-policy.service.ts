import { Injectable } from '@nestjs/common';
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
  verifiedSuccessCount: number;
  independentSuccessCount: number;
  requiredIndependentSuccessCount: number;
  criteriaSource: 'curriculum_mastery_criteria' | 'fallback';
}

@Injectable()
export class MasteryPolicyService {
  constructor(private readonly db: DatabaseService) {}

  evaluateVerifiedAttempt(input: MasteryPolicyInput): MasteryPolicyResult {
    const counts = this.countVerifiedAttempts(input);
    const criteria = this.getCriteria(input.skillId);
    if (!this.isSuccessfulVerifierResult(input.verifierResult)) {
      return this.result({
        allowed: false,
        evidenceLevel: counts.attempt_count > 0 ? 'attempt_submitted' : 'none',
        reason: 'Verifier result is not a successful independent answer.',
        criteria,
        counts,
      });
    }

    if (!criteria) {
      return this.result({
        allowed: counts.verified_success_count >= 1,
        evidenceLevel:
          counts.independent_success_count >= 2
            ? 'repeated_independent_success'
            : 'deterministically_verified',
        reason:
          counts.verified_success_count >= 1
            ? 'No imported mastery criteria were found; POC fallback accepts one verified success.'
            : 'No verified success is available yet.',
        criteria,
        counts,
        requiredIndependentSuccessCount: 1,
      });
    }

    const sequence = this.readEvidenceSequence(criteria);
    const requiresRepeated =
      sequence.includes('repeated_independent_success') ||
      criteria.single_success_can_complete !== 1;
    const requiredIndependentSuccessCount = requiresRepeated ? 2 : 1;
    const missing = this.missingEvidence(sequence, counts, requiredIndependentSuccessCount);
    if (missing.length > 0) {
      return this.result({
        allowed: false,
        evidenceLevel: this.currentEvidenceLevel(counts),
        reason: `Mastery criteria are not satisfied yet: missing ${missing.join(', ')}.`,
        criteria,
        counts,
        requiredIndependentSuccessCount,
      });
    }

    return this.result({
      allowed: true,
      evidenceLevel:
        counts.independent_success_count >= 2
          ? 'repeated_independent_success'
          : 'deterministically_verified',
      reason: 'Imported mastery criteria are satisfied.',
      criteria,
      counts,
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

  private countVerifiedAttempts(input: MasteryPolicyInput): VerifiedAttemptCounts {
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
               THEN student_attempts.task_id
               ELSE NULL
             END
           ) AS independent_success_count
         FROM student_attempts
         INNER JOIN lesson_tasks ON lesson_tasks.id = student_attempts.task_id
         WHERE student_attempts.user_id = ?
           AND student_attempts.lesson_session_id = ?
           AND lesson_tasks.skill_id = ?`,
      [input.userId, input.lessonSessionId, input.skillId],
    );
    return {
      attempt_count: counts?.attempt_count ?? 0,
      verified_success_count: counts?.verified_success_count ?? 0,
      independent_success_count: counts?.independent_success_count ?? 0,
    };
  }

  private missingEvidence(
    sequence: string[],
    counts: VerifiedAttemptCounts,
    requiredIndependentSuccessCount: number,
  ): string[] {
    const missing: string[] = [];
    if (sequence.includes('attempt_submitted') && counts.attempt_count < 1) {
      missing.push('attempt_submitted');
    }
    if (sequence.includes('deterministically_verified') && counts.verified_success_count < 1) {
      missing.push('deterministically_verified');
    }
    if (
      (sequence.includes('repeated_independent_success') ||
        requiredIndependentSuccessCount > 1) &&
      counts.independent_success_count < requiredIndependentSuccessCount
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

  private currentEvidenceLevel(counts: VerifiedAttemptCounts): LessonEvidenceLevel {
    if (counts.independent_success_count >= 2) {
      return 'repeated_independent_success';
    }
    if (counts.verified_success_count >= 1) {
      return 'deterministically_verified';
    }
    if (counts.attempt_count >= 1) {
      return 'attempt_submitted';
    }
    return 'none';
  }

  private result(input: {
    allowed: boolean;
    evidenceLevel: LessonEvidenceLevel;
    reason: string;
    criteria: CurriculumMasteryCriteriaRow | undefined;
    counts: VerifiedAttemptCounts;
    requiredIndependentSuccessCount?: number;
  }): MasteryPolicyResult {
    return {
      allowed: input.allowed,
      evidenceLevel: input.evidenceLevel,
      reason: input.reason,
      requiredEvidenceSequence: input.criteria
        ? this.readEvidenceSequence(input.criteria)
        : ['attempt_submitted', 'deterministically_verified'],
      verifiedSuccessCount: input.counts.verified_success_count ?? 0,
      independentSuccessCount: input.counts.independent_success_count ?? 0,
      requiredIndependentSuccessCount: input.requiredIndependentSuccessCount ?? 1,
      criteriaSource: input.criteria ? 'curriculum_mastery_criteria' : 'fallback',
    };
  }

  private isSuccessfulVerifierResult(result: LessonVerifierResult): boolean {
    return result === 'correct' || result === 'equivalent';
  }
}
