import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsageController } from './usage.controller';
import { UsageService } from './usage.service';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [UsageController],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
