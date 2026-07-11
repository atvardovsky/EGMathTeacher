import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebRtcSessionService } from './webrtc-session.service';
import { WebRtcSignalingService } from './webrtc-signaling.service';
import { OpenAiRealtimeBridgeService, BridgeSessionOptions } from './openai-realtime-bridge.service';
import { ProviderEventPayload, WebRtcProviderEventService } from './webrtc-provider-event.service';

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

  private buildBridgeOptions(sessionId: string, conversationId: string): BridgeSessionOptions {
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
      persona,
      voice: preferredVoice,
      fileSearch: this.signalingService.getFileSearchConfig(),
      realtimeModel: this.signalingService.getRealtimeModel(),
      translatorMode: Boolean(translation),
      onServerIceCandidate: (candidate: string) => {
        this.sessionService.enqueueServerIceCandidate(sessionId, candidate);
      },
    };
  }
}
