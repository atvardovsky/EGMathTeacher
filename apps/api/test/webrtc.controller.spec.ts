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
import { TeachingContextService } from '../src/teaching-context/teaching-context.service';
import { BackgroundAiService } from '../src/background-ai/background-ai.service';
import { LessonService } from '../src/lesson/lesson.service';
import type { LessonLifecycleDto } from '../src/lesson/lesson.types';

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
  let teachingContextService: jest.Mocked<TeachingContextService>;
  let backgroundAiService: jest.Mocked<BackgroundAiService>;
  let lessonService: jest.Mocked<LessonService>;

  const createLifecycle = (overrides: Partial<LessonLifecycleDto> = {}): LessonLifecycleDto => ({
    lessonSessionId: 'lesson-1',
    conversationId: 'conv-abc',
    lessonType: 'tutor',
    status: 'active',
    goalStatus: 'in_progress',
    goalStatusEvidence: 'none',
    goalEvidenceLevel: 'none',
    lessonGoal: 'Продолжить урок.',
    successCriteria: ['есть голосовая стенограмма'],
    turnCount: 1,
    activeLearningSeconds: 10,
    dayActiveLearningSeconds: 10,
    dailyLimit: {
      status: 'ok',
      softLimitSeconds: 5400,
      hardLimitSeconds: 7200,
      usedSeconds: 10,
      remainingSeconds: 7190,
    },
    continuousLimit: {
      status: 'ok',
      softLimitSeconds: 2700,
      hardLimitSeconds: 3600,
      usedSeconds: 10,
      remainingSeconds: 3590,
    },
    shouldSuggestBreak: false,
    shouldStop: false,
    strategySignal: {
      direction: 'unknown',
      summary: 'Нет сигналов.',
      recommendedAdjustment: 'Продолжать короткими шагами.',
    },
    ...overrides,
  });

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
      getLessonUsageSnapshot: jest.fn().mockReturnValue({
        currency: 'USD',
        lesson: {
          estimatedCostUsd: 0,
          inputTokens: 0,
          cachedInputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          imageCount: 0,
          pricingConfigured: true,
        },
        today: {
          estimatedCostUsd: 0,
          inputTokens: 0,
          cachedInputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          imageCount: 0,
          pricingConfigured: true,
        },
      }),
    } as unknown as jest.Mocked<UsageService>;

    db = {
      get: jest.fn(),
      run: jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
    } as unknown as jest.Mocked<DatabaseService>;

    teachingContextService = {
      buildRealtimeTeachingContext: jest.fn(),
    } as unknown as jest.Mocked<TeachingContextService>;

    backgroundAiService = {
      enqueueRealtimeSessionReview: jest.fn(),
      enqueueLessonClosureReview: jest.fn(),
    } as unknown as jest.Mocked<BackgroundAiService>;

    lessonService = {
      ensureRealtimeSessionWithTransitions: jest.fn().mockReturnValue({
        lifecycle: createLifecycle(),
        closedSessions: [],
        created: true,
      }),
      completeRealtimeTurn: jest.fn().mockReturnValue(createLifecycle()),
    } as unknown as jest.Mocked<LessonService>;

    controller = new WebRtcController(
      conversationService,
      sessionService,
      signalingService,
      authService,
      mediaService,
      appAuthService,
      usageService,
      db,
      teachingContextService,
      backgroundAiService,
      lessonService,
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

    it('attaches server-only teaching context to signed-in realtime sessions', () => {
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
        lesson_type: 'tutor',
        status: 'active',
      });
      teachingContextService.buildRealtimeTeachingContext.mockReturnValue({
        prompt: 'Server teaching context.',
        lessonSessionId: 'lesson-1',
        lessonType: 'tutor',
        reviewContext: { strategyHints: ['пример перед правилом'] },
      });

      controller.startSession(
        {
          conversationSeed: 'conv-abc',
          lessonSessionId: 'lesson-1',
          lessonType: 'tutor',
        },
        { headers: { cookie: 'egmathteacher_session=test' } } as any,
      );

      expect(sessionService.createSession).toHaveBeenCalledWith(
        'conv-abc',
        expect.objectContaining({
          userId: 'student-1',
          lessonSessionId: 'lesson-1',
          lessonType: 'tutor',
          teachingContext: expect.objectContaining({
            prompt: 'Server teaching context.',
          }),
        }),
      );
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

    it('adds teaching context rules to direct realtime token creation', async () => {
      sessionService.getSession.mockReturnValue(
        createSession({
          teachingContext: {
            prompt: 'Server teaching context for token.',
            reviewContext: {},
          },
        }),
      );

      await controller.createEphemeralToken('sess-123', {});

      expect(authService.createEphemeralToken).toHaveBeenCalledWith(
        expect.objectContaining({
          personality: expect.objectContaining({
            rules: expect.stringContaining('Server teaching context for token.'),
          }),
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
    it('records realtime usage and syncs a signed-in voice transcript into lesson history', async () => {
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
        turns: [
          { participant: 'user', transcript: 'решим уравнение', timestamp: Date.now() },
          { participant: 'assistant', transcript: 'начнем с переноса 3', timestamp: Date.now() },
        ],
      } as any);

      const result = await controller.closeSession('sess-123');

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
      expect(backgroundAiService.enqueueRealtimeSessionReview).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'student-1',
          conversationId: 'conv-abc',
          lessonSessionId: 'lesson-1',
          lessonType: 'tutor',
          transcript: '1. Caller: привет\n2. Assistant: привет',
          tokenUsage: { incoming: 42, outgoing: 21 },
        }),
      );
      expect(lessonService.completeRealtimeTurn).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'student-1',
          lessonSessionId: 'lesson-1',
        }),
      );
      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tutor_turns'),
        expect.arrayContaining([
          expect.any(String),
          'student-1',
          'conv-abc',
          'webrtc:sess-123',
          'tutor',
          expect.stringContaining('решим уравнение'),
        ]),
      );
      expect(result.syncedTurn).toMatchObject({
        source: 'voice',
        prompt: expect.stringContaining('решим уравнение'),
        answer: expect.objectContaining({
          answer: expect.stringContaining('начнем с переноса 3'),
        }),
      });
    });

    it('creates a lesson boundary on close when realtime started without an active lesson', async () => {
      const session = createSession({
        userId: 'student-1',
        lessonType: 'practice',
        createdAt: Date.now() - 10_000,
        status: 'active',
      });
      sessionService.getSession.mockReturnValue(session);
      mediaService.closeSession.mockImplementation(async () => {
        session.status = 'closed';
        session.updatedAt = Date.now();
        session.finalizedAt = session.updatedAt;
        return '1. Caller: хочу практику\n2. Assistant: дам короткую задачу';
      });
      conversationService.getConversationRecord.mockReturnValue({
        id: 'conv-abc',
        tokenUsage: { incoming: 5, outgoing: 7 },
        turns: [
          { participant: 'user', transcript: 'хочу практику', timestamp: Date.now() },
          { participant: 'assistant', transcript: 'дам короткую задачу', timestamp: Date.now() },
        ],
      } as any);
      lessonService.ensureRealtimeSessionWithTransitions.mockReturnValue({
        lifecycle: createLifecycle({ lessonType: 'practice' }),
        closedSessions: [],
        created: true,
      });
      lessonService.completeRealtimeTurn.mockReturnValue(createLifecycle({ lessonType: 'practice' }));

      const result = await controller.closeSession('sess-123');

      expect(lessonService.ensureRealtimeSessionWithTransitions).toHaveBeenCalledWith({
        userId: 'student-1',
        conversationId: 'conv-abc',
        lessonType: 'practice',
      });
      expect(result.lessonSessionId).toBe('lesson-1');
      expect(result.lessonType).toBe('practice');
    });
  });
});
