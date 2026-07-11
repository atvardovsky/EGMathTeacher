import { Injectable, Logger } from '@nestjs/common';
import { ConversationService, VoiceTurn } from '../conversation/conversation.service';
import { WebRtcSessionService } from './webrtc-session.service';

export interface ProviderEventPayload {
  type: string;
  [key: string]: unknown;
}

interface ConversationItem {
  id?: string;
  type?: string;
  status?: string;
  role?: string;
  content?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
}

interface ItemAnnotations extends Record<string, unknown> {
  providerEvents?: string[];
  responseIds?: string[];
  truncated?: boolean;
}

interface ProviderItemState {
  id: string;
  role?: string;
  transcriptParts: string[];
  finalTranscript?: string;
  completed: boolean;
  recorded: boolean;
  durationMillis?: number;
  annotations: ItemAnnotations;
  createdAt: number;
  updatedAt: number;
  turn?: VoiceTurn;
}

interface ProviderSessionState {
  ledger: Set<string>;
  items: Map<string, ProviderItemState>;
  responseItems: Map<string, Set<string>>;
}

@Injectable()
export class WebRtcProviderEventService {
  private readonly logger = new Logger(WebRtcProviderEventService.name);
  private readonly sessionStates = new Map<string, ProviderSessionState>();

  constructor(
    private readonly sessionService: WebRtcSessionService,
    private readonly conversationService: ConversationService,
  ) {}

  processEvents(sessionId: string, events: ProviderEventPayload[]): void {
    if (!events?.length) {
      return;
    }

    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      this.logger.warn(`Received provider events for unknown session ${sessionId}.`);
      return;
    }

    const state = this.ensureSessionState(sessionId);

    for (const event of events) {
      if (!event || typeof event !== 'object') {
        continue;
      }

      this.logger.debug(
        `Session ${sessionId} provider event: ${event.type} ${this.summarizeEventForLog(event)}`,
      );

      try {
        this.dispatchEvent(sessionId, session.conversationId, state, event);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Failed to process provider event ${event.type} for session ${sessionId}: ${reason}`,
        );
      }
    }
  }

  forgetSession(sessionId: string): void {
    const state = this.sessionStates.get(sessionId);
    if (!state) {
      return;
    }

    const session = this.sessionService.getSession(sessionId);
    const conversationId = session?.conversationId;
    if (conversationId) {
      for (const item of state.items.values()) {
        this.maybeRecordTurn(sessionId, conversationId, state, item, { force: true });
      }
    }

    this.sessionStates.delete(sessionId);
  }

  private dispatchEvent(
    sessionId: string,
    conversationId: string,
    state: ProviderSessionState,
    event: ProviderEventPayload,
  ): void {
    switch (event.type) {
      case 'conversation.item.created':
      case 'conversation.item.completed':
        this.handleConversationItem(sessionId, conversationId, state, event);
        break;
      case 'conversation.item.truncated':
        this.handleConversationItemTruncated(sessionId, conversationId, state, event);
        break;
      case 'response.output_item.added':
      case 'response.output_item.updated':
        this.handleResponseItem(sessionId, conversationId, state, event);
        break;
      case 'response.output_item.done':
        this.handleResponseItemDone(sessionId, conversationId, state, event);
        break;
      case 'response.content_part.added':
      case 'response.content_part.updated':
        this.handleResponseContentPart(sessionId, conversationId, state, event);
        break;
      case 'response.content_part.done':
        this.handleResponseContentPartDone(sessionId, conversationId, state, event);
        break;
      case 'response.audio_transcript.delta':
        this.handleAudioTranscriptDelta(sessionId, conversationId, state, event);
        break;
      case 'response.audio_transcript.done':
        this.handleAudioTranscriptDone(sessionId, conversationId, state, event);
        break;
      case 'input_audio_transcription.delta':
      case 'conversation.item.input_audio_transcription.delta':
        this.handleInputAudioTranscriptionDelta(sessionId, conversationId, state, event);
        break;
      case 'input_audio_transcription.done':
      case 'input_audio_transcription.completed':
      case 'conversation.item.input_audio_transcription.done':
      case 'conversation.item.input_audio_transcription.completed':
        this.handleInputAudioTranscriptionDone(sessionId, conversationId, state, event);
        break;
      case 'response.audio.done':
        this.handleAudioDone(sessionId, conversationId, state, event);
        break;
      case 'response.done':
        this.handleResponseDone(sessionId, conversationId, state, event);
        break;
      default:
        break;
    }
  }

  private handleConversationItem(
    sessionId: string,
    conversationId: string,
    state: ProviderSessionState,
    event: ProviderEventPayload,
  ): void {
    const itemPayload = (event.item ?? {}) as ConversationItem;
    if (!itemPayload || itemPayload.type !== 'message') {
      return;
    }

    const itemId = this.resolveItemId(itemPayload.id, event);
    const item = this.ensureItemState(state, itemId);
    item.role = itemPayload.role ?? item.role;
    item.durationMillis = this.extractDurationMillis(itemPayload) ?? item.durationMillis;
    this.addEventAnnotation(item, event.type);

    const transcript = this.extractTranscript(itemPayload.content);
    if (transcript) {
      this.setFinalTranscript(item, transcript);
    }

    if (itemPayload.status === 'completed' || event.type === 'conversation.item.completed') {
      item.completed = true;
    }

    this.maybeRecordTurn(sessionId, conversationId, state, item);
  }

  private handleConversationItemTruncated(
    sessionId: string,
    conversationId: string,
    state: ProviderSessionState,
    event: ProviderEventPayload,
  ): void {
    const itemPayload = (event.item ?? {}) as ConversationItem;
    const itemId = this.resolveItemId(itemPayload?.id ?? (event as any).item_id, event);
    const item = this.ensureItemState(state, itemId);
    this.addEventAnnotation(item, event.type);
    item.annotations.truncated = true;
    this.maybeRecordTurn(sessionId, conversationId, state, item);
  }

  private handleResponseItem(
    sessionId: string,
    conversationId: string,
    state: ProviderSessionState,
    event: ProviderEventPayload,
  ): void {
    const payload = event as Record<string, unknown>;
    const itemPayload = (payload.item ?? {}) as ConversationItem;
    if (!itemPayload) {
      return;
    }

    const itemId = this.resolveItemId(itemPayload.id ?? payload.item_id, event);
    const item = this.ensureItemState(state, itemId);
    item.role = itemPayload.role ?? item.role;
    item.durationMillis = this.extractDurationMillis(itemPayload) ?? item.durationMillis;
    this.addEventAnnotation(item, event.type);

    const responseId = this.pickString(payload, ['response_id', 'responseId']);
    if (responseId) {
      this.mapResponseToItem(state, responseId, item);
    }

    const transcript = this.extractTranscript(itemPayload.content);
    if (transcript) {
      this.setFinalTranscript(item, transcript);
    }

    if (itemPayload.status === 'completed') {
      item.completed = true;
    }

    this.maybeRecordTurn(sessionId, conversationId, state, item);
  }

  private handleResponseItemDone(
    sessionId: string,
    conversationId: string,
    state: ProviderSessionState,
    event: ProviderEventPayload,
  ): void {
    const payload = event as Record<string, unknown>;
    const itemId = this.resolveItemId(payload.item_id ?? (payload.item as ConversationItem | undefined)?.id, event);
    const item = this.ensureItemState(state, itemId);
    this.addEventAnnotation(item, event.type);
    item.completed = true;
    this.maybeRecordTurn(sessionId, conversationId, state, item);
  }

  private handleResponseContentPart(
    sessionId: string,
    conversationId: string,
    state: ProviderSessionState,
    event: ProviderEventPayload,
  ): void {
    const payload = event as Record<string, unknown>;
    const itemId = this.resolveItemId(payload.item_id, event);
    const item = this.ensureItemState(state, itemId);
    this.addEventAnnotation(item, event.type);

    const text = this.extractPartText(payload.part as Record<string, unknown> | undefined);
    if (text) {
      this.appendTranscript(item, text);
    }

    this.maybeRecordTurn(sessionId, conversationId, state, item);
  }

  private handleResponseContentPartDone(
    sessionId: string,
    conversationId: string,
    state: ProviderSessionState,
    event: ProviderEventPayload,
  ): void {
    const payload = event as Record<string, unknown>;
    const itemId = this.resolveItemId(payload.item_id, event);
    const item = this.ensureItemState(state, itemId);
    this.addEventAnnotation(item, event.type);

    const part = payload.part as Record<string, unknown> | undefined;
    const text = this.extractPartText(part);
    if (text) {
      this.setFinalTranscript(item, text);
    }

    item.completed = true;
    this.maybeRecordTurn(sessionId, conversationId, state, item);
  }

  private handleAudioTranscriptDelta(
    sessionId: string,
    conversationId: string,
    state: ProviderSessionState,
    event: ProviderEventPayload,
  ): void {
    const payload = event as Record<string, unknown>;
    const itemId = this.resolveItemId(payload.item_id, event);
    const delta = this.pickStringRaw(payload, ['delta']);
    if (!delta) {
      return;
    }

    const item = this.ensureItemState(state, itemId);
    this.addEventAnnotation(item, event.type);
    this.appendTranscript(item, delta);
    this.maybeRecordTurn(sessionId, conversationId, state, item);
  }

  private handleAudioTranscriptDone(
    sessionId: string,
    conversationId: string,
    state: ProviderSessionState,
    event: ProviderEventPayload,
  ): void {
    const payload = event as Record<string, unknown>;
    const itemId = this.resolveItemId(payload.item_id, event);
    const transcript = this.pickString(payload, ['transcript', 'text']);
    const item = this.ensureItemState(state, itemId);
    this.addEventAnnotation(item, event.type);

    if (transcript) {
      this.setFinalTranscript(item, transcript);
    }

    item.completed = true;
    this.maybeRecordTurn(sessionId, conversationId, state, item);
  }

  private handleInputAudioTranscriptionDelta(
    sessionId: string,
    conversationId: string,
    state: ProviderSessionState,
    event: ProviderEventPayload,
  ): void {
    const payload = event as Record<string, unknown>;
    const itemId = this.resolveItemId(
      payload.item_id ?? payload.itemId ?? payload.input_audio_buffer_id,
      event,
    );
    const delta = this.extractTranscriptionText(payload, ['delta', 'text', 'transcript']);
    if (!delta) {
      return;
    }
    const item = this.ensureItemState(state, itemId, { role: 'user' });
    this.addEventAnnotation(item, event.type);
    this.appendTranscript(item, delta);
    this.maybeRecordTurn(sessionId, conversationId, state, item, { updateExisting: true });
  }

  private handleInputAudioTranscriptionDone(
    sessionId: string,
    conversationId: string,
    state: ProviderSessionState,
    event: ProviderEventPayload,
  ): void {
    const payload = event as Record<string, unknown>;
    const itemId = this.resolveItemId(
      payload.item_id ?? payload.itemId ?? payload.input_audio_buffer_id,
      event,
    );
    const transcript = this.extractTranscriptionText(payload, ['transcript', 'text', 'final']);
    const item = this.ensureItemState(state, itemId, { role: 'user' });
    this.addEventAnnotation(item, event.type);
    if (transcript) {
      this.setFinalTranscript(item, transcript);
    }
    item.completed = true;
    this.maybeRecordTurn(sessionId, conversationId, state, item, { force: true, updateExisting: true });
  }

  private handleAudioDone(
    sessionId: string,
    conversationId: string,
    state: ProviderSessionState,
    event: ProviderEventPayload,
  ): void {
    const payload = event as Record<string, unknown>;
    const responseId = this.pickString(payload, ['response_id', 'responseId']);
    if (!responseId) {
      return;
    }

    const items = state.responseItems.get(responseId);
    if (!items) {
      return;
    }

    for (const itemId of items) {
      const item = state.items.get(itemId);
      if (!item) {
        continue;
      }
      this.addEventAnnotation(item, event.type);
      item.completed = true;
      this.maybeRecordTurn(sessionId, conversationId, state, item);
    }
  }

  private handleResponseDone(
    sessionId: string,
    conversationId: string,
    state: ProviderSessionState,
    event: ProviderEventPayload,
  ): void {
    const payload = event as Record<string, unknown>;
    const response = payload.response as Record<string, unknown> | undefined;
    if (!response) {
      return;
    }

    const responseId = this.pickString(response, ['id', 'response_id']);
    if (responseId) {
      const items = state.responseItems.get(responseId);
      if (items) {
        for (const itemId of items) {
          const item = state.items.get(itemId);
          if (!item) {
            continue;
          }
          this.addEventAnnotation(item, event.type);
          item.completed = true;
          this.maybeRecordTurn(sessionId, conversationId, state, item);
        }
        state.responseItems.delete(responseId);
      }
    }

    const usage = this.extractUsage(response.usage);
    if (usage) {
      this.conversationService.applyTokenUsage(conversationId, usage);
    }
  }

  private ensureSessionState(sessionId: string): ProviderSessionState {
    let state = this.sessionStates.get(sessionId);
    if (!state) {
      state = {
        ledger: new Set<string>(),
        items: new Map<string, ProviderItemState>(),
        responseItems: new Map<string, Set<string>>(),
      };
      this.sessionStates.set(sessionId, state);
    }
    return state;
  }

  private ensureItemState(
    state: ProviderSessionState,
    rawId: string,
    defaults?: { role?: string },
  ): ProviderItemState {
    const itemId = rawId || `item_${Math.random().toString(36).slice(2, 10)}`;
    let item = state.items.get(itemId);
    if (!item) {
      const timestamp = Date.now();
      item = {
        id: itemId,
        role: defaults?.role,
        transcriptParts: [],
        completed: false,
        recorded: false,
        annotations: {},
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      state.items.set(itemId, item);
    } else if (defaults?.role && !item.role) {
      item.role = defaults.role;
    }
    return item;
  }

  private maybeRecordTurn(
    sessionId: string,
    conversationId: string,
    state: ProviderSessionState,
    item: ProviderItemState,
    options: { force?: boolean; updateExisting?: boolean } = {},
  ): void {
    const participant = this.resolveParticipant(item.role);
    if (!participant) {
      return;
    }

    const transcript = this.buildTranscript(item);
    if (!transcript) {
      return;
    }

    const annotations = { ...item.annotations, providerItemId: item.id, providerRole: item.role };

    if (item.recorded) {
      if (options.updateExisting && item.turn) {
        item.turn.transcript = transcript;
        if (item.durationMillis) {
          item.turn.durationMillis = item.durationMillis;
        }
        item.turn.annotations = annotations;
      }
      return;
    }

    if (!options.force && !item.completed) {
      return;
    }

    const recordedTurn = this.conversationService.recordVoiceTurn(conversationId, {
      participant,
      transcript,
      durationMillis: item.durationMillis,
      annotations,
    });

    item.recorded = true;
    item.completed = true;
    item.turn = recordedTurn;
    state.ledger.add(item.id);

    this.logger.debug(
      `Recorded ${participant} voice turn for conversation ${conversationId} (session ${sessionId}) via item ${item.id}.`,
    );
  }

  private mapResponseToItem(state: ProviderSessionState, responseId: string, item: ProviderItemState): void {
    if (!responseId) {
      return;
    }
    let items = state.responseItems.get(responseId);
    if (!items) {
      items = new Set<string>();
      state.responseItems.set(responseId, items);
    }
    items.add(item.id);
    const annotations = item.annotations;
    if (!Array.isArray(annotations.responseIds)) {
      annotations.responseIds = [];
    }
    if (!annotations.responseIds.includes(responseId)) {
      annotations.responseIds.push(responseId);
    }
  }

  private appendTranscript(item: ProviderItemState, fragment: string): void {
    if (!fragment) {
      return;
    }
    item.transcriptParts.push(fragment);
    item.updatedAt = Date.now();
  }

  private setFinalTranscript(item: ProviderItemState, transcript: string): void {
    const trimmed = transcript.trim();
    if (!trimmed) {
      return;
    }
    item.finalTranscript = trimmed;
    item.transcriptParts = [];
    item.updatedAt = Date.now();
  }

  private buildTranscript(item: ProviderItemState): string | undefined {
    let base = item.finalTranscript;
    if (!base) {
      if (item.transcriptParts.length === 0) {
        return item.annotations.truncated ? '[audio truncated by provider]' : undefined;
      }
      base = item.transcriptParts.join('').trim();
    }

    if (!base) {
      return item.annotations.truncated ? '[audio truncated by provider]' : undefined;
    }

    if (item.annotations.truncated) {
      return `${base} [provider truncated audio]`;
    }
    return base;
  }

  private extractTranscript(content?: Array<Record<string, unknown>>): string | undefined {
    if (!Array.isArray(content)) {
      return undefined;
    }

    for (const part of content) {
      if (!part) {
        continue;
      }
      const text = this.pickString(part, ['text', 'transcript']);
      if (text) {
        return text;
      }
      const payload = part.payload as Record<string, unknown> | undefined;
      if (payload) {
        const nested = this.pickString(payload, ['text', 'transcript']);
        if (nested) {
          return nested;
        }
      }
    }
    return undefined;
  }

  private extractPartText(part?: Record<string, unknown>): string | undefined {
    if (!part) {
      return undefined;
    }
    const delta = this.pickStringRaw(part, ['delta']);
    if (delta !== undefined) {
      return delta;
    }
    const direct = this.pickString(part, ['text', 'transcript']);
    if (direct) {
      return direct;
    }
    const payload = part.payload as Record<string, unknown> | undefined;
    if (payload) {
      const payloadDelta = this.pickStringRaw(payload, ['delta']);
      if (payloadDelta !== undefined) {
        return payloadDelta;
      }
      return this.pickString(payload, ['text', 'transcript']);
    }
    return undefined;
  }

  private extractDurationMillis(item: ConversationItem | undefined): number | undefined {
    if (!item?.metadata) {
      return undefined;
    }
    const metadata = item.metadata as Record<string, unknown>;
    const millis = this.numberValue(metadata.audio_duration_ms ?? metadata.duration_ms ?? metadata.audio_ms);
    if (millis > 0) {
      return millis;
    }
    const seconds = this.numberValue(metadata.audio_duration_seconds ?? metadata.duration_seconds);
    if (seconds > 0) {
      return Math.round(seconds * 1000);
    }
    return undefined;
  }

  private extractUsage(rawUsage: unknown): { incoming?: number; outgoing?: number } | undefined {
    if (!rawUsage || typeof rawUsage !== 'object') {
      return undefined;
    }

    const usage = rawUsage as Record<string, unknown>;

    const incomingDetailed =
      this.sumNumbers(usage, ['input_audio_tokens', 'input_text_tokens']) ||
      this.sumNumbers(usage, ['prompt_tokens', 'input_token_count', 'input_tokens']);

    const outgoingDetailed =
      this.sumNumbers(usage, ['output_audio_tokens', 'output_text_tokens']) ||
      this.sumNumbers(usage, ['completion_tokens', 'output_token_count', 'output_tokens']);

    const incoming = incomingDetailed > 0 ? incomingDetailed : 0;
    const outgoing = outgoingDetailed > 0 ? outgoingDetailed : 0;

    if (incoming === 0 && outgoing === 0) {
      return undefined;
    }

    return { incoming, outgoing };
  }

  private sumNumbers(source: Record<string, unknown>, keys: string[]): number {
    return keys.reduce((total, key) => total + this.numberValue(source[key]), 0);
  }

  private numberValue(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return 0;
  }

  private resolveParticipant(role?: string): 'user' | 'assistant' | undefined {
    if (!role) {
      return undefined;
    }
    const normalized = role.toLowerCase();
    if (normalized === 'assistant') {
      return 'assistant';
    }
    if (normalized === 'user' || normalized === 'caller') {
      return 'user';
    }
    return undefined;
  }

  private addEventAnnotation(item: ProviderItemState, eventType: string): void {
    if (!eventType) {
      return;
    }
    if (!Array.isArray(item.annotations.providerEvents)) {
      item.annotations.providerEvents = [];
    }
    if (!item.annotations.providerEvents.includes(eventType)) {
      item.annotations.providerEvents.push(eventType);
    }
  }

  private pickString(source: Record<string, unknown> | undefined, keys: string[]): string | undefined {
    if (!source) {
      return undefined;
    }
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
    return undefined;
  }

  private pickStringRaw(
    source: Record<string, unknown> | undefined,
    keys: string[],
  ): string | undefined {
    if (!source) {
      return undefined;
    }
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }
    return undefined;
  }

  private extractTranscriptionText(
    payload: Record<string, unknown>,
    keys: string[],
  ): string | undefined {
    for (const key of keys) {
      const value = payload[key];
      const text =
        key === 'delta'
          ? this.normalizeDeltaFragment(value)
          : this.normalizeTextFragment(value);
      if (text) {
        return text;
      }
    }
    return undefined;
  }

  private normalizeDeltaFragment(value: unknown): string | undefined {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        const text = this.normalizeDeltaFragment(entry);
        if (text) {
          return text;
        }
      }
      return undefined;
    }
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      return (
        this.pickStringRaw(obj, ['text', 'transcript', 'delta', 'value']) ??
        this.normalizeDeltaFragment(obj['content'])
      );
    }
    return undefined;
  }

  private normalizeTextFragment(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        const text = this.normalizeTextFragment(entry);
        if (text) {
          return text;
        }
      }
      return undefined;
    }
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      return (
        this.pickString(obj, ['text', 'transcript', 'delta', 'value']) ??
        this.normalizeTextFragment(obj['content'])
      );
    }
    return undefined;
  }

  private resolveItemId(rawId: unknown, event: ProviderEventPayload): string {
    if (typeof rawId === 'string' && rawId.length > 0) {
      return rawId;
    }
    const eventId = this.pickString(event as Record<string, unknown>, ['event_id']);
    if (eventId) {
      return eventId;
    }
    return `evt_${Math.random().toString(36).slice(2, 10)}`;
  }

  private summarizeEventForLog(event: ProviderEventPayload): string {
    const payload = event as Record<string, unknown>;
    const item = payload.item as Record<string, unknown> | undefined;
    const metadata = {
      itemId: this.pickString(payload, ['item_id', 'itemId']) ?? this.pickString(item, ['id']),
      responseId: this.pickString(payload, ['response_id', 'responseId']),
      keys: Object.keys(payload).sort(),
    };

    return `metadata=${JSON.stringify(metadata)}`;
  }
}
