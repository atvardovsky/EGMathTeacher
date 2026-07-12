import { Global, Module } from '@nestjs/common';
import { CurriculumService } from './curriculum.service';
import { LessonDecisionService } from './lesson-decision.service';
import { LessonPolicyService } from './lesson-policy.service';
import { LessonService } from './lesson.service';
import { MathVerifierService } from './math-verifier.service';
import { TaskBankService } from './task-bank.service';

@Global()
@Module({
  providers: [
    LessonService,
    LessonPolicyService,
    LessonDecisionService,
    CurriculumService,
    TaskBankService,
    MathVerifierService,
  ],
  exports: [
    LessonService,
    LessonPolicyService,
    LessonDecisionService,
    CurriculumService,
    TaskBankService,
    MathVerifierService,
  ],
})
export class LessonModule {}
