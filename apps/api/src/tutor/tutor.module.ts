import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { StudentProfileModule } from '../student-profile/student-profile.module';
import { TutorController } from './tutor.controller';
import { TutorService } from './tutor.service';

@Module({
  imports: [AuthModule, KnowledgeModule, StudentProfileModule],
  controllers: [TutorController],
  providers: [TutorService],
})
export class TutorModule {}
