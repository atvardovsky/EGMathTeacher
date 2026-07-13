import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { LessonVerifierResult } from './lesson.types';

interface MisconceptionHintRow {
  misconception_id: string;
  first_hint: string;
  second_hint: string;
}

export interface HintRoutingInput {
  result: LessonVerifierResult;
  errorCode?: string;
  hintLadder: string[];
  commonErrors: string[];
  attemptCount: number;
}

export interface HintRoutingResult {
  hint?: string;
  route?: string;
  misconceptionId?: string;
}

@Injectable()
export class HintRoutingService {
  constructor(private readonly db: DatabaseService) {}

  selectHint(input: HintRoutingInput): HintRoutingResult {
    if (input.result === 'correct' || input.result === 'equivalent') {
      return {};
    }
    if (input.errorCode === 'answer_format_not_numeric') {
      return {
        hint: 'Напиши ответ числом или в виде x = число.',
        route: 'format_error',
      };
    }

    const misconception = this.pickMisconception(input.commonErrors, input.errorCode);
    if (misconception) {
      return {
        hint: input.attemptCount <= 1 ? misconception.first_hint : misconception.second_hint,
        route: `misconception:${misconception.misconception_id}`,
        misconceptionId: misconception.misconception_id,
      };
    }

    if (input.hintLadder.length === 0) {
      return {};
    }
    const index = Math.min(Math.max(input.attemptCount - 1, 0), input.hintLadder.length - 1);
    return {
      hint: input.hintLadder[index],
      route: 'hint_ladder',
    };
  }

  private pickMisconception(
    commonErrors: string[],
    errorCode: string | undefined,
  ): MisconceptionHintRow | undefined {
    if (commonErrors.length === 0) {
      return undefined;
    }
    const normalizedError = errorCode?.toLowerCase() ?? '';
    const directMatch = commonErrors.find((error) => error.toLowerCase() === normalizedError);
    const candidateIds = directMatch ? [directMatch] : commonErrors;
    const placeholders = candidateIds.map(() => '?').join(', ');
    return this.db.get<MisconceptionHintRow>(
      `SELECT misconception_id, first_hint, second_hint
       FROM curriculum_misconceptions
       WHERE COALESCE(sync_status, 'active') = 'active'
         AND misconception_id IN (${placeholders})
       ORDER BY CASE misconception_id ${candidateIds
         .map((_, index) => `WHEN ? THEN ${index}`)
         .join(' ')} ELSE ${candidateIds.length} END
       LIMIT 1`,
      [...candidateIds, ...candidateIds],
    );
  }
}
