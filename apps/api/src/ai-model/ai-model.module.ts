import { Global, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAiClientModule } from '../openai/openai-client.module';
import { OpenAiClientService } from '../openai/openai-client.service';
import { UsageModule } from '../usage/usage.module';
import { AI_MODEL_PROVIDER_TOKEN } from './ai-model.constants';
import { AiOperationPolicyService } from './ai-operation-policy.service';
import { AiModelService } from './ai-model.service';
import { AiModelProvider } from './ai-model.types';
import { OpenAiModelProvider } from './openai-model.provider';
import { StubModelProvider } from './stub-model.provider';

function createModelProviderFactory(): Provider {
  return {
    provide: AI_MODEL_PROVIDER_TOKEN,
    inject: [ConfigService, OpenAiClientService],
    useFactory: (
      configService: ConfigService,
      openAiClient: OpenAiClientService,
    ): AiModelProvider => {
      const provider = (configService.get<string>('ai.modelProvider') ?? 'openai').toLowerCase();
      switch (provider) {
        case 'openai':
        case 'openai-responses':
          return new OpenAiModelProvider(openAiClient);
        default:
          return new StubModelProvider(provider);
      }
    },
  };
}

@Global()
@Module({
  imports: [OpenAiClientModule, UsageModule],
  providers: [createModelProviderFactory(), AiOperationPolicyService, AiModelService],
  exports: [AiModelService, AiOperationPolicyService, AI_MODEL_PROVIDER_TOKEN],
})
export class AiModelModule {}
