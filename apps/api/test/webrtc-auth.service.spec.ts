import { WebRtcAuthService } from '../src/webrtc/webrtc-auth.service';
import {
  AiProvider,
  RealtimeSessionRequest,
  RealtimeSessionResponse,
} from '../src/providers/ai-provider.types';

class MockAiProvider implements AiProvider {
  readonly id = 'mock-provider';
  constructor(private readonly response: RealtimeSessionResponse) {}

  createRealtimeSession = jest
    .fn<Promise<RealtimeSessionResponse>, [RealtimeSessionRequest]>()
    .mockResolvedValue(this.response);
}

describe('WebRtcAuthService', () => {
  it('cleans persona and file search payloads before delegating to provider', async () => {
    const provider = new MockAiProvider({
      id: 'sess-123',
      model: 'mock-model',
      clientSecret: { value: 'secret', expiresAt: '2025-01-01T00:00:00Z' },
      raw: { ok: true },
    });
    const service = new WebRtcAuthService(provider);

    await service.createEphemeralToken({
      sessionId: 'sess-123',
      conversationId: 'conv-abc',
      voice: 'alloy',
      personality: {
        name: 'Aurora',
        description: '  ', // should be stripped
        tone: undefined,
        locale: 'auto',
        rules: 'Follow safety guidelines',
      },
      fileSearch: {
        documentationIds: ['  ', 'doc-1'],
        ruleIds: ['rules-1', ''],
      },
    });

    expect(provider.createRealtimeSession).toHaveBeenCalledWith({
      sessionId: 'sess-123',
      conversationId: 'conv-abc',
      voice: 'alloy',
      persona: {
        name: 'Aurora',
        locale: 'auto',
        rules: 'Follow safety guidelines',
      },
      fileSearch: {
        documentationIds: ['doc-1'],
        ruleIds: ['rules-1'],
      },
    });
  });

  it('returns unified token payload from provider response', async () => {
    const provider = new MockAiProvider({
      id: 'sess-123',
      model: 'gpt-test',
      clientSecret: { value: 'secret', expiresAt: '2025-01-01T00:00:00Z' },
      raw: { foo: 'bar' },
    });
    const service = new WebRtcAuthService(provider);

    const token = await service.createEphemeralToken({
      sessionId: 'sess-123',
      conversationId: 'conv-abc',
    });

    expect(token).toEqual({
      id: 'sess-123',
      model: 'gpt-test',
      client_secret: {
        value: 'secret',
        expires_at: '2025-01-01T00:00:00Z',
      },
      raw: { foo: 'bar' },
    });
  });
});
