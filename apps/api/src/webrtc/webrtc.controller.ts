import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConversationService } from '../conversation/conversation.service';
import { WebRtcSession, WebRtcSessionService } from './webrtc-session.service';
import {
  WebRtcSignalingService,
  WebRtcBootstrapPayload,
  TranslationConfig,
} from './webrtc-signaling.service';
import { WebRtcAuthService, RealtimeEphemeralToken } from './webrtc-auth.service';
import { WebRtcMediaService } from './webrtc-media.service';
import { ProviderEventPayload } from './webrtc-provider-event.service';

interface StartSessionRequest {
  conversationSeed?: string;
  translation?: {
    languageA?: string;
    languageB?: string;
  };
}

interface StartSessionResponse extends WebRtcBootstrapPayload {}

interface CreateTokenRequest {
  voice?: string;
  locale?: string;
}

interface OfferPayload {
  sdp: string;
}

interface AnswerPayload {
  sdp: string;
}

interface IceCandidatePayload {
  candidate: string;
}

interface CloseSessionResponse {
  status: 'closed' | 'already_closed';
  transcript?: string;
  transcriptFile?: string;
}

interface ProviderEventsRequest {
  events: ProviderEventPayload[];
}

@Controller('webrtc')
export class WebRtcController {
  private readonly logger = new Logger(WebRtcController.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly sessionService: WebRtcSessionService,
    private readonly signalingService: WebRtcSignalingService,
    private readonly authService: WebRtcAuthService,
    private readonly mediaService: WebRtcMediaService,
  ) {}

  @Post('session')
  @HttpCode(HttpStatus.CREATED)
  startSession(@Body() body: StartSessionRequest): StartSessionResponse {
    const conversationId = this.resolveConversationId(body);
    const translation = this.normalizeTranslation(body.translation);

    try {
      this.sessionService.assertCapacity();
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'WebRTC session limit reached',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.conversationService.initializeConversation(conversationId);
    const history = this.conversationService.getHistory(conversationId);

    if (history.length === 0) {
      this.logger.debug(`Starting fresh conversation history for ${conversationId}.`);
    } else {
      this.logger.debug(
        `Reusing existing conversation ${conversationId} with ${history.length} messages.`,
      );
    }

    let session: WebRtcSession;
    try {
      session = this.sessionService.createSession(conversationId);
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'WebRTC session limit reached',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (translation) {
      this.sessionService.setTranslationConfig(session.id, translation);
      this.logger.debug(
        `Translation mode enabled for session ${session.id}: ${translation.languageA} <-> ${translation.languageB}`,
      );
    }
    const payload = this.signalingService.buildBootstrapPayload(
      session.id,
      conversationId,
      translation,
    );

    this.logger.debug(
      `Prepared WebRTC bootstrap payload for conversation ${conversationId} (session ${session.id}).`,
    );

    return payload;
  }

  @Post('session/:sessionId/token')
  @HttpCode(HttpStatus.CREATED)
  async createEphemeralToken(
    @Param('sessionId') sessionId: string,
    @Body() body: CreateTokenRequest,
  ): Promise<RealtimeEphemeralToken> {
    const session = this.requireOpenSession(sessionId);
    const voiceConfig = this.signalingService.getVoiceConfig();
    const requestedVoice = body.voice ?? voiceConfig.default;

    if (requestedVoice && !voiceConfig.available.includes(requestedVoice)) {
      throw new BadRequestException(
        `Unsupported voice "${requestedVoice}". Allowed voices: ${voiceConfig.available.join(', ')}`,
      );
    }

    const translation = this.sessionService.getTranslationConfig(sessionId);
    const personality = this.signalingService.applyTranslationConfig(
      this.signalingService.getPersonalityConfig(),
      translation,
    );
    if (body.locale && body.locale.trim().length > 0) {
      personality.locale = body.locale.trim();
    }

    if (requestedVoice) {
      this.sessionService.setPreferredVoice(sessionId, requestedVoice);
    }

    const token = await this.authService.createEphemeralToken({
      sessionId: session.id,
      conversationId: session.conversationId,
      voice: requestedVoice,
      personality,
      fileSearch: this.signalingService.getFileSearchConfig(),
    });

    this.logger.debug(
      `Issued OpenAI realtime token for session ${sessionId} (conversation ${session.conversationId}).`,
    );

    return token;
  }

  @Post('session/:sessionId/offer')
  @HttpCode(HttpStatus.ACCEPTED)
  async submitClientOffer(
    @Param('sessionId') sessionId: string,
    @Body() body: OfferPayload,
  ): Promise<{ sdp: string }> {
    if (!body?.sdp) {
      throw new BadRequestException('Missing SDP offer');
    }

    this.requireOpenSession(sessionId);
    const answer = await this.mediaService.handleClientOffer(sessionId, body.sdp);
    this.logger.debug(`Received SDP offer for session ${sessionId}.`);
    return answer;
  }

  @Get('session/:sessionId/offer')
  async getClientOffer(@Param('sessionId') sessionId: string): Promise<{ sdp?: string }> {
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    return { sdp: session.signaling.clientOffer };
  }

  @Post('session/:sessionId/answer')
  @HttpCode(HttpStatus.ACCEPTED)
  async submitServerAnswer(
    @Param('sessionId') sessionId: string,
    @Body() body: AnswerPayload,
  ): Promise<{ status: string }> {
    if (!body?.sdp) {
      throw new BadRequestException('Missing SDP answer');
    }

    this.requireOpenSession(sessionId);
    await this.mediaService.noteServerAnswer(sessionId, body.sdp);
    this.logger.debug(`Stored SDP answer for session ${sessionId}.`);
    return { status: 'accepted' };
  }

  @Get('session/:sessionId/answer')
  async getServerAnswer(@Param('sessionId') sessionId: string): Promise<{ sdp?: string }> {
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    return { sdp: session.signaling.serverAnswer };
  }

  @Post('session/:sessionId/ice/client')
  @HttpCode(HttpStatus.ACCEPTED)
  async submitClientIceCandidate(
    @Param('sessionId') sessionId: string,
    @Body() body: IceCandidatePayload,
  ): Promise<{ status: string }> {
    if (!body?.candidate) {
      throw new BadRequestException('Missing ICE candidate');
    }

    this.requireOpenSession(sessionId);
    await this.mediaService.queueClientIceCandidate(sessionId, body.candidate);
    return { status: 'queued' };
  }

  @Get('session/:sessionId/ice/client')
  async consumeClientIceCandidates(
    @Param('sessionId') sessionId: string,
  ): Promise<{ candidates: string[] }> {
    this.ensureSessionExists(sessionId);
    const candidates = this.sessionService.drainClientIceCandidates(sessionId);
    return { candidates };
  }

  @Post('session/:sessionId/ice/server')
  @HttpCode(HttpStatus.ACCEPTED)
  async submitServerIceCandidate(
    @Param('sessionId') sessionId: string,
    @Body() body: IceCandidatePayload,
  ): Promise<{ status: string }> {
    if (!body?.candidate) {
      throw new BadRequestException('Missing ICE candidate');
    }

    this.requireOpenSession(sessionId);
    await this.mediaService.queueServerIceCandidate(sessionId, body.candidate);
    return { status: 'queued' };
  }

  @Get('session/:sessionId/ice/server')
  async consumeServerIceCandidates(
    @Param('sessionId') sessionId: string,
  ): Promise<{ candidates: string[] }> {
    this.ensureSessionExists(sessionId);
    const candidates = this.sessionService.drainServerIceCandidates(sessionId);
    return { candidates };
  }

  @Get('session/:sessionId/signaling')
  async getSignalingState(
    @Param('sessionId') sessionId: string,
  ): Promise<{
    clientOffer?: string;
    serverAnswer?: string;
    clientIceCandidates: string[];
    serverIceCandidates: string[];
  }> {
    this.ensureSessionExists(sessionId);
    const state = this.sessionService.getSignalingState(sessionId);
    return state;
  }

  @Post('session/:sessionId/close')
  @HttpCode(HttpStatus.ACCEPTED)
  async closeSession(@Param('sessionId') sessionId: string): Promise<CloseSessionResponse> {
    const session = this.ensureSessionExists(sessionId);
    if (session.status === 'closed') {
      const transcript = this.sessionService.getTranscriptForSession(sessionId);
      const transcriptFile = this.conversationService.getFinalTranscriptFile(
        session.conversationId,
      );
      return {
        status: 'already_closed',
        transcript: transcript ?? undefined,
        transcriptFile: transcriptFile ?? undefined,
      };
    }

    const transcript = await this.mediaService.closeSession(sessionId);
    const transcriptFile = transcript
      ? this.conversationService.getFinalTranscriptFile(session.conversationId)
      : undefined;

    this.logger.debug(
      `Closed session ${sessionId}; transcript ${transcript ? 'archived' : 'missing'}.`,
    );

    return {
      status: 'closed',
      transcript: transcript ?? undefined,
      transcriptFile: transcriptFile ?? undefined,
    };
  }

  @Post('session/:sessionId/events')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestProviderEvents(
    @Param('sessionId') sessionId: string,
    @Body() body: ProviderEventsRequest,
  ): Promise<{ status: string }> {
    this.requireOpenSession(sessionId);
    const eventCount = Array.isArray(body?.events) ? body.events.length : 0;
    this.logger.debug(
      `Received ${eventCount} provider event(s) for session ${sessionId}.`,
    );
    if (eventCount > 0) {
      this.mediaService.ingestProviderEvents(sessionId, body!.events!);
    }
    return { status: 'accepted' };
  }

  private ensureSessionExists(sessionId: string): WebRtcSession {
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }
    return session;
  }

  private requireOpenSession(sessionId: string): WebRtcSession {
    const session = this.ensureSessionExists(sessionId);
    if (session.status === 'closed') {
      throw new BadRequestException(`Session ${sessionId} has already been closed`);
    }
    return session;
  }

  private resolveConversationId(body: StartSessionRequest): string {
    const seed = body.conversationSeed?.trim();
    if (seed) {
      // Reuse the provided seed as a stable id; history is still reset per session.
      return seed;
    }

    return `conv_${Date.now()}_${randomUUID()}`;
  }

  private normalizeTranslation(
    raw?: { languageA?: string; languageB?: string },
  ): TranslationConfig | undefined {
    if (!raw) {
      return undefined;
    }
    const languageA = raw.languageA?.trim();
    const languageB = raw.languageB?.trim();
    if (!languageA || !languageB) {
      return undefined;
    }
    if (languageA.toLowerCase() === languageB.toLowerCase()) {
      return undefined;
    }
    return { languageA, languageB };
  }
}
