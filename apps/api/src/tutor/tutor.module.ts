import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BackgroundAiModule } from '../background-ai/background-ai.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { LessonModule } from '../lesson/lesson.module';
import { StudentProfileModule } from '../student-profile/student-profile.module';
import { UsageModule } from '../usage/usage.module';
import { TutorController } from './tutor.controller';
import { TutorService } from './tutor.service';

@Module({
  imports: [AuthModule, KnowledgeModule, StudentProfileModule, BackgroundAiModule, LessonModule, UsageModule],
  controllers: [TutorController],
  providers: [TutorService],
})
export class TutorModule {}
