import { WebRtcSignalingService } from '../src/webrtc/webrtc-signaling.service';
import { ConfigService } from '@nestjs/config';

const createConfigService = (values: Record<string, unknown>): ConfigService =>
  ({
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService);

describe('WebRtcSignalingService', () => {
  it('returns default voice when not provided and ensures uniqueness', () => {
    const configValues = {
      'webrtc.voices.available': ['sol', 'sol', 'verse'],
      'webrtc.voices.default': 'alloy',
    };
    const service = new WebRtcSignalingService(createConfigService(configValues));

    const voiceConfig = service.getVoiceConfig();

    expect(voiceConfig.default).toBe('alloy');
    expect(voiceConfig.available).toEqual(['alloy', 'sol', 'verse']);
  });

  it('includes personality, voice, and file search data in bootstrap payload', () => {
    const configValues = {
      'webrtc.iceServers': ['stun:example.com:3478'],
      'ai.openai.realtimeModel': 'gpt-4o-realtime-preview',
      'webrtc.assistantPersonality.name': 'Aurora',
      'webrtc.assistantPersonality.description': 'An upbeat companion.',
      'webrtc.assistantPersonality.tone': 'energetic',
      'webrtc.assistantPersonality.locale': 'auto',
      'webrtc.assistantPersonality.rules': 'Always encourage and keep responses brief.',
      'webrtc.fileSearch.documentationIds': ['file_doc_1'],
      'webrtc.fileSearch.ruleIds': ['file_rule_1'],
      'webrtc.voices.available': ['alloy', 'verse'],
      'webrtc.voices.default': 'verse',
    };
    const service = new WebRtcSignalingService(createConfigService(configValues));

    const payload = service.buildBootstrapPayload('sess-123', 'conv-abc');

    expect(payload.sessionId).toBe('sess-123');
    expect(payload.conversationId).toBe('conv-abc');
    expect(payload.iceServers).toEqual([{ urls: 'stun:example.com:3478' }]);
    expect(payload.openaiRealtimeModel).toBe('gpt-4o-realtime-preview');
    expect(payload.personality).toEqual({
      name: 'Aurora',
      description: 'An upbeat companion.',
      tone: 'energetic',
      locale: 'auto',
      rules: 'Always encourage and keep responses brief.',
    });
    expect(payload.fileSearch).toEqual({
      documentationIds: ['file_doc_1'],
      ruleIds: ['file_rule_1'],
    });
    expect(payload.voices).toEqual({
      default: 'verse',
      available: ['verse', 'alloy'],
    });
  });

  it('applies translation config when languages are provided', () => {
    const service = new WebRtcSignalingService(createConfigService({}));
    const base = {
      name: 'Voice Assistant',
      description: 'Helpful',
      tone: 'friendly',
      locale: 'auto',
      rules: 'Stay helpful.',
    };

    const translated = service.applyTranslationConfig(base, {
      languageA: 'English',
      languageB: 'Spanish',
    });

    expect(translated.name).toBe('Translator');
    expect(translated.description).toContain('English');
    expect(translated.description).toContain('Spanish');
    expect(translated.rules).toContain('English');
    expect(translated.rules).toContain('Spanish');
    expect(translated.rules).toContain('Output only the translation');
  });

  it('keeps base persona when translation config is missing languages', () => {
    const service = new WebRtcSignalingService(createConfigService({}));
    const base = {
      name: 'Voice Assistant',
      description: 'Helpful',
      tone: 'friendly',
      locale: 'auto',
      rules: 'Stay helpful.',
    };

    expect(service.applyTranslationConfig(base, { languageA: 'English', languageB: '' })).toEqual(
      base,
    );
  });
});
