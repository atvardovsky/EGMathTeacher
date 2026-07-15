import { BadRequestException } from '@nestjs/common';
import { WebRtcController } from '../src/webrtc/webrtc.controller';
import { ConversationService } from '../src/conversation/conversation.service';
import { WebRtcSessionService, WebRtcSession } from '../src/webrtc/webrtc-session.service';
import { WebRtcSignalingService } from '../src/webrtc/webrtc-signaling.service';
import { WebRtcAuthService, RealtimeEphemeralToken } from '../src/webrtc/webrtc-auth.service';
import { WebRtcMediaService } from '../src/webrtc/webrtc-media.service';
import { AuthService } from '../src/auth/auth.service';
import { UsageService } from '../src/usage/usage.service';
import { DatabaseService } from '../src/database/database.service';

const createSession = (overrides: Partial<WebRtcSession> = {}): WebRtcSession => ({
  id: 'sess-123',
  conversationId: 'conv-abc',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  status: 'pending',
  preferredVoice: 'alloy',
  signaling: {
    clientIceCandidates: [],
    serverIceCandidates: [],
  },
  ...overrides,
});

describe('WebRtcController', () => {
  let controller: WebRtcController;
  let conversationService: jest.Mocked<ConversationService>;
  let sessionService: jest.Mocked<WebRtcSessionService>;
  let signalingService: jest.Mocked<WebRtcSignalingService>;
  let authService: jest.Mocked<WebRtcAuthService>;
  let mediaService: jest.Mocked<WebRtcMediaService>;
  let appAuthService: jest.Mocked<AuthService>;
  let usageService: jest.Mocked<UsageService>;
  let db: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    conversationService = {
      initializeConversation: jest.fn(),
      getHistory: jest.fn().mockReturnValue([]),
      getConversationRecord: jest.fn(),
      getFinalTranscriptFile: jest.fn(),
      getFinalTranscript: jest.fn(),
      recordVoiceTurn: jest.fn(),
      applyTokenUsage: jest.fn(),
    } as unknown as jest.Mocked<ConversationService>;

    sessionService = {
      createSession: jest.fn().mockReturnValue(createSession()),
      assertCapacity: jest.fn(),
      getSession: jest.fn().mockReturnValue(createSession()),
      drainClientIceCandidates: jest.fn(),
      drainServerIceCandidates: jest.fn(),
      getSignalingState: jest.fn(),
      getTranscriptForSession: jest.fn(),
      closeSession: jest.fn(),
      setPreferredVoice: jest.fn(),
      setTranslationConfig: jest.fn(),
      getTranslationConfig: jest.fn().mockReturnValue(undefined),
    } as unknown as jest.Mocked<WebRtcSessionService>;

    signalingService = {
      buildBootstrapPayload: jest.fn().mockReturnValue({
        sessionId: 'sess-123',
        conversationId: 'conv-abc',
        iceServers: [],
        openaiRealtimeModel: 'gpt-4o-realtime-preview',
        personality: {
          name: 'EGE Math Tutor',
          description: 'Helpful',
          tone: 'calm',
          locale: 'ru-RU',
          rules: 'Stay helpful.',
        },
        fileSearch: { documentationIds: [], ruleIds: [] },
        voices: { default: 'alloy', available: ['alloy'] },
      }),
      getPersonalityConfig: jest.fn().mockReturnValue({
        name: 'EGE Math Tutor',
        description: 'Helpful',
        tone: 'calm',
        locale: 'ru-RU',
        rules: 'Stay helpful.',
      }),
      getVoiceConfig: jest.fn().mockReturnValue({
        default: 'alloy',
        available: ['alloy', 'verse'],
      }),
      getFileSearchConfig: jest.fn().mockReturnValue({
        documentationIds: [],
        ruleIds: [],
      }),
      getIceServers: jest.fn(),
      getRealtimeModel: jest.fn().mockReturnValue('gpt-4o-realtime-preview'),
      applyTranslationConfig: jest.fn((personality) => personality),
    } as unknown as jest.Mocked<WebRtcSignalingService>;

    authService = {
      createEphemeralToken: jest.fn().mockResolvedValue({
        id: 'token-1',
        model: 'gpt-4o-realtime-preview',
        client_secret: { value: 'secret', expires_at: new Date().toISOString() },
        raw: {},
      } as RealtimeEphemeralToken),
    } as unknown as jest.Mocked<WebRtcAuthService>;

    mediaService = {
      handleClientOffer: jest.fn(),
      noteServerAnswer: jest.fn(),
      queueClientIceCandidate: jest.fn(),
      queueServerIceCandidate: jest.fn(),
      closeSession: jest.fn().mockResolvedValue(undefined),
      ingestProviderEvents: jest.fn(),
    } as unknown as jest.Mocked<WebRtcMediaService>;

    appAuthService = {
      getSessionFromRequest: jest.fn().mockReturnValue(undefined),
    } as unknown as jest.Mocked<AuthService>;

    usageService = {
      recordRealtimeSession: jest.fn(),
    } as unknown as jest.Mocked<UsageService>;

    db = {
      get: jest.fn(),
    } as unknown as jest.Mocked<DatabaseService>;

    controller = new WebRtcController(
      conversationService,
      sessionService,
      signalingService,
      authService,
      mediaService,
      appAuthService,
      usageService,
      db,
    );
  });

  describe('startSession', () => {
    it('attaches signed-in lesson metadata when the lesson belongs to the user', () => {
      appAuthService.getSessionFromRequest.mockReturnValue({
        id: 'student-1',
        name: 'Маша',
        role: 'student',
        createdAt: '2026-07-15T10:00:00.000Z',
        iat: 1,
        exp: 2,
      });
      db.get.mockReturnValue({
        id: 'lesson-1',
        conversation_id: 'conv-abc',
        lesson_type: 'practice',
        status: 'active',
      });

      controller.startSession(
        {
          conversationSeed: 'conv-abc',
          lessonSessionId: 'lesson-1',
          lessonType: 'practice',
        },
        { headers: { cookie: 'egmathteacher_session=test' } } as any,
      );

      expect(sessionService.createSession).toHaveBeenCalledWith('conv-abc', {
        userId: 'student-1',
        lessonSessionId: 'lesson-1',
        lessonType: 'practice',
      });
    });
  });

  describe('createEphemeralToken', () => {
    it('rejects unsupported voices', async () => {
      await expect(
        controller.createEphemeralToken('sess-123', { voice: 'unknown' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(authService.createEphemeralToken).not.toHaveBeenCalled();
    });

    it('uses default voice when none provided', async () => {
      await controller.createEphemeralToken('sess-123', {});

      expect(authService.createEphemeralToken).toHaveBeenCalledWith(
        expect.objectContaining({
          voice: 'alloy',
        }),
      );
    });

    it('passes through locale override when provided', async () => {
      await controller.createEphemeralToken('sess-123', { locale: 'en-GB', voice: 'verse' });

      expect(authService.createEphemeralToken).toHaveBeenCalledWith(
        expect.objectContaining({
          voice: 'verse',
          personality: expect.objectContaining({ locale: 'en-GB' }),
        }),
      );
    });
  });

  describe('ingestProviderEvents', () => {
    it('forwards events to the media service when provided', async () => {
      await controller.ingestProviderEvents('sess-123', {
        events: [{ type: 'conversation.item.created' } as any],
      });

      expect(mediaService.ingestProviderEvents).toHaveBeenCalledWith('sess-123', [
        { type: 'conversation.item.created' },
      ]);
    });

    it('ignores empty event batches', async () => {
      await controller.ingestProviderEvents('sess-123', { events: [] });

      expect(mediaService.ingestProviderEvents).not.toHaveBeenCalled();
    });
  });

  describe('closeSession', () => {
    it('records realtime usage when a signed-in session closes', async () => {
      const session = createSession({
        userId: 'student-1',
        lessonSessionId: 'lesson-1',
        lessonType: 'tutor',
        createdAt: Date.now() - 10_000,
        status: 'active',
      });
      sessionService.getSession.mockReturnValue(session);
      mediaService.closeSession.mockImplementation(async () => {
        session.status = 'closed';
        session.updatedAt = Date.now();
        session.finalizedAt = session.updatedAt;
        return '1. Caller: привет\n2. Assistant: привет';
      });
      conversationService.getConversationRecord.mockReturnValue({
        id: 'conv-abc',
        tokenUsage: { incoming: 42, outgoing: 21 },
        turns: [{ participant: 'user' }, { participant: 'assistant' }],
      } as any);

      await controller.closeSession('sess-123');

      expect(usageService.recordRealtimeSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'student-1',
          conversationId: 'conv-abc',
          lessonSessionId: 'lesson-1',
          lessonType: 'tutor',
          sessionId: 'sess-123',
          model: 'gpt-4o-realtime-preview',
          inputTokens: 42,
          outputTokens: 21,
          turnCount: 2,
        }),
      );
    });
  });
});
