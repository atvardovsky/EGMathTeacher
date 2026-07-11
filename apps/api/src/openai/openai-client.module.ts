import { Global, Module } from '@nestjs/common';
import { OpenAiClientService } from './openai-client.service';

@Global()
@Module({
  providers: [OpenAiClientService],
  exports: [OpenAiClientService],
})
export class OpenAiClientModule {}
