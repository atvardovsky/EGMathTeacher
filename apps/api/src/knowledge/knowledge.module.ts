import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgePackService } from './knowledge-pack.service';
import { KnowledgeService } from './knowledge.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, KnowledgePackService],
  exports: [KnowledgeService, KnowledgePackService],
})
export class KnowledgeModule {}
