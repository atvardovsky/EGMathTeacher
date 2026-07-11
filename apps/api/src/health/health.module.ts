import { Module } from '@nestjs/common';
import { WebRtcModule } from '../webrtc/webrtc.module';
import { HealthController } from './health.controller';

@Module({
  imports: [WebRtcModule],
  controllers: [HealthController],
})
export class HealthModule {}
