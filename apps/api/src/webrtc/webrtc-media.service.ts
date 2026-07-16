import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { AuthSession } from '../auth/auth.types';
import { TutorService } from '../tutor/tutor.service';
import type { LessonType, TutorLessonHistoryTurn } from '../tutor/tutor.types';
import { WebRtcSessionService } from './webrtc-session.service';
import { WebRtcSignalingService } from './webrtc-signaling.service';
import { OpenAiRealtimeBridgeService, BridgeSessionOptions } from './openai-realtime-bridge.service';
import { ProviderEventPayload, WebRtcProviderEventService } from './webrtc-provider-event.service';
import {
  WebRtcLessonClientEvent,
  WebRtcLessonServerEvent,
} from './webrtc-lesson-events';

const TERMINAL_LESSON_STATUSES = new Set<string>([
  'hard_limit_reached',
  'goal_reached',
  'finished',
]);

@Injectable()
export class WebRtcMediaService {
  private readonly logger = new Logger(WebRtcMediaService.name);
  private idleCleanupInterval?: NodeJS.Timeout;
  private readonly sessionIdleTimeoutMs: number;
  private readonly idleSweepIntervalMs: number;

  constructor(
    private readonly sessionService: WebRtcSessionService,
    private readonly bridgeService: OpenAiRealtimeBridgeService,
    private readonly signalingService: WebRtcSignalingService,
    private readonly eventService: WebRtcProviderEventService,
    private readonly tutorService: TutorService,
    configService: ConfigService,
  ) {
    this.sessionIdleTimeoutMs =
      configService.get<number>('webrtc.sessionIdleTimeoutMs') ?? 5 * 60 * 1000;
    this.idleSweepIntervalMs =
      configService.get<number>('webrtc.sessionIdleSweepIntervalMs') ?? 60 * 1000;
  }

  async handleClientOffer(sessionId: string, sdp: string): Promise<{ sdp: string }> {
    this.startIdleCleanup();
    this.sessionService.recordClientOffer(sessionId, sdp);
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const bridgeOptions = this.buildBridgeOptions(sessionId, session.conversationId);
    const answer = await this.bridgeService.handleClientOffer(bridgeOptions, sdp);
    this.sessionService.recordServerAnswer(sessionId, answer.sdp);
    this.sessionService.activateSession(sessionId);
    this.logger.debug(`Bridged SDP answer for session ${sessionId} via Node realtime bridge.`);
    return answer;
  }

  async noteServerAnswer(sessionId: string, sdp: string): Promise<void> {
    this.logger.debug(`Server answer acknowledged for session ${sessionId}.`);
    this.sessionService.recordServerAnswer(sessionId, sdp);
  }

  async queueClientIceCandidate(sessionId: string, candidate: string): Promise<void> {
    this.logger.debug(`Received client ICE candidate for session ${sessionId}: ${candidate}`);
    this.sessionService.enqueueClientIceCandidate(sessionId, candidate);
    await this.bridgeService.addClientIceCandidate(sessionId, candidate);
  }

  async queueServerIceCandidate(sessionId: string, candidate: string): Promise<void> {
    this.logger.debug(`Queueing server ICE candidate for session ${sessionId}: ${candidate}`);
    this.sessionService.enqueueServerIceCandidate(sessionId, candidate);
  }

  async closeSession(sessionId: string): Promise<string | undefined> {
    await this.bridgeService.closeSession(sessionId);

    const transcript = this.sessionService.closeSession(sessionId);
    this.eventService.forgetSession(sessionId);
    return transcript;
  }

  ingestProviderEvents(sessionId: string, events: ProviderEventPayload[]): void {
    this.eventService.processEvents(sessionId, events);
  }

  async handleLessonDataMessage(
    sessionId: string,
    event: WebRtcLessonClientEvent,
  ): Promise<WebRtcLessonServerEvent | undefined> {
    const session = this.sessionService.touchSession(sessionId);
    if (!session || session.status === 'closed') {
      return {
        type: 'error',
        code: 'session_closed',
        message: 'WebRTC lesson session is closed.',
      };
    }

    switch (event.type) {
      case 'client_ready':
        return {
          type: 'session_ready',
          sessionId: session.id,
          conversationId: session.conversationId,
          lessonSessionId: session.lessonSessionId,
          lessonType: this.normalizeLessonType(session.lessonType),
        };
      case 'heartbeat':
        return {
          type: 'heartbeat_ack',
          sessionId,
          receivedAt: Date.now(),
        };
      case 'student_text':
        return this.handleStudentTextEvent(session.id, event);
      default:
        return {
          type: 'error',
          code: 'unsupported_event',
          message: 'Unsupported lesson data channel event.',
        };
    }
  }

  private startIdleCleanup(): void {
    if (this.idleCleanupInterval) {
      return;
    }
    const interval = setInterval(
      () => void this.cleanupIdleSessions(),
      this.idleSweepIntervalMs,
    );
    interval.unref?.();
    this.idleCleanupInterval = interval;
  }

  private async cleanupIdleSessions(): Promise<void> {
    const now = Date.now();
    const idleSessions = this.sessionService
      .listSessions()
      .filter(
        (session) =>
          session.status !== 'closed' &&
          now - session.updatedAt >= this.sessionIdleTimeoutMs,
      );

    for (const session of idleSessions) {
      try {
        this.logger.warn(
          `Closing idle WebRTC session ${session.id} (age ${now - session.updatedAt}ms).`,
        );
        await this.closeSession(session.id);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to close idle session ${session.id}: ${reason}`);
      }
    }
  }

  private async handleStudentTextEvent(
    sessionId: string,
    event: Extract<WebRtcLessonClientEvent, { type: 'student_text' }>,
  ): Promise<WebRtcLessonServerEvent> {
    const session = this.sessionService.getSession(sessionId);
    if (!session || session.status === 'closed') {
      return {
        type: 'error',
        requestId: event.requestId,
        code: 'session_closed',
        message: 'WebRTC lesson session is closed.',
      };
    }
    if (!session.userId) {
      return {
        type: 'error',
        requestId: event.requestId,
        code: 'auth_required',
        message: 'Authenticated user metadata is required for lesson messages.',
      };
    }

    const message = event.message?.trim();
    if (!message) {
      return {
        type: 'error',
        requestId: event.requestId,
        code: 'empty_message',
        message: 'Message is required.',
      };
    }

    try {
      const requestId = event.requestId?.trim() || randomUUID();
      const source = event.source === 'voice' ? 'voice' : 'text';
      const answer = await this.tutorService.answerMessage({
        user: this.buildAuthSession(session),
        message,
        conversationId: session.conversationId,
        requestId,
        source,
        lessonType: event.lessonType ?? this.normalizeLessonType(session.lessonType),
      });
      session.conversationId = answer.conversationId;
      session.lessonSessionId = answer.lessonLifecycle.lessonSessionId;
      session.lessonType = answer.lessonType;
      if (event.origin === 'realtime_transcript') {
        session.structuredRealtimeTurnCount = (session.structuredRealtimeTurnCount ?? 0) + 1;
      }
      this.sessionService.touchSession(session.id);

      const turn: TutorLessonHistoryTurn = {
        id: answer.turnId ?? requestId,
        prompt: message,
        lessonType: answer.lessonType,
        source,
        answer,
        createdAt: new Date().toISOString(),
      };

      return {
        type: 'tutor_answer',
        requestId,
        turn,
        answer,
        conversationId: answer.conversationId,
        lessonSessionId: answer.lessonLifecycle.lessonSessionId,
        lessonType: answer.lessonType,
        terminal: TERMINAL_LESSON_STATUSES.has(answer.lessonLifecycle.status),
      };
    } catch (error) {
      return {
        type: 'error',
        requestId: event.requestId,
        code: 'tutor_failed',
        message: error instanceof Error ? error.message : 'Tutor message failed.',
      };
    }
  }

  private buildAuthSession(session: {
    userId?: string;
    userName?: string;
    userRole?: AuthSession['role'];
    userCreatedAt?: string;
    createdAt: number;
  }): AuthSession {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return {
      id: session.userId!,
      name: session.userName ?? 'Student',
      role: session.userRole ?? 'student',
      createdAt: session.userCreatedAt ?? new Date(session.createdAt).toISOString(),
      iat: nowSeconds,
      exp: nowSeconds + 60 * 60,
    };
  }

  private normalizeLessonType(value: string | undefined): LessonType | undefined {
    const normalized = value?.trim();
    const allowed = new Set<LessonType>([
      'meeting',
      'tutor',
      'concept',
      'practice',
      'diagnostic',
      'exam_strategy',
      'mistake_review',
      'visual_explanation',
      'reflection',
    ]);
    return normalized && allowed.has(normalized as LessonType)
      ? (normalized as LessonType)
      : undefined;
  }

  private buildBridgeOptions(sessionId: string, conversationId: string): BridgeSessionOptions {
    const session = this.sessionService.getSession(sessionId);
    const translation = this.sessionService.getTranslationConfig(sessionId);
    const persona = this.signalingService.applyTranslationConfig(
      this.signalingService.getPersonalityConfig(),
      translation,
    );
    const voiceConfig = this.signalingService.getVoiceConfig();
    const preferredVoice = this.sessionService.getPreferredVoice(sessionId) ?? voiceConfig.default;

    return {
      sessionId,
      conversationId,
      lessonSessionId: session?.lessonSessionId,
      lessonType: this.normalizeLessonType(session?.lessonType),
      persona,
      voice: preferredVoice,
      fileSearch: this.signalingService.getFileSearchConfig(),
      realtimeModel: this.signalingService.getRealtimeModel(),
      translatorMode: Boolean(translation),
      teachingContextPrompt: session?.teachingContext?.prompt,
      onClientDataMessage: (_context, event) =>
        this.handleLessonDataMessage(sessionId, event),
      onServerIceCandidate: (candidate: string) => {
        this.sessionService.enqueueServerIceCandidate(sessionId, candidate);
      },
    };
  }
}
