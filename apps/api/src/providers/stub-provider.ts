import { Injectable, Logger } from '@nestjs/common';
import {
  AiProvider,
  RealtimeSessionRequest,
  RealtimeSessionResponse,
} from './ai-provider.types';

@Injectable()
export class StubAiProvider implements AiProvider {
  readonly id: string;
  private readonly logger = new Logger(StubAiProvider.name);

  constructor(id: string) {
    this.id = id;
  }

  async createRealtimeSession(
    _request: RealtimeSessionRequest,
  ): Promise<RealtimeSessionResponse> {
    this.logger.warn(
      `AI provider "${this.id}" is not implemented yet. Please configure a supported provider.`,
    );
    throw new Error(`AI provider "${this.id}" is not implemented yet.`);
  }
}
