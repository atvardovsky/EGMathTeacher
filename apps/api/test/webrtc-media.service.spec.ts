import { ConfigService } from '@nestjs/config';
import { TutorService } from '../src/tutor/tutor.service';
import type { TutorAnswer } from '../src/tutor/tutor.types';
import { OpenAiRealtimeBridgeService } from '../src/webrtc/openai-realtime-bridge.service';
import { WebRtcMediaService } from '../src/webrtc/webrtc-media.service';
import { WebRtcProviderEventService } from '../src/webrtc/webrtc-provider-event.service';
import { WebRtcSession, WebRtcSessionService } from '../src/webrtc/webrtc-session.service';
import { WebRtcSignalingService } from '../src/webrtc/webrtc-signaling.service';

const createSession = (overrides: Partial<WebRtcSession> = {}): WebRtcSession => ({
  id: 'rtc-1',
  conversationId: 'conv-1',
  userId: 'student-1',
  userName: 'Маша',
  userRole: 'student',
  userCreatedAt: '2026-07-15T10:00:00.000Z',
  lessonSessionId: 'lesson-1',
  lessonType: 'practice',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  status: 'active',
  signaling: {
    clientIceCandidates: [],
    serverIceCandidates: [],
  },
  ...overrides,
});

const createAnswer = (overrides: Partial<TutorAnswer> = {}): TutorAnswer => ({
  turnId: 'turn-1',
  conversationId: 'conv-1',
  lessonType: 'practice',
  lessonLifecycle: {
    lessonSessionId: 'lesson-1',
    conversationId: 'conv-1',
    lessonType: 'practice',
    status: 'active',
    goalStatus: 'in_progress',
    goalStatusEvidence: 'none',
    goalEvidenceLevel: 'attempt_submitted',
    lessonGoal: 'Practice a skill.',
    successCriteria: ['Submit an attempt'],
    turnCount: 1,
    activeLearningSeconds: 30,
    dayActiveLearningSeconds: 30,
    dailyLimit: {
      status: 'ok',
      softLimitSeconds: 5400,
      hardLimitSeconds: 7200,
      usedSeconds: 30,
      remainingSeconds: 7170,
    },
    continuousLimit: {
      status: 'ok',
      softLimitSeconds: 2700,
      hardLimitSeconds: 3600,
      usedSeconds: 30,
      remainingSeconds: 3570,
    },
    shouldSuggestBreak: false,
    shouldStop: false,
    strategySignal: {
      direction: 'unknown',
      summary: 'No signal yet.',
      recommendedAdjustment: 'Continue.',
    },
  },
  answer: 'Разберем коротко.',
  blocks: [{ id: 'block-1', type: 'text', text: 'Разберем коротко.' }],
  tasks: [],
  examples: [],
  needsImage: false,
  citations: [],
  ...overrides,
});

describe('WebRtcMediaService lesson data channel', () => {
  let service: WebRtcMediaService;
  let session: WebRtcSession;
  let sessionService: jest.Mocked<WebRtcSessionService>;
  let bridgeService: jest.Mocked<OpenAiRealtimeBridgeService>;
  let tutorService: jest.Mocked<TutorService>;

  beforeEach(() => {
    session = createSession();
    sessionService = {
      touchSession: jest.fn(() => session),
      getSession: jest.fn(() => session),
      recordClientOffer: jest.fn(),
      recordServerAnswer: jest.fn(),
      activateSession: jest.fn(),
      enqueueClientIceCandidate: jest.fn(),
      enqueueServerIceCandidate: jest.fn(),
      listSessions: jest.fn(() => []),
      closeSession: jest.fn(),
      getTranslationConfig: jest.fn(),
      getPreferredVoice: jest.fn(),
    } as unknown as jest.Mocked<WebRtcSessionService>;
    bridgeService = {
      handleClientOffer: jest.fn(),
      addClientIceCandidate: jest.fn(),
      closeSession: jest.fn(),
    } as unknown as jest.Mocked<OpenAiRealtimeBridgeService>;
    const signalingService = {
      getPersonalityConfig: jest.fn(),
      applyTranslationConfig: jest.fn((personality) => personality),
      getVoiceConfig: jest.fn(() => ({ default: 'alloy', available: ['alloy'] })),
      getFileSearchConfig: jest.fn(() => ({ documentationIds: [], ruleIds: [] })),
      getRealtimeModel: jest.fn(() => 'gpt-4o-realtime-preview'),
    } as unknown as jest.Mocked<WebRtcSignalingService>;
    const eventService = {
      processEvents: jest.fn(),
      forgetSession: jest.fn(),
    } as unknown as jest.Mocked<WebRtcProviderEventService>;
    tutorService = {
      answerMessage: jest.fn().mockResolvedValue(createAnswer()),
    } as unknown as jest.Mocked<TutorService>;
    const configService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    service = new WebRtcMediaService(
      sessionService,
      bridgeService,
      signalingService,
      eventService,
      tutorService,
      configService,
    );
  });

  it('acknowledges lesson data-channel heartbeats and touches the session', async () => {
    const result = await service.handleLessonDataMessage('rtc-1', {
      type: 'heartbeat',
      sentAt: 1,
    });

    expect(sessionService.touchSession).toHaveBeenCalledWith('rtc-1');
    expect(result).toMatchObject({
      type: 'heartbeat_ack',
      sessionId: 'rtc-1',
      receivedAt: expect.any(Number),
    });
  });

  it('routes student_text events through TutorService with authenticated metadata', async () => {
    const result = await service.handleLessonDataMessage('rtc-1', {
      type: 'student_text',
      requestId: 'req-12345678',
      message: 'Решим 2x + 3 = 15',
      lessonType: 'practice',
      source: 'text',
    });

    expect(tutorService.answerMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({
          id: 'student-1',
          name: 'Маша',
          role: 'student',
          createdAt: '2026-07-15T10:00:00.000Z',
        }),
        message: 'Решим 2x + 3 = 15',
        conversationId: 'conv-1',
        requestId: 'req-12345678',
        source: 'text',
        lessonType: 'practice',
      }),
    );
    expect(result).toMatchObject({
      type: 'tutor_answer',
      requestId: 'req-12345678',
      conversationId: 'conv-1',
      lessonSessionId: 'lesson-1',
      lessonType: 'practice',
      terminal: false,
      turn: {
        id: 'turn-1',
        prompt: 'Решим 2x + 3 = 15',
        source: 'text',
      },
    });
  });

  it('rejects lesson messages when the WebRTC session has no signed-in user', async () => {
    session.userId = undefined;

    const result = await service.handleLessonDataMessage('rtc-1', {
      type: 'student_text',
      requestId: 'req-unauth',
      message: 'Привет',
    });

    expect(tutorService.answerMessage).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      type: 'error',
      requestId: 'req-unauth',
      code: 'auth_required',
    });
  });
});
