import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/app.configuration';
import webrtcConfiguration from './config/webrtc.configuration';
import aiConfiguration from './config/ai.configuration';
import { ConversationModule } from './conversation/conversation.module';
import { WebRtcModule } from './webrtc/webrtc.module';
import { AiProviderModule } from './providers/ai-provider.module';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { TutorModule } from './tutor/tutor.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { OpenAiClientModule } from './openai/openai-client.module';
import { StudentProfileModule } from './student-profile/student-profile.module';
import { AiModelModule } from './ai-model/ai-model.module';
import { LessonModule } from './lesson/lesson.module';
import { UsageModule } from './usage/usage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration, webrtcConfiguration, aiConfiguration],
    }),
    ConversationModule,
    DatabaseModule,
    AuthModule,
    LessonModule,
    UsageModule,
    StudentProfileModule,
    OpenAiClientModule,
    AiModelModule,
    AiProviderModule,
    WebRtcModule,
    TutorModule,
    KnowledgeModule,
    HealthModule,
  ],
})
export class AppModule {}
