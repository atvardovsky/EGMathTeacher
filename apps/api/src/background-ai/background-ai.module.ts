import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { StudentProfileModule } from '../student-profile/student-profile.module';
import { BackgroundAiService } from './background-ai.service';

@Module({
  imports: [KnowledgeModule, StudentProfileModule],
  providers: [BackgroundAiService],
  exports: [BackgroundAiService],
})
export class BackgroundAiModule {}
