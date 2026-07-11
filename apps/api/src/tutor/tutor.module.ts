import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BackgroundAiModule } from '../background-ai/background-ai.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { StudentProfileModule } from '../student-profile/student-profile.module';
import { TutorController } from './tutor.controller';
import { TutorService } from './tutor.service';

@Module({
  imports: [AuthModule, KnowledgeModule, StudentProfileModule, BackgroundAiModule],
  controllers: [TutorController],
  providers: [TutorService],
})
export class TutorModule {}
