import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiProvider,
  PersonaConfig,
  RealtimeSessionRequest,
  RealtimeSessionResponse,
} from './ai-provider.types';

interface OpenAiSessionPayload {
  model: string;
  voice?: string;
  instructions?: string;
  input_audio_format?: string;
  output_audio_format?: string;
}

const OPENAI_REQUEST_TIMEOUT_MS = 10_000;
const OPENAI_REQUEST_RETRIES = 2;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  retries = 1,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      return response;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt === retries) {
        break;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Request failed');
}

@Injectable()
export class OpenAiRealtimeProvider implements AiProvider {
  readonly id = 'openai-realtime';
  private readonly logger = new Logger(OpenAiRealtimeProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async createRealtimeSession(
    request: RealtimeSessionRequest,
  ): Promise<RealtimeSessionResponse> {
    const apiKey = this.configService.get<string>('ai.openai.apiKey');
    if (!apiKey) {
      this.logger.error('OPENAI_API_KEY is not configured; cannot create realtime session.');
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const model =
      this.configService.get<string>('ai.openai.realtimeModel') ?? 'gpt-4o-realtime-preview';

    const payload: OpenAiSessionPayload = {
      model,
      // OpenAI REST realtime sessions only accept pcm16/g711 audio; use pcm16 end to end.
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
    };

    if (request.voice) {
      payload.voice = request.voice;
    }

    const persona = request.persona ? this.filterEmptyPersonaFields(request.persona) : undefined;
    if (persona) {
      payload.instructions = this.composeInstructions(persona);
    } else if (!payload.instructions) {
      payload.instructions = 'You are a helpful voice assistant. Respond concisely.';
    }

    if (request.fileSearch) {
      this.logger.warn(
        'OpenAI Realtime REST API does not yet support attaching file search ids directly. Skipping fileSearch configuration.',
      );
    }

    const response = await fetchWithTimeout(
      'https://api.openai.com/v1/realtime/sessions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'realtime=v1',
        },
        body: JSON.stringify(payload),
      },
      OPENAI_REQUEST_TIMEOUT_MS,
      OPENAI_REQUEST_RETRIES,
    );

    if (!response.ok) {
      const message = await response.text();
      this.logger.error(
        `OpenAI realtime session creation failed (status ${response.status}): ${message}`,
      );
      throw new Error('Failed to create OpenAI Realtime session');
    }

    const body = await response.json();
    const clientSecret = body?.client_secret;
    if (!clientSecret?.value || !clientSecret?.expires_at) {
      throw new Error('OpenAI realtime session response missing client secret');
    }

    return {
      id: body.id ?? request.sessionId,
      model: body.model ?? model,
      clientSecret: {
        value: clientSecret.value,
        expiresAt: clientSecret.expires_at,
      },
      raw: body,
    };
  }

  private filterEmptyPersonaFields(persona: PersonaConfig): PersonaConfig | undefined {
    const cleaned = Object.entries(persona).reduce<Record<string, string>>((acc, [key, value]) => {
      if (typeof value === 'string' && value.trim().length > 0) {
        acc[key] = value.trim();
      }
      return acc;
    }, {});

    return Object.keys(cleaned).length > 0 ? (cleaned as PersonaConfig) : undefined;
  }

  private composeInstructions(persona: PersonaConfig): string {
    const pieces: string[] = [];
    if (persona.name) {
      pieces.push(`You are "${persona.name}".`);
    }
    if (persona.description) {
      pieces.push(persona.description.trim());
    }
    if (persona.tone) {
      pieces.push(`Use a ${persona.tone.trim()} tone.`);
    }
    if (persona.locale && persona.locale.toLowerCase() !== 'auto') {
      pieces.push(`Speak in ${persona.locale.trim()}.`);
    }
    if (persona.rules) {
      pieces.push(`Rules: ${persona.rules.trim()}`);
    }
    if (pieces.length === 0) {
      return 'You are a helpful voice assistant. Respond concisely.';
    }
    return pieces.join(' ');
  }
}
