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
  Req,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import type { AuthSession } from '../auth/auth.types';
import { AuthService } from '../auth/auth.service';
import { BackgroundAiService } from '../background-ai/background-ai.service';
import {
  ConversationService,
  type ConversationRecord,
  type VoiceTurn,
} from '../conversation/conversation.service';
import { DatabaseService } from '../database/database.service';
import {
  LessonBoundaryRejectedException,
  LessonService,
} from '../lesson/lesson.service';
import type { LessonSessionRecord } from '../lesson/lesson.types';
import { TeachingContextService } from '../teaching-context/teaching-context.service';
import { RealtimeTeachingContext } from '../teaching-context/teaching-context.types';
import type { LessonType, TutorAnswer, TutorLessonHistoryTurn } from '../tutor/tutor.types';
import { UsageService } from '../usage/usage.service';
import { WebRtcSession, WebRtcSessionService } from './webrtc-session.service';
import {
  WebRtcSignalingService,
  WebRtcBootstrapPayload,
  TranslationConfig,
  PersonalityConfig,
} from './webrtc-signaling.service';
import { WebRtcAuthService, RealtimeEphemeralToken } from './webrtc-auth.service';
import { WebRtcMediaService } from './webrtc-media.service';
import { ProviderEventPayload } from './webrtc-provider-event.service';

interface StartSessionRequest {
  conversationSeed?: string;
  lessonSessionId?: string;
  lessonType?: LessonType;
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
  conversationId?: string;
  lessonSessionId?: string;
  lessonType?: LessonType;
  transcript?: string;
  transcriptFile?: string;
  syncedTurn?: TutorLessonHistoryTurn;
}

interface ProviderEventsRequest {
  events: ProviderEventPayload[];
}

const LESSON_TYPES = new Set<string>([
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

const TERMINAL_LESSON_STATUSES = new Set<string>([
  'hard_limit_reached',
  'goal_reached',
  'finished',
]);

@Controller('webrtc')
export class WebRtcController {
  private readonly logger = new Logger(WebRtcController.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly sessionService: WebRtcSessionService,
    private readonly signalingService: WebRtcSignalingService,
    private readonly authService: WebRtcAuthService,
    private readonly mediaService: WebRtcMediaService,
    private readonly appAuthService: AuthService,
    private readonly usageService: UsageService,
    private readonly db: DatabaseService,
    private readonly teachingContextService: TeachingContextService,
    private readonly backgroundAiService: BackgroundAiService,
    private readonly lessonService: LessonService,
  ) {}

  @Post('session')
  @HttpCode(HttpStatus.CREATED)
  startSession(
    @Body() body: StartSessionRequest,
    @Req() request?: Request,
  ): StartSessionResponse {
    const conversationId = this.resolveConversationId(body);
    const translation = this.normalizeTranslation(body.translation);
    const authSession = request
      ? this.appAuthService.getSessionFromRequest(request)
      : undefined;
    const metadata = this.resolveSessionMetadata(
      authSession,
      conversationId,
      body,
    );
    const teachingContext = this.teachingContextService.buildRealtimeTeachingContext({
      userId: metadata.userId,
      conversationId,
      lessonSessionId: metadata.lessonSessionId,
      lessonType: metadata.lessonType,
    });
    if (teachingContext) {
      metadata.teachingContext = teachingContext;
    }

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
      session = this.sessionService.createSession(conversationId, metadata);
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
      personality: this.withTeachingContextRules(personality, session.teachingContext),
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
      const syncedTurn = this.getSyncedRealtimeTurn(session);
      return {
        status: 'already_closed',
        conversationId: session.conversationId,
        lessonSessionId: session.lessonSessionId,
        lessonType: this.normalizeLessonType(session.lessonType),
        transcript: transcript ?? undefined,
        transcriptFile: transcriptFile ?? undefined,
        syncedTurn,
      };
    }

    const transcript = await this.mediaService.closeSession(sessionId);
    const record = this.conversationService.getConversationRecord(session.conversationId);
    const syncedTurn = this.syncRealtimeTranscriptToLessonTurn(session, record, transcript);
    this.recordRealtimeUsage(session, record);
    this.enqueueRealtimeReview(session, record, transcript);
    const transcriptFile = transcript
      ? this.conversationService.getFinalTranscriptFile(session.conversationId)
      : undefined;

    this.logger.debug(
      `Closed session ${sessionId}; transcript ${transcript ? 'archived' : 'missing'}.`,
    );

    return {
      status: 'closed',
      conversationId: session.conversationId,
      lessonSessionId: session.lessonSessionId,
      lessonType: this.normalizeLessonType(session.lessonType),
      transcript: transcript ?? undefined,
      transcriptFile: transcriptFile ?? undefined,
      syncedTurn,
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

  private resolveSessionMetadata(
    authSession: AuthSession | undefined,
    conversationId: string,
    body: StartSessionRequest,
  ): {
    userId?: string;
    userName?: string;
    userRole?: AuthSession['role'];
    userCreatedAt?: string;
    lessonSessionId?: string;
    lessonType?: LessonType;
    teachingContext?: RealtimeTeachingContext;
  } {
    const requestedLessonType = this.normalizeLessonType(body.lessonType);
    if (!authSession?.id) {
      return {
        lessonType: requestedLessonType,
      };
    }
    const userId = authSession.id;
    const baseMetadata = {
      userId,
      userName: authSession.name,
      userRole: authSession.role,
      userCreatedAt: authSession.createdAt,
    };

    const requestedLessonSessionId = body.lessonSessionId?.trim();
    if (requestedLessonSessionId) {
      const lesson = this.db.get<{
        id: string;
        conversation_id: string | null;
        lesson_type: LessonType | null;
        status: string;
      }>(
        `SELECT id, conversation_id, lesson_type, status
         FROM lesson_sessions
         WHERE id = ? AND user_id = ?`,
        [requestedLessonSessionId, userId],
      );
      if (
        lesson &&
        !TERMINAL_LESSON_STATUSES.has(lesson.status) &&
        (!lesson.conversation_id || lesson.conversation_id === conversationId)
      ) {
        return {
          ...baseMetadata,
          lessonSessionId: lesson.id,
          lessonType: lesson.lesson_type ?? requestedLessonType,
        };
      }
    }

    const activeLesson = this.db.get<{
      id: string;
      lesson_type: LessonType | null;
      status: string;
    }>(
      `SELECT id, lesson_type, status
       FROM lesson_sessions
       WHERE user_id = ?
         AND conversation_id = ?
         AND status NOT IN ('hard_limit_reached', 'goal_reached', 'finished')
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId, conversationId],
    );

    return {
      ...baseMetadata,
      lessonSessionId: activeLesson?.id,
      lessonType: activeLesson?.lesson_type ?? requestedLessonType,
    };
  }

  private normalizeLessonType(value: string | undefined): LessonType | undefined {
    const normalized = value?.trim();
    return normalized && LESSON_TYPES.has(normalized)
      ? (normalized as LessonType)
      : undefined;
  }

  private syncRealtimeTranscriptToLessonTurn(
    session: WebRtcSession,
    record: ConversationRecord | undefined,
    transcript: string | undefined,
  ): TutorLessonHistoryTurn | undefined {
    if (!session.userId || !this.hasTeachingTranscript(record, transcript)) {
      return undefined;
    }

    const existing = this.getSyncedRealtimeTurn(session);
    if (existing) {
      return existing;
    }

    const lessonType = this.normalizeLessonType(session.lessonType) ?? 'tutor';
    if (!session.lessonSessionId) {
      try {
        const ensured = this.lessonService.ensureRealtimeSessionWithTransitions({
          userId: session.userId,
          conversationId: session.conversationId,
          lessonType,
        });
        session.lessonSessionId = ensured.lifecycle.lessonSessionId;
        session.lessonType = ensured.lifecycle.lessonType;
        this.enqueueLessonClosureReviews(session.userId, ensured.closedSessions);
      } catch (error) {
        if (error instanceof LessonBoundaryRejectedException) {
          this.enqueueLessonClosureReviews(session.userId, error.closedSessions);
        }
        this.logger.warn(
          `Failed to attach WebRTC session ${session.id} to lesson history: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return undefined;
      }
    }

    const lifecycle = this.lessonService.completeRealtimeTurn({
      userId: session.userId,
      lessonSessionId: session.lessonSessionId,
      durationSeconds: this.getSessionDurationSeconds(session),
    });
    if (!lifecycle) {
      return undefined;
    }

    session.lessonSessionId = lifecycle.lessonSessionId;
    session.lessonType = lifecycle.lessonType;
    const prompt = this.buildRealtimeVoicePrompt(record, transcript);
    const answerText = this.buildRealtimeVoiceAnswer(record, transcript);
    const turnId = randomUUID();
    const createdAt = new Date(session.finalizedAt ?? Date.now()).toISOString();
    const answer: TutorAnswer & Record<string, unknown> = {
      turnId,
      conversationId: session.conversationId,
      lessonType: lifecycle.lessonType,
      lessonLifecycle: lifecycle,
      usage: this.usageService.getLessonUsageSnapshot(session.userId, lifecycle.lessonSessionId),
      answer: answerText,
      blocks: [
        {
          id: `block_${randomUUID()}`,
          type: 'text',
          text: answerText,
        },
      ],
      tasks: [],
      examples: [],
      needsImage: false,
      citations: [],
      source: 'webrtc_realtime',
      realtimeTranscript: this.truncateText(transcript, 4_000),
    };

    this.db.run(
      `INSERT INTO tutor_turns (
         id, user_id, conversation_id, request_id, lesson_type, prompt, answer_json, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        turnId,
        session.userId,
        session.conversationId,
        this.realtimeRequestId(session.id),
        lifecycle.lessonType,
        prompt,
        JSON.stringify(answer),
        createdAt,
      ],
    );

    return {
      id: turnId,
      prompt,
      lessonType: lifecycle.lessonType,
      source: 'voice',
      answer,
      createdAt,
    };
  }

  private getSyncedRealtimeTurn(session: WebRtcSession): TutorLessonHistoryTurn | undefined {
    if (!session.userId) {
      return undefined;
    }
    const row = this.db.get<{
      id: string;
      prompt: string;
      answer_json: string;
      lesson_type: LessonType;
      created_at: string;
    }>(
      `SELECT id, prompt, answer_json, lesson_type, created_at
       FROM tutor_turns
       WHERE user_id = ?
         AND request_id = ?
       LIMIT 1`,
      [session.userId, this.realtimeRequestId(session.id)],
    );
    if (!row) {
      return undefined;
    }
    const answer = this.parseJsonObject(row.answer_json) as TutorAnswer | undefined;
    if (!answer) {
      return undefined;
    }
    const lessonType = this.normalizeLessonType(row.lesson_type) ?? answer.lessonType ?? 'tutor';
    session.lessonSessionId = answer.lessonLifecycle?.lessonSessionId ?? session.lessonSessionId;
    session.lessonType = lessonType;
    return {
      id: row.id,
      prompt: row.prompt,
      lessonType,
      source: 'voice',
      answer: {
        ...answer,
        lessonType,
      },
      createdAt: row.created_at,
    };
  }

  private hasTeachingTranscript(
    record: ConversationRecord | undefined,
    transcript: string | undefined,
  ): boolean {
    if (this.extractVoiceTexts(record?.turns ?? [], 'user').length > 0) {
      return true;
    }
    return Boolean(transcript?.trim());
  }

  private buildRealtimeVoicePrompt(
    record: ConversationRecord | undefined,
    transcript: string | undefined,
  ): string {
    const userTexts = this.extractVoiceTexts(record?.turns ?? [], 'user');
    const source = userTexts.length > 0
      ? userTexts.slice(-4).join(' / ')
      : transcript?.trim() ?? '';
    return `Живая голосовая сессия: ${this.truncateText(source, 900)}`;
  }

  private buildRealtimeVoiceAnswer(
    record: ConversationRecord | undefined,
    transcript: string | undefined,
  ): string {
    const assistantTexts = this.extractVoiceTexts(record?.turns ?? [], 'assistant');
    const lastAssistant = assistantTexts.at(-1);
    if (lastAssistant) {
      return [
        'Живая голосовая часть урока сохранена в истории.',
        `Последний ответ репетитора: ${this.truncateText(lastAssistant, 1_000)}`,
        'Следующий шаг продолжит занятие с учетом этой стенограммы.',
      ].join('\n');
    }
    return [
      'Живая голосовая часть урока сохранена в истории.',
      transcript?.trim()
        ? `Стенограмма: ${this.truncateText(transcript, 1_200)}`
        : 'Стенограмма содержит только технические голосовые события.',
      'Следующий шаг продолжит занятие с этого места.',
    ].join('\n');
  }

  private extractVoiceTexts(turns: VoiceTurn[], participant: VoiceTurn['participant']): string[] {
    return turns
      .filter((turn) => turn.participant === participant)
      .map((turn) => turn.transcript?.trim() ?? '')
      .filter((text) => text.length > 0);
  }

  private getSessionDurationSeconds(session: WebRtcSession): number {
    const closedAt = session.finalizedAt ?? session.updatedAt ?? Date.now();
    return Math.max(0, Math.floor((closedAt - session.createdAt) / 1000));
  }

  private realtimeRequestId(sessionId: string): string {
    return `webrtc:${sessionId}`;
  }

  private parseJsonObject(value: string): Record<string, unknown> | undefined {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  }

  private truncateText(value: string | undefined, maxLength: number): string {
    const normalized = value?.trim() ?? '';
    if (normalized.length <= maxLength) {
      return normalized;
    }
    return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
  }

  private enqueueLessonClosureReviews(userId: string, sessions: LessonSessionRecord[]): void {
    for (const session of sessions) {
      try {
        this.backgroundAiService.enqueueLessonClosureReview({
          userId,
          conversationId: session.conversation_id,
          lessonSessionId: session.id,
          lessonType: session.lesson_type,
          finishReason: session.finish_reason ?? undefined,
        });
      } catch {
        // Background review must not block realtime session lifecycle.
      }
    }
  }

  private recordRealtimeUsage(
    session: WebRtcSession,
    record: ConversationRecord | undefined,
  ): void {
    if (!session.userId) {
      return;
    }

    try {
      this.usageService.recordRealtimeSession({
        userId: session.userId,
        conversationId: session.conversationId,
        lessonSessionId: session.lessonSessionId,
        lessonType: session.lessonType,
        sessionId: session.id,
        model: this.signalingService.getRealtimeModel(),
        startedAtMs: session.createdAt,
        closedAtMs: session.finalizedAt ?? session.updatedAt,
        inputTokens: record?.tokenUsage.incoming,
        outputTokens: record?.tokenUsage.outgoing,
        status: 'closed',
        turnCount: record?.turns.length,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record WebRTC usage for session ${session.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private enqueueRealtimeReview(
    session: WebRtcSession,
    record: ConversationRecord | undefined,
    transcript: string | undefined,
  ): void {
    if (!session.userId) {
      return;
    }

    try {
      this.backgroundAiService.enqueueRealtimeSessionReview({
        userId: session.userId,
        conversationId: session.conversationId,
        webrtcSessionId: session.id,
        lessonSessionId: session.lessonSessionId,
        lessonType: session.lessonType as LessonType | undefined,
        transcript,
        turns: (record?.turns ?? []).map((turn) => ({
          participant: turn.participant,
          transcript: turn.transcript,
          timestamp: turn.timestamp,
          durationMillis: turn.durationMillis,
        })),
        tokenUsage: record?.tokenUsage,
        teachingContext: session.teachingContext?.reviewContext,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue WebRTC realtime review for session ${session.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private withTeachingContextRules(
    personality: PersonalityConfig,
    teachingContext: RealtimeTeachingContext | undefined,
  ): PersonalityConfig {
    if (!teachingContext?.prompt) {
      return personality;
    }
    return {
      ...personality,
      rules: [personality.rules, teachingContext.prompt].filter(Boolean).join('\n\n'),
    };
  }
}
