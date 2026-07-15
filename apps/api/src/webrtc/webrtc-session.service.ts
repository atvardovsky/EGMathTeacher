import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { ConversationService } from '../conversation/conversation.service';
import { TranslationConfig } from './webrtc-signaling.service';

export interface WebRtcSession {
  id: string;
  conversationId: string;
  userId?: string;
  lessonSessionId?: string;
  lessonType?: string;
  createdAt: number;
  updatedAt: number;
  status: 'pending' | 'active' | 'closed';
  finalizedAt?: number;
  preferredVoice?: string;
  translation?: TranslationConfig;
  signaling: {
    clientOffer?: string;
    serverAnswer?: string;
    clientIceCandidates: string[];
    serverIceCandidates: string[];
  };
}

export interface WebRtcSessionMetadata {
  userId?: string;
  lessonSessionId?: string;
  lessonType?: string;
}

@Injectable()
export class WebRtcSessionService implements OnModuleDestroy {
  private readonly logger = new Logger(WebRtcSessionService.name);
  private readonly sessions = new Map<string, WebRtcSession>();
  private readonly maxConcurrentSessions: number;
  private readonly cleanupInterval?: NodeJS.Timeout;
  private static readonly CLEANUP_INTERVAL_MS = 60_000;

  constructor(
    private readonly conversationService: ConversationService,
    private readonly configService: ConfigService,
  ) {
    this.maxConcurrentSessions =
      this.configService.get<number>('webrtc.maxConcurrentSessions') ?? 25;
    this.cleanupInterval = setInterval(
      () => this.cleanupClosedSessions(),
      WebRtcSessionService.CLEANUP_INTERVAL_MS,
    );
    // Allow Node to exit even if the interval is active.
    this.cleanupInterval.unref?.();
  }

  createSession(
    conversationId: string,
    metadata: WebRtcSessionMetadata = {},
  ): WebRtcSession {
    this.assertCapacity();

    const session: WebRtcSession = {
      id: randomUUID(),
      conversationId,
      userId: metadata.userId,
      lessonSessionId: metadata.lessonSessionId,
      lessonType: metadata.lessonType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'pending',
      signaling: {
        clientIceCandidates: [],
        serverIceCandidates: [],
      },
    };

    this.sessions.set(session.id, session);
    this.logger.debug(`Created WebRTC session ${session.id} for ${conversationId}.`);
    return session;
  }

  activateSession(sessionId: string): WebRtcSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    session.status = 'active';
    session.updatedAt = Date.now();
    this.logger.debug(`Activated WebRTC session ${sessionId}.`);
    return session;
  }

  closeSession(sessionId: string): string | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    session.status = 'closed';
    session.updatedAt = Date.now();
    session.finalizedAt = session.updatedAt;
    const transcript = this.conversationService.finalizeConversation(session.conversationId);

    if (transcript) {
      const filePath = this.conversationService.getFinalTranscriptFile(session.conversationId);
      this.logger.debug(
        `Closed WebRTC session ${sessionId} and archived transcript for ${session.conversationId} (${filePath}).`,
      );
    } else {
      this.logger.warn(
        `Closed WebRTC session ${sessionId} but no transcript was produced for ${session.conversationId}.`,
      );
    }

    return transcript;
  }

  getSession(sessionId: string): WebRtcSession | undefined {
    return this.sessions.get(sessionId);
  }

  listSessions(): WebRtcSession[] {
    return Array.from(this.sessions.values());
  }

  getTranscriptForSession(sessionId: string): string | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    return this.conversationService.getFinalTranscript(session.conversationId);
  }

  canCreateSession(): boolean {
    if (this.maxConcurrentSessions <= 0) {
      return true;
    }

    const openSessions = this.countOpenSessions();
    return openSessions < this.maxConcurrentSessions;
  }

  assertCapacity(): void {
    if (!this.canCreateSession()) {
      const message = `Maximum concurrent WebRTC sessions (${this.maxConcurrentSessions}) reached`;
      this.logger.warn(message);
      throw new Error(message);
    }
  }

  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  private countOpenSessions(): number {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.status !== 'closed') {
        count += 1;
      }
    }
    return count;
  }

  recordClientOffer(sessionId: string, sdp: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.signaling.clientOffer = sdp;
    session.updatedAt = Date.now();
    this.logger.debug(`Stored client offer for session ${sessionId}.`);
  }

  recordServerAnswer(sessionId: string, sdp: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.signaling.serverAnswer = sdp;
    session.updatedAt = Date.now();
    this.logger.debug(`Stored server answer for session ${sessionId}.`);
  }

  setPreferredVoice(sessionId: string, voice: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.preferredVoice = voice;
    session.updatedAt = Date.now();
  }

  getPreferredVoice(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.preferredVoice;
  }

  setTranslationConfig(sessionId: string, translation?: TranslationConfig): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    if (!translation) {
      session.translation = undefined;
    } else {
      session.translation = translation;
    }
    session.updatedAt = Date.now();
  }

  getTranslationConfig(sessionId: string): TranslationConfig | undefined {
    return this.sessions.get(sessionId)?.translation;
  }

  enqueueClientIceCandidate(sessionId: string, candidate: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.signaling.clientIceCandidates.push(candidate);
    session.updatedAt = Date.now();
  }

  enqueueServerIceCandidate(sessionId: string, candidate: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.signaling.serverIceCandidates.push(candidate);
    session.updatedAt = Date.now();
  }

  drainClientIceCandidates(sessionId: string): string[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const candidates = [...session.signaling.clientIceCandidates];
    session.signaling.clientIceCandidates.length = 0;
    return candidates;
  }

  drainServerIceCandidates(sessionId: string): string[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const candidates = [...session.signaling.serverIceCandidates];
    session.signaling.serverIceCandidates.length = 0;
    return candidates;
  }

  cleanupClosedSessions(maxAgeMillis = 5 * 60 * 1000): number {
    const now = Date.now();
    let removed = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.status === 'closed' && now - session.updatedAt >= maxAgeMillis) {
        this.sessions.delete(sessionId);
        removed += 1;
      }
    }

    if (removed > 0) {
      this.logger.log(`Removed ${removed} closed WebRTC session(s) older than ${maxAgeMillis}ms.`);
    }

    return removed;
  }

  getSignalingState(sessionId: string): {
    clientOffer?: string;
    serverAnswer?: string;
    clientIceCandidates: string[];
    serverIceCandidates: string[];
  } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return {
      clientOffer: session.signaling.clientOffer,
      serverAnswer: session.signaling.serverAnswer,
      clientIceCandidates: [...session.signaling.clientIceCandidates],
      serverIceCandidates: [...session.signaling.serverIceCandidates],
    };
  }
}
