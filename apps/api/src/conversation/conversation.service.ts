import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

type ConversationParticipant = 'user' | 'assistant';

export interface VoiceTurn {
  participant: ConversationParticipant;
  timestamp: number;
  durationMillis?: number;
  transcript?: string;
  annotations?: Record<string, unknown>;
  tokensUsed?: number;
}

export interface ConversationRecord {
  id: string;
  turns: VoiceTurn[];
  finalizedAt?: number;
  tokenUsage: {
    incoming: number;
    outgoing: number;
  };
}

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);
  private readonly sessions = new Map<string, ConversationRecord>();
  private readonly transcripts = new Map<
    string,
    {
      transcript: string;
      finalizedAt: number;
      filePath: string;
    }
  >();
  private readonly transcriptLogDir: string;

  constructor(private readonly configService: ConfigService) {
    this.transcriptLogDir = this.configService.get<string>('app.transcriptLogDir') ?? './logs';
  }

  ensureConversation(conversationId: string): ConversationRecord {
    const existing = this.sessions.get(conversationId);
    if (existing) {
      return existing;
    }

    const record: ConversationRecord = {
      id: conversationId,
      turns: [],
      tokenUsage: {
        incoming: 0,
        outgoing: 0,
      },
    };
    this.sessions.set(conversationId, record);
    this.logger.debug(`Created conversation record ${conversationId}.`);
    return record;
  }

  recordVoiceTurn(conversationId: string, turn: Omit<VoiceTurn, 'timestamp'> & { timestamp?: number }): VoiceTurn {
    const record = this.ensureConversation(conversationId);
    const entry: VoiceTurn = {
      timestamp: turn.timestamp ?? Date.now(),
      participant: turn.participant,
      durationMillis: turn.durationMillis,
      transcript: turn.transcript,
      annotations: turn.annotations,
      tokensUsed: turn.tokensUsed,
    };

    record.turns.push(entry);
    this.updateTokenUsage(record, entry);
    this.logger.debug(
      `Conversation ${conversationId} stored ${entry.participant} voice turn (total turns=${record.turns.length}).`,
    );

    return entry;
  }

  applyTokenUsage(
    conversationId: string,
    usage: { incoming?: number; outgoing?: number } | undefined,
  ): void {
    if (!usage) {
      return;
    }

    const record = this.ensureConversation(conversationId);
    const incoming = this.normalizeTokenCount(usage.incoming);
    const outgoing = this.normalizeTokenCount(usage.outgoing);

    if (incoming > 0) {
      record.tokenUsage.incoming += incoming;
    }

    if (outgoing > 0) {
      record.tokenUsage.outgoing += outgoing;
    }

    if (incoming > 0 || outgoing > 0) {
      this.logger.debug(
        `Conversation ${conversationId} token usage updated (incoming+=${incoming}, outgoing+=${outgoing}).`,
      );
    }
  }

  getHistory(conversationId: string): VoiceTurn[] {
    return this.sessions.get(conversationId)?.turns ?? [];
  }

  listConversations(): ConversationRecord[] {
    return Array.from(this.sessions.values());
  }

  initializeConversation(conversationId: string): ConversationRecord {
    this.transcripts.delete(conversationId);
    const record: ConversationRecord = {
      id: conversationId,
      turns: [],
      tokenUsage: {
        incoming: 0,
        outgoing: 0,
      },
    };
    this.sessions.set(conversationId, record);
    this.logger.debug(`Reset conversation record ${conversationId}.`);
    return record;
  }

  finalizeConversation(conversationId: string): string | undefined {
    const record = this.sessions.get(conversationId);
    if (!record) {
      this.logger.warn(`Attempted to finalize unknown conversation ${conversationId}.`);
      return undefined;
    }

    const transcript = record.turns
      .map((turn, index) => {
        const speaker = turn.participant === 'user' ? 'Caller' : 'Assistant';
        const prefix = `${index + 1}. ${speaker}`;
        const text = turn.transcript?.trim();
        if (text) {
          return `${prefix}: ${text}`;
        }
        return `${prefix}: [audio turn with no transcript captured]`;
      })
      .join('\n');

    const finalizedAt = Date.now();
    record.finalizedAt = finalizedAt;
    const filePath = this.persistTranscriptToFile(conversationId, finalizedAt, transcript);
    this.transcripts.set(conversationId, { transcript, finalizedAt, filePath });
    this.logger.debug(
      `Finalized conversation ${conversationId}, transcript length=${transcript.length}, file=${filePath}, tokens(in=${record.tokenUsage.incoming}, out=${record.tokenUsage.outgoing}).`,
    );

    return transcript;
  }

  getFinalTranscript(conversationId: string): string | undefined {
    return this.transcripts.get(conversationId)?.transcript;
  }

  getFinalTranscriptFile(conversationId: string): string | undefined {
    return this.transcripts.get(conversationId)?.filePath;
  }

  listFinalizedConversations(): Array<{ conversationId: string; finalizedAt: number; filePath: string }> {
    return Array.from(this.transcripts.entries()).map(([conversationId, entry]) => ({
      conversationId,
      finalizedAt: entry.finalizedAt,
      filePath: entry.filePath,
    }));
  }

  private persistTranscriptToFile(conversationId: string, finalizedAt: number, transcript: string): string {
    this.ensureLogDirectory();
    const filename = this.buildTranscriptFilename(conversationId, finalizedAt);
    const filePath = join(this.transcriptLogDir, filename);
    try {
      writeFileSync(filePath, transcript, { encoding: 'utf8' });
    } catch (error) {
      this.logger.error(`Failed to write transcript to ${filePath}`, error instanceof Error ? error.stack : error);
      throw error;
    }
    return filePath;
  }

  private ensureLogDirectory(): void {
    mkdirSync(this.transcriptLogDir, { recursive: true });
  }

  private buildTranscriptFilename(conversationId: string, finalizedAt: number): string {
    const sanitizedId = conversationId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${sanitizedId}_${finalizedAt}.txt`;
  }

  private updateTokenUsage(record: ConversationRecord, entry: VoiceTurn): void {
    if (!entry.tokensUsed) {
      return;
    }

    if (entry.participant === 'user') {
      record.tokenUsage.incoming += entry.tokensUsed;
    } else {
      record.tokenUsage.outgoing += entry.tokensUsed;
    }
  }

  private normalizeTokenCount(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 0;
    }
    if (value <= 0) {
      return 0;
    }
    return Math.trunc(value);
  }
}
