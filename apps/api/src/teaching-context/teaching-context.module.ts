import { Global, Module } from '@nestjs/common';
import { TeachingContextService } from './teaching-context.service';

@Global()
@Module({
  providers: [TeachingContextService],
  exports: [TeachingContextService],
})
export class TeachingContextModule {}
