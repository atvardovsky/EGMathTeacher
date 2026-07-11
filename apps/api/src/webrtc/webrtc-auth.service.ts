import { Inject, Injectable } from '@nestjs/common';
import { AI_PROVIDER_TOKEN } from '../providers/ai-provider.constants';
import {
  AiProvider,
  FileSearchAttachmentConfig,
  PersonaConfig,
  RealtimeSessionResponse,
} from '../providers/ai-provider.types';

export interface RealtimeEphemeralToken {
  id: string;
  model?: string;
  client_secret: {
    value: string;
    expires_at: string;
  };
  raw: unknown;
}

export interface CreateEphemeralTokenOptions {
  sessionId: string;
  conversationId: string;
  voice?: string;
  personality?: {
    name?: string;
    description?: string;
    tone?: string;
    locale?: string;
    rules?: string;
  };
  fileSearch?: {
    documentationIds?: string[];
    ruleIds?: string[];
	  };
	}

@Injectable()
export class WebRtcAuthService {
  constructor(@Inject(AI_PROVIDER_TOKEN) private readonly aiProvider: AiProvider) {}

  async createEphemeralToken(
    options: CreateEphemeralTokenOptions,
  ): Promise<RealtimeEphemeralToken> {
    const response = await this.aiProvider.createRealtimeSession({
      sessionId: options.sessionId,
      conversationId: options.conversationId,
      voice: options.voice,
      persona: this.cleanPersona(options.personality),
      fileSearch: this.cleanFileSearch(options.fileSearch),
    });

    return this.toEphemeralToken(response);
  }

  private cleanPersona(persona?: {
    name?: string;
    description?: string;
    tone?: string;
    locale?: string;
    rules?: string;
  }): PersonaConfig | undefined {
    if (!persona) {
      return undefined;
    }
    const cleaned: PersonaConfig = {};
    const maybeAssign = (key: keyof PersonaConfig, value?: string) => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          cleaned[key] = trimmed;
        }
      }
    };

    maybeAssign('name', persona.name);
    maybeAssign('description', persona.description);
    maybeAssign('tone', persona.tone);
    maybeAssign('locale', persona.locale);
    maybeAssign('rules', persona.rules);

    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }

  private cleanFileSearch(
    fileSearch?: {
      documentationIds?: string[];
      ruleIds?: string[];
    },
  ): FileSearchAttachmentConfig | undefined {
    if (!fileSearch) {
      return undefined;
    }
    const trimArray = (values?: string[]) =>
      values
        ?.map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0);

    const documentationIds = trimArray(fileSearch.documentationIds);
    const ruleIds = trimArray(fileSearch.ruleIds);

    if ((!documentationIds || documentationIds.length === 0) && (!ruleIds || ruleIds.length === 0)) {
      return undefined;
    }

    return {
      documentationIds,
      ruleIds,
    };
  }

  private toEphemeralToken(response: RealtimeSessionResponse): RealtimeEphemeralToken {
    return {
      id: response.id,
      model: response.model,
      client_secret: {
        value: response.clientSecret.value,
        expires_at: response.clientSecret.expiresAt,
      },
      raw: response.raw,
    };
  }
}
