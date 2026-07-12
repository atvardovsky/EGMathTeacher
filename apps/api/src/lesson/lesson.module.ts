import { Global, Module } from '@nestjs/common';
import { LessonService } from './lesson.service';

@Global()
@Module({
  providers: [LessonService],
  exports: [LessonService],
})
export class LessonModule {}
