import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { StudentProfileController } from './student-profile.controller';
import { StudentProfileService } from './student-profile.service';

@Module({
  imports: [AuthModule, KnowledgeModule],
  controllers: [StudentProfileController],
  providers: [StudentProfileService],
  exports: [StudentProfileService],
})
export class StudentProfileModule {}
