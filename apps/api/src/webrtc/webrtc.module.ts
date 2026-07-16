import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { BackgroundAiModule } from '../background-ai/background-ai.module';
import webrtcConfiguration from '../config/webrtc.configuration';
import { ConversationModule } from '../conversation/conversation.module';
import { LessonModule } from '../lesson/lesson.module';
import { AiProviderModule } from '../providers/ai-provider.module';
import { TeachingContextModule } from '../teaching-context/teaching-context.module';
import { TutorModule } from '../tutor/tutor.module';
import { UsageModule } from '../usage/usage.module';
import { WebRtcController } from './webrtc.controller';
import { WebRtcAuthService } from './webrtc-auth.service';
import { WebRtcMediaService } from './webrtc-media.service';
import { WebRtcSessionService } from './webrtc-session.service';
import { WebRtcSignalingService } from './webrtc-signaling.service';
import { WebRtcProviderEventService } from './webrtc-provider-event.service';
import { OpenAiRealtimeBridgeService } from './openai-realtime-bridge.service';

@Module({
  imports: [
    ConfigModule.forFeature(webrtcConfiguration),
    AuthModule,
    ConversationModule,
    AiProviderModule,
    UsageModule,
    LessonModule,
    TutorModule,
    TeachingContextModule,
    BackgroundAiModule,
  ],
  controllers: [WebRtcController],
  providers: [
    WebRtcSessionService,
    WebRtcSignalingService,
    WebRtcAuthService,
    OpenAiRealtimeBridgeService,
    WebRtcProviderEventService,
    WebRtcMediaService,
  ],
  exports: [
    WebRtcSessionService,
    WebRtcSignalingService,
    WebRtcAuthService,
    OpenAiRealtimeBridgeService,
    WebRtcMediaService,
  ],
})
export class WebRtcModule {}
