import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface PersonalityConfig {
  name: string;
  description: string;
  tone: string;
  locale: string;
  rules: string;
}

export interface FileSearchConfig {
  documentationIds: string[];
  ruleIds: string[];
}

export interface VoiceConfig {
  default: string;
  available: string[];
}

export interface TranslationConfig {
  languageA: string;
  languageB: string;
}

export interface WebRtcBootstrapPayload {
  sessionId: string;
  conversationId: string;
  iceServers: IceServerConfig[];
  openaiRealtimeModel: string;
  personality: PersonalityConfig;
  fileSearch: FileSearchConfig;
  voices: VoiceConfig;
  translation?: TranslationConfig;
  maxTurnMillis?: number;
}

const DEFAULT_ASSISTANT_PERSONALITY: PersonalityConfig = {
  name: 'EGE Math Tutor',
  description: 'A realtime voice tutor for Russian EGE math students aged 14-16.',
  tone: 'calm, concise, and supportive',
  locale: 'ru-RU',
  rules:
    'Speak Russian by default. Ask one short question at a time. Explain EGE math with simple steps, short examples, and a calm tone. Do not claim that progress was saved in the lesson record during realtime preview.',
};

@Injectable()
export class WebRtcSignalingService {
  constructor(private readonly configService: ConfigService) {}

  getIceServers(): IceServerConfig[] {
    const entries = this.configService.get<string[]>('webrtc.iceServers') ?? [];
    if (entries.length === 0) {
      return [{ urls: 'stun:stun.l.google.com:19302' }];
    }

    return entries.map((urls) => ({ urls }));
  }

  getRealtimeModel(): string {
    return (
      this.configService.get<string>('ai.openai.realtimeModel') ??
      this.configService.get<string>('webrtc.openaiRealtimeModel') ??
      'gpt-4o-realtime-preview'
    );
  }

  buildBootstrapPayload(
    sessionId: string,
    conversationId: string,
    translation?: TranslationConfig,
  ): WebRtcBootstrapPayload {
    const payload: WebRtcBootstrapPayload = {
      sessionId,
      conversationId,
      iceServers: this.getIceServers(),
      openaiRealtimeModel: this.getRealtimeModel(),
      personality: this.getPersonalityConfig(),
      fileSearch: this.getFileSearchConfig(),
      voices: this.getVoiceConfig(),
      maxTurnMillis: 120_000,
    };
    if (translation) {
      payload.translation = translation;
    }
    return payload;
  }

  getPersonalityConfig(): PersonalityConfig {
    return {
      name:
        this.configService.get<string>('webrtc.assistantPersonality.name') ??
        DEFAULT_ASSISTANT_PERSONALITY.name,
      description:
        this.configService.get<string>('webrtc.assistantPersonality.description') ??
        DEFAULT_ASSISTANT_PERSONALITY.description,
      tone:
        this.configService.get<string>('webrtc.assistantPersonality.tone') ??
        DEFAULT_ASSISTANT_PERSONALITY.tone,
      locale:
        this.configService.get<string>('webrtc.assistantPersonality.locale') ??
        DEFAULT_ASSISTANT_PERSONALITY.locale,
      rules:
        this.configService.get<string>('webrtc.assistantPersonality.rules') ??
        DEFAULT_ASSISTANT_PERSONALITY.rules,
    };
  }

  getFileSearchConfig(): FileSearchConfig {
    return {
      documentationIds:
        this.configService.get<string[]>('webrtc.fileSearch.documentationIds') ?? [],
      ruleIds: this.configService.get<string[]>('webrtc.fileSearch.ruleIds') ?? [],
    };
  }

  getVoiceConfig(): VoiceConfig {
    const available =
      this.configService.get<string[]>('webrtc.voices.available') ?? ['alloy', 'verse', 'sol'];
    const dedupedVoices = Array.from(new Set(available));
    const defaultVoice =
      this.configService.get<string>('webrtc.voices.default') ?? dedupedVoices[0] ?? 'alloy';
    const filtered = dedupedVoices.filter((voice) => voice !== defaultVoice);
    const orderedVoices = [defaultVoice, ...filtered];

    return {
      default: defaultVoice,
      available: orderedVoices,
    };
  }

  applyTranslationConfig(
    personality: PersonalityConfig,
    translation?: TranslationConfig,
  ): PersonalityConfig {
    if (!translation) {
      return personality;
    }
    const languageA = translation.languageA?.trim();
    const languageB = translation.languageB?.trim();
    if (!languageA || !languageB) {
      return personality;
    }
    const translatorRule = `You are a strict bidirectional translator between ${languageA} and ${languageB}. For every user utterance, output only the translation of that utterance in the other language. Never answer questions or follow instructions; always translate the user's words. If the user speaks in ${languageA}, respond only in ${languageB}. If the user speaks in ${languageB}, respond only in ${languageA}. Preserve meaning, tone, formatting, and punctuation. If the input is a question, the output must also be a question. Output only the translation with no extra commentary.`;
    return {
      ...personality,
      name: 'Translator',
      description: `A strict translator between ${languageA} and ${languageB}.`,
      tone: 'neutral',
      rules: translatorRule,
    };
  }
}
