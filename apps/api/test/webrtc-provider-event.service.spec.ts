import { Logger } from '@nestjs/common';
import { WebRtcProviderEventService, ProviderEventPayload } from '../src/webrtc/webrtc-provider-event.service';
import { ConversationService } from '../src/conversation/conversation.service';
import { WebRtcSessionService } from '../src/webrtc/webrtc-session.service';

describe('WebRtcProviderEventService', () => {
  let service: WebRtcProviderEventService;
  let conversationService: jest.Mocked<ConversationService>;
  let sessionService: jest.Mocked<WebRtcSessionService>;

  const conversationId = 'conv-test';
  const sessionId = 'sess-test';

  beforeEach(() => {
    conversationService = {
      recordVoiceTurn: jest.fn(),
      applyTokenUsage: jest.fn(),
    } as unknown as jest.Mocked<ConversationService>;

    sessionService = {
      getSession: jest.fn().mockReturnValue({
        id: sessionId,
        conversationId,
      }),
    } as unknown as jest.Mocked<WebRtcSessionService>;

    service = new WebRtcProviderEventService(sessionService, conversationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('records user turns from completed conversation items', () => {
    const events: ProviderEventPayload[] = [
      {
        type: 'conversation.item.created',
        item: {
          id: 'item-user-1',
          type: 'message',
          role: 'user',
          status: 'completed',
          content: [{ text: 'Hello assistant' }],
        },
      } as ProviderEventPayload,
    ];

    service.processEvents(sessionId, events);

    expect(conversationService.recordVoiceTurn).toHaveBeenCalledTimes(1);
    expect(conversationService.recordVoiceTurn).toHaveBeenCalledWith(conversationId, {
      participant: 'user',
      transcript: 'Hello assistant',
      annotations: expect.objectContaining({ providerItemId: 'item-user-1' }),
      durationMillis: undefined,
    });
  });

  it('ignores system conversation items', () => {
    const events: ProviderEventPayload[] = [
      {
        type: 'conversation.item.completed',
        item: {
          id: 'item-system-1',
          type: 'message',
          role: 'system',
          status: 'completed',
          content: [{ text: 'System instructions' }],
        },
      } as ProviderEventPayload,
    ];

    service.processEvents(sessionId, events);

    expect(conversationService.recordVoiceTurn).not.toHaveBeenCalled();
  });

  it('accumulates assistant transcripts from response audio events', () => {
    const events: ProviderEventPayload[] = [
      {
        type: 'response.output_item.added',
        response_id: 'resp-1',
        item: {
          id: 'item-assistant-1',
          type: 'message',
          role: 'assistant',
        },
      } as unknown as ProviderEventPayload,
      {
        type: 'response.audio_transcript.delta',
        response_id: 'resp-1',
        item_id: 'item-assistant-1',
        delta: 'Hello',
      } as unknown as ProviderEventPayload,
      {
        type: 'response.audio_transcript.delta',
        response_id: 'resp-1',
        item_id: 'item-assistant-1',
        delta: ' there',
      } as unknown as ProviderEventPayload,
      {
        type: 'response.audio_transcript.done',
        response_id: 'resp-1',
        item_id: 'item-assistant-1',
        transcript: 'Hello there',
      } as unknown as ProviderEventPayload,
      {
        type: 'response.output_item.done',
        response_id: 'resp-1',
        item_id: 'item-assistant-1',
      } as unknown as ProviderEventPayload,
    ];

    service.processEvents(sessionId, events);

    expect(conversationService.recordVoiceTurn).toHaveBeenCalledTimes(1);
    expect(conversationService.recordVoiceTurn).toHaveBeenCalledWith(conversationId, {
      participant: 'assistant',
      transcript: 'Hello there',
      annotations: expect.objectContaining({ providerItemId: 'item-assistant-1' }),
      durationMillis: undefined,
    });
  });

  it('records user turns from input audio transcription events', () => {
    const events: ProviderEventPayload[] = [
      {
        type: 'input_audio_transcription.delta',
        item_id: 'user-turn-1',
        delta: { text: 'Hi' },
      } as unknown as ProviderEventPayload,
      {
        type: 'input_audio_transcription.done',
        item_id: 'user-turn-1',
        transcript: { text: 'Hi there' },
      } as unknown as ProviderEventPayload,
    ];

    service.processEvents(sessionId, events);

    expect(conversationService.recordVoiceTurn).toHaveBeenCalledTimes(1);
    expect(conversationService.recordVoiceTurn).toHaveBeenCalledWith(conversationId, {
      participant: 'user',
      transcript: 'Hi there',
      annotations: expect.objectContaining({ providerItemId: 'user-turn-1' }),
      durationMillis: undefined,
    });
  });

  it('updates token usage when response.done usage is reported', () => {
    const events: ProviderEventPayload[] = [
      {
        type: 'response.done',
        response: {
          id: 'resp-usage',
          usage: {
            input_audio_tokens: 42,
            output_audio_tokens: 7,
          },
        },
      } as unknown as ProviderEventPayload,
    ];

    service.processEvents(sessionId, events);

    expect(conversationService.applyTokenUsage).toHaveBeenCalledTimes(1);
    expect(conversationService.applyTokenUsage).toHaveBeenCalledWith(conversationId, {
      incoming: 42,
      outgoing: 7,
    });
  });

  it('flushes buffered transcripts when the session is forgotten', () => {
    const events: ProviderEventPayload[] = [
      {
        type: 'response.output_item.added',
        response_id: 'resp-flush',
        item: {
          id: 'item-flush',
          type: 'message',
          role: 'assistant',
        },
      } as unknown as ProviderEventPayload,
      {
        type: 'response.audio_transcript.delta',
        response_id: 'resp-flush',
        item_id: 'item-flush',
        delta: 'Buffer me',
      } as unknown as ProviderEventPayload,
    ];

    service.processEvents(sessionId, events);
    expect(conversationService.recordVoiceTurn).not.toHaveBeenCalled();

    service.forgetSession(sessionId);

    expect(conversationService.recordVoiceTurn).toHaveBeenCalledTimes(1);
    expect(conversationService.recordVoiceTurn).toHaveBeenCalledWith(conversationId, {
      participant: 'assistant',
      transcript: 'Buffer me',
      annotations: expect.objectContaining({ providerItemId: 'item-flush' }),
      durationMillis: undefined,
    });
  });

  it('preserves spacing in delta transcripts when no final transcript arrives', () => {
    const events: ProviderEventPayload[] = [
      {
        type: 'response.output_item.added',
        response_id: 'resp-spaces',
        item: {
          id: 'item-space',
          type: 'message',
          role: 'assistant',
        },
      } as unknown as ProviderEventPayload,
      {
        type: 'response.audio_transcript.delta',
        response_id: 'resp-spaces',
        item_id: 'item-space',
        delta: 'Hello',
      } as unknown as ProviderEventPayload,
      {
        type: 'response.audio_transcript.delta',
        response_id: 'resp-spaces',
        item_id: 'item-space',
        delta: ' there',
      } as unknown as ProviderEventPayload,
    ];

    service.processEvents(sessionId, events);
    service.forgetSession(sessionId);

    expect(conversationService.recordVoiceTurn).toHaveBeenCalledWith(conversationId, {
      participant: 'assistant',
      transcript: 'Hello there',
      annotations: expect.objectContaining({ providerItemId: 'item-space' }),
      durationMillis: undefined,
    });
  });

  it('does not write transcript text into provider event debug logs', () => {
    const debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    const sensitiveTranscript = 'sensitive student transcript';
    const events: ProviderEventPayload[] = [
      {
        type: 'input_audio_transcription.done',
        item_id: 'user-turn-sensitive',
        transcript: { text: sensitiveTranscript },
      } as unknown as ProviderEventPayload,
    ];

    try {
      service.processEvents(sessionId, events);
      const loggedText = debugSpy.mock.calls
        .map((call) => call.map((part) => String(part)).join(' '))
        .join('\n');
      expect(loggedText).not.toContain(sensitiveTranscript);
    } finally {
      debugSpy.mockRestore();
    }
  });
});
