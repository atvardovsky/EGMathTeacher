import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { StudentProfileModule } from '../student-profile/student-profile.module';
import { BackgroundAiController } from './background-ai.controller';
import { BackgroundAiService } from './background-ai.service';

@Module({
  imports: [AuthModule, KnowledgeModule, StudentProfileModule],
  controllers: [BackgroundAiController],
  providers: [BackgroundAiService],
  exports: [BackgroundAiService],
})
export class BackgroundAiModule {}
