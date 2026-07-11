import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_PROVIDER_TOKEN } from './ai-provider.constants';
import { AiProvider } from './ai-provider.types';
import { OpenAiRealtimeProvider } from './openai-realtime.provider';
import { StubAiProvider } from './stub-provider';

function createProviderFactory(): Provider {
  return {
    provide: AI_PROVIDER_TOKEN,
    inject: [ConfigService],
    useFactory: async (configService: ConfigService): Promise<AiProvider> => {
      const provider = configService.get<string>('ai.provider') ?? 'openai-realtime';
      switch (provider) {
        case 'openai-realtime':
          return new OpenAiRealtimeProvider(configService);
        case 'google-gemini-live':
        case 'gemini-live':
        case 'google-gemini':
          return new StubAiProvider('google-gemini-live');
        case 'hume-evi':
          return new StubAiProvider('hume-evi');
        case 'retell-ai':
          return new StubAiProvider('retell-ai');
        default:
          return new StubAiProvider(provider);
      }
    },
  };
}

@Module({
  providers: [createProviderFactory()],
  exports: [AI_PROVIDER_TOKEN],
})
export class AiProviderModule {}
