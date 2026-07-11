import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as wrtc from 'wrtc';
import { FileSearchConfig, PersonalityConfig } from './webrtc-signaling.service';
import { ProviderEventPayload, WebRtcProviderEventService } from './webrtc-provider-event.service';

const ICE_GATHERING_TIMEOUT_MS = 2000;
const SPEECH_DEBOUNCE_MS = 300;
const SPEECH_SAMPLE_STRIDE = 16;
const SPEECH_MIN_AMPLITUDE = 500;
const DEFAULT_OPENAI_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_OPENAI_REQUEST_RETRIES = 2;
const DEFAULT_OPENAI_EXPIRY_GRACE_MS = 5_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  retries = 1,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      return response;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt === retries) {
        break;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed');
}

type RTCPeerConnectionType = any;
type RTCDataChannelType = any;
type MediaStreamType = any;
type RTCAudioSourceType = {
  createTrack: () => MediaStreamTrack;
  onData: (data: {
    samples: Int16Array;
    sampleRate: number;
    bitsPerSample: number;
    numberOfChannels?: number;
    channelCount?: number;
  }) => void;
};
type AudioSinkChunk = {
  samples: Int16Array | Float32Array | Buffer;
  sampleRate: number;
  bitsPerSample?: number;
  numberOfChannels?: number;
  channelCount?: number;
};
type RTCAudioSinkType = {
  stop: () => void;
  ondata?: (data: AudioSinkChunk) => void;
};

interface OpenAiSessionInfo {
  id: string;
  model: string;
  clientSecret: string;
  expiresAt?: number;
}

export interface BridgeSessionOptions {
  sessionId: string;
  conversationId: string;
  persona: PersonalityConfig;
  voice: string;
  fileSearch: FileSearchConfig;
  realtimeModel?: string;
  onServerIceCandidate?: (candidate: string) => void;
  translatorMode?: boolean;
}

interface BridgeSessionState extends BridgeSessionOptions {
  createdAt: number;
  status: 'pending' | 'active' | 'closed';
  openAiSession?: OpenAiSessionInfo;
  clientPeer?: RTCPeerConnectionType;
  openAiPeer?: RTCPeerConnectionType;
  clientAudioSource?: RTCAudioSourceType;
  openAiAudioSource?: RTCAudioSourceType;
  clientOutboundTrack?: MediaStreamTrack;
  openAiOutboundTrack?: MediaStreamTrack;
  clientAudioSink?: RTCAudioSinkType;
  openAiAudioSink?: RTCAudioSinkType;
  controlChannel?: RTCDataChannelType;
  responsePending: boolean;
  pendingInputItemId?: string;
  activeResponseId?: string;
  cancelInFlight: boolean;
  systemInstructionsSent: boolean;
  lastResponseRequest?: number;
  lastSpeechDetected?: number;
  speechObserved: boolean;
  closing: boolean;
  initialResponseRequested: boolean;
  pendingClientIceCandidates: string[];
}

@Injectable()
export class OpenAiRealtimeBridgeService {
  private readonly logger = new Logger(OpenAiRealtimeBridgeService.name);
  private readonly sessions = new Map<string, BridgeSessionState>();
  private readonly pendingClientCandidates = new Map<string, string[]>();
  private readonly iceServers: RTCIceServer[];
  private readonly MediaStreamCtor?: { new (): MediaStreamType };
  private readonly RTCAudioSourceCtor?: { new (): RTCAudioSourceType };
  private readonly RTCAudioSinkCtor?: { new (track: MediaStreamTrack): RTCAudioSinkType };
  private readonly audioSupported: boolean;
  private readonly unavailableReason?: string;
  private readonly openaiRequestTimeoutMs: number;
  private readonly openaiRequestRetries: number;
  private readonly openaiExpiryGraceMs: number;
  private readonly enableBargeIn: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly providerEvents: WebRtcProviderEventService,
  ) {
    const configured = this.configService.get<string[]>('webrtc.iceServers') ?? [];
    this.iceServers = configured.map((urls) => ({ urls }));
    this.openaiRequestTimeoutMs =
      this.configService.get<number>('webrtc.openaiRequestTimeoutMs') ??
      DEFAULT_OPENAI_REQUEST_TIMEOUT_MS;
    this.openaiRequestRetries =
      this.configService.get<number>('webrtc.openaiRequestRetries') ??
      DEFAULT_OPENAI_REQUEST_RETRIES;
    this.openaiExpiryGraceMs =
      this.configService.get<number>('webrtc.openaiClientSecretGraceMs') ??
      DEFAULT_OPENAI_EXPIRY_GRACE_MS;
    this.enableBargeIn =
      this.configService.get<boolean>('webrtc.enableBargeIn') ?? true;

    const wrtcLib: any = wrtc;
    const nonstandard = wrtcLib?.nonstandard;
    const mediaStreamCtor = wrtcLib?.MediaStream ?? (globalThis as any)?.MediaStream;
    if (!nonstandard?.RTCAudioSource || !nonstandard?.RTCAudioSink || !mediaStreamCtor) {
      this.audioSupported = false;
      this.unavailableReason =
        'wrtc build missing RTCAudioSource/RTCAudioSink; install wrtc with nonstandard audio support';
      this.logger.error(this.unavailableReason);
      return;
    }

    this.MediaStreamCtor = mediaStreamCtor;
    this.RTCAudioSourceCtor = nonstandard.RTCAudioSource;
    this.RTCAudioSinkCtor = nonstandard.RTCAudioSink;
    this.audioSupported = true;
  }

  private assertAudioSupport(): void {
    if (!this.audioSupported) {
      const reason =
        this.unavailableReason ?? 'wrtc build missing audio support; realtime bridge unavailable';
      throw new Error(reason);
    }
  }

  getAudioSupportStatus(): { supported: boolean; reason?: string } {
    return {
      supported: this.audioSupported,
      reason: this.audioSupported ? undefined : this.unavailableReason,
    };
  }

  async handleClientOffer(
    options: BridgeSessionOptions,
    offerSdp: string,
  ): Promise<{ sdp: string }> {
    this.assertAudioSupport();
    const state = await this.ensureSession(options);
    try {
      const clientPeer = await this.prepareClientPeer(state);
      await this.ensureOpenAiPeer(state);
      await clientPeer.setRemoteDescription({ type: 'offer', sdp: offerSdp });
      await this.flushPendingClientIceCandidates(state);

      const answer = await clientPeer.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await clientPeer.setLocalDescription(answer);
      const local = clientPeer.localDescription;
      if (!local?.sdp) {
        throw new Error('Failed to obtain local SDP answer for client');
      }
      state.status = 'active';
      this.logger.debug(`Bridged SDP answer for session ${state.sessionId}.`);
      return { sdp: local.sdp };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to handle client offer (${state.sessionId}): ${reason}`);
      await this.closeSession(state.sessionId).catch(() => undefined);
      throw error;
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    if (!this.audioSupported) {
      return;
    }
    const state = this.sessions.get(sessionId);
    if (!state || state.closing) {
      return;
    }
    state.closing = true;
    state.status = 'closed';

    this.stopSink(state.clientAudioSink);
    state.clientAudioSink = undefined;
    this.stopSink(state.openAiAudioSink);
    state.openAiAudioSink = undefined;
    this.stopTrack(state.clientOutboundTrack);
    state.clientOutboundTrack = undefined;
    this.stopTrack(state.openAiOutboundTrack);
    state.openAiOutboundTrack = undefined;
    state.pendingClientIceCandidates = [];
    state.onServerIceCandidate = undefined;
    this.pendingClientCandidates.delete(sessionId);

    await this.disposePeer(state.clientPeer);
    await this.disposePeer(state.openAiPeer);
    state.clientPeer = undefined;
    state.openAiPeer = undefined;
    state.clientAudioSource = undefined;
    state.openAiAudioSource = undefined;

    if (state.controlChannel) {
      try {
        state.controlChannel.close();
      } catch {
        // ignore close errors
      }
    }

    this.sessions.delete(sessionId);
    this.logger.debug(`Closed realtime bridge session ${sessionId}.`);
  }

  async addClientIceCandidate(sessionId: string, candidate: string): Promise<void> {
    this.assertAudioSupport();
    if (!candidate) {
      return;
    }
    const state = this.sessions.get(sessionId);
    if (!state) {
      const queue = this.pendingClientCandidates.get(sessionId) ?? [];
      queue.push(candidate);
      this.pendingClientCandidates.set(sessionId, queue);
      return;
    }
    state.pendingClientIceCandidates ??= [];
    const peer = state.clientPeer;
    if (!peer || !peer.remoteDescription) {
      state.pendingClientIceCandidates.push(candidate);
      return;
    }
    await this.applyClientIceCandidate(state, candidate);
  }

  private async ensureSession(options: BridgeSessionOptions): Promise<BridgeSessionState> {
    let state = this.sessions.get(options.sessionId);
    if (!state) {
      state = {
        ...options,
        createdAt: Date.now(),
        status: 'pending',
        responsePending: false,
        cancelInFlight: false,
        systemInstructionsSent: false,
        speechObserved: false,
        closing: false,
        initialResponseRequested: false,
        pendingClientIceCandidates: [],
      };
      const queued = this.pendingClientCandidates.get(options.sessionId);
      if (queued?.length) {
        state.pendingClientIceCandidates.push(...queued);
        this.pendingClientCandidates.delete(options.sessionId);
      }
      this.sessions.set(options.sessionId, state);
    } else {
      state.persona = options.persona;
      state.voice = options.voice;
      state.fileSearch = options.fileSearch;
      state.realtimeModel = options.realtimeModel ?? state.realtimeModel;
      state.onServerIceCandidate = options.onServerIceCandidate ?? state.onServerIceCandidate;
      state.translatorMode = options.translatorMode ?? state.translatorMode;
    }
    state.onServerIceCandidate = options.onServerIceCandidate ?? state.onServerIceCandidate;
    if (!state.pendingClientIceCandidates) {
      state.pendingClientIceCandidates = [];
    }
    const queued = this.pendingClientCandidates.get(options.sessionId);
    if (queued?.length) {
      state.pendingClientIceCandidates.push(...queued);
      this.pendingClientCandidates.delete(options.sessionId);
    }
    return state;
  }

  private async prepareClientPeer(state: BridgeSessionState): Promise<RTCPeerConnectionType> {
    if (state.clientPeer) {
      return state.clientPeer;
    }

    const wrtcLib: any = wrtc;
    const peer: RTCPeerConnectionType = new wrtcLib.RTCPeerConnection({
      iceServers: this.iceServers,
    });
    state.clientPeer = peer;

    peer.onconnectionstatechange = () => {
      const status = peer.connectionState;
      this.logger.debug(
        `Client peer state (${state.sessionId}): ${status ?? 'unknown'}`,
      );
      if (
        status === 'failed' ||
        status === 'disconnected' ||
        status === 'closed'
      ) {
        void this.closeSession(state.sessionId);
      }
    };

    peer.onicecandidate = (event: any) => {
      const candidate = event?.candidate?.candidate;
      if (!candidate) {
        return;
      }
      if (state.onServerIceCandidate) {
        try {
          state.onServerIceCandidate(candidate);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Failed to emit server ICE candidate (${state.sessionId}): ${reason}`,
          );
        }
      }
    };

    const outboundStream = new (this.MediaStreamCtor as { new (): MediaStreamType })();
    const audioSource = new (this.RTCAudioSourceCtor as { new (): RTCAudioSourceType })();
    const outboundTrack = audioSource.createTrack();
    outboundStream.addTrack(outboundTrack);
    peer.addTrack(outboundTrack, outboundStream);
    state.clientAudioSource = audioSource;
    state.clientOutboundTrack = outboundTrack;

    peer.ontrack = (event: RTCTrackEvent) => {
      if (event.track.kind !== 'audio') {
        return;
      }
      this.logger.log(`Received remote audio track from client (${state.sessionId}).`);
      this.attachClientSink(state, event.track);
    };

    return peer;
  }

  private attachClientSink(state: BridgeSessionState, track: MediaStreamTrack): void {
    this.stopSink(state.clientAudioSink);
    const sink = new (this.RTCAudioSinkCtor as { new (track: MediaStreamTrack): RTCAudioSinkType })(
      track,
    );
    state.clientAudioSink = sink;

    sink.ondata = (chunk: AudioSinkChunk) => {
      if (this.chunkContainsSpeech(chunk)) {
        this.markSpeechObserved(state);
      }
      this.forwardSamplesToSource(state.openAiAudioSource, chunk, 'client->openai');
    };

    track.onended = () => {
      this.stopSink(state.clientAudioSink);
      state.clientAudioSink = undefined;
    };
  }

  private attachOpenAiSink(state: BridgeSessionState, track: MediaStreamTrack): void {
    this.stopSink(state.openAiAudioSink);
    const sink = new (this.RTCAudioSinkCtor as { new (track: MediaStreamTrack): RTCAudioSinkType })(
      track,
    );
    state.openAiAudioSink = sink;

    sink.ondata = (chunk: AudioSinkChunk) => {
      this.forwardSamplesToSource(state.clientAudioSource, chunk, 'openai->client');
    };

    track.onended = () => {
      this.stopSink(state.openAiAudioSink);
      state.openAiAudioSink = undefined;
    };
  }

  private async ensureOpenAiPeer(state: BridgeSessionState): Promise<RTCPeerConnectionType> {
    await this.refreshOpenAiSessionIfExpired(state);
    if (state.openAiPeer) {
      return state.openAiPeer;
    }

    const openAiSession = await this.ensureOpenAiSession(state);
    const wrtcLib: any = wrtc;
    const peer: RTCPeerConnectionType = new wrtcLib.RTCPeerConnection({
      iceServers: this.iceServers,
    });
    state.openAiPeer = peer;

    peer.onconnectionstatechange = () => {
      const status = peer.connectionState;
      this.logger.debug(
        `OpenAI peer state (${state.sessionId}): ${status ?? 'unknown'}`,
      );
      if (
        status === 'failed' ||
        status === 'disconnected' ||
        status === 'closed'
      ) {
        void this.closeSession(state.sessionId);
      }
    };

    peer.ontrack = (event: RTCTrackEvent) => {
      if (event.track.kind !== 'audio') {
        return;
      }
      this.logger.log(`Received remote audio track from OpenAI (${state.sessionId}).`);
      this.attachOpenAiSink(state, event.track);
    };

    peer.ondatachannel = (event: RTCDataChannelEvent) => {
      this.registerControlChannel(state, event.channel);
    };

    const outboundStream = new (this.MediaStreamCtor as { new (): MediaStreamType })();
    const audioSource = new (this.RTCAudioSourceCtor as { new (): RTCAudioSourceType })();
    const outboundTrack = audioSource.createTrack();
    outboundStream.addTrack(outboundTrack);
    peer.addTrack(outboundTrack, outboundStream);
    state.openAiAudioSource = audioSource;
    state.openAiOutboundTrack = outboundTrack;

    this.registerControlChannel(state, peer.createDataChannel('oai-events'));

    const offer = await peer.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });
    await peer.setLocalDescription(offer);
    await this.waitForIceGatheringComplete(peer);
    const local = peer.localDescription;
    if (!local?.sdp) {
      throw new Error('Failed to collect local SDP for OpenAI peer');
    }

    const remoteSdp = await this.exchangeSdpWithOpenAi(openAiSession, local.sdp);
    await peer.setRemoteDescription({
      type: 'answer',
      sdp: remoteSdp,
    });

    return peer;
  }

  private async flushPendingClientIceCandidates(state: BridgeSessionState): Promise<void> {
    const peer = state.clientPeer;
    if (!peer?.remoteDescription) {
      return;
    }
    const pending = state.pendingClientIceCandidates;
    if (!pending?.length) {
      return;
    }
    const candidates = pending.splice(0, pending.length);
    for (const candidate of candidates) {
      await this.applyClientIceCandidate(state, candidate);
    }
  }

  private async applyClientIceCandidate(state: BridgeSessionState, candidate: string): Promise<void> {
    if (!candidate || !state.clientPeer) {
      return;
    }
    try {
      await state.clientPeer.addIceCandidate({ candidate });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to add client ICE candidate (${state.sessionId}): ${reason}`,
      );
    }
  }

  private async ensureOpenAiSession(state: BridgeSessionState): Promise<OpenAiSessionInfo> {
    if (state.openAiSession && !this.isOpenAiSessionExpired(state.openAiSession)) {
      return state.openAiSession;
    }
    if (state.openAiSession && this.isOpenAiSessionExpired(state.openAiSession)) {
      this.logger.warn(`OpenAI session expired for ${state.sessionId}; refreshing client secret.`);
      state.openAiSession = undefined;
    }

    const apiKey = this.configService.get<string>('webrtc.openaiApiKey');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const model =
      state.realtimeModel ??
      this.configService.get<string>('webrtc.openaiRealtimeModel') ??
      'gpt-4o-realtime-preview';
    const transcriptionModel =
      this.configService.get<string>('webrtc.inputAudioTranscriptionModel')?.trim() ?? '';

    const instructions = this.composeInstructions(state.persona);
    const payload: Record<string, unknown> = {
      model,
    };
    if (instructions) {
      payload.instructions = instructions;
    }
    const trimmedVoice = (state.voice ?? '').trim();
    if (trimmedVoice.length > 0) {
      payload.voice = trimmedVoice;
    }
    if (transcriptionModel.length > 0) {
      payload.input_audio_transcription = { model: transcriptionModel };
    }

    const response = await fetchWithTimeout(
      'https://api.openai.com/v1/realtime/sessions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'realtime=v1',
        },
        body: JSON.stringify(payload),
      },
      this.openaiRequestTimeoutMs,
      this.openaiRequestRetries,
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI session creation failed (${response.status}): ${body}`);
    }

    const json = (await response.json()) as any;
    const clientSecret = json?.client_secret?.value;
    if (!clientSecret) {
      throw new Error('OpenAI realtime session response missing client secret');
    }

    const session: OpenAiSessionInfo = {
      id: json?.id ?? state.sessionId,
      model: json?.model ?? model,
      clientSecret,
      expiresAt: this.parseExpiresAt(json?.client_secret?.expires_at),
    };
    state.openAiSession = session;
    return session;
  }

  private async exchangeSdpWithOpenAi(
    session: OpenAiSessionInfo,
    offerSdp: string,
  ): Promise<string> {
    const target = `https://api.openai.com/v1/realtime?model=${encodeURIComponent(
      session.model,
    )}`;
    const response = await fetchWithTimeout(
      target,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.clientSecret}`,
          'Content-Type': 'application/sdp',
          'OpenAI-Beta': 'realtime=v1',
        },
        body: offerSdp,
      },
      this.openaiRequestTimeoutMs,
      this.openaiRequestRetries,
    );

    if (!response.ok) {
      const bodyText = await response.text();
      const detail =
        bodyText && bodyText.length < 512
          ? bodyText
          : `status=${response.status}, sdp_bytes=${offerSdp.length}`;
      throw new Error(
        `OpenAI SDP exchange failed (${response.status}) for model=${session.model}: ${detail}`,
      );
    }

    return response.text();
  }

  private registerControlChannel(state: BridgeSessionState, channel?: RTCDataChannelType): void {
    if (!channel) {
      return;
    }

    channel.onopen = () => {
      this.logger.debug(`OpenAI data channel ready (${state.sessionId}).`);
      state.controlChannel = channel;
      if (state.translatorMode) {
        this.sendSystemInstructions(state);
      }
      if (state.speechObserved && !state.responsePending && !state.translatorMode) {
        this.requestAssistantResponse(state, 'channel-open');
      }
    };

    channel.onclose = () => {
      if (state.controlChannel === channel) {
        state.controlChannel = undefined;
        state.responsePending = false;
      }
    };

    channel.onerror = (event: Event) => {
      this.logger.warn(
        `OpenAI data channel error (${state.sessionId}): ${JSON.stringify(event)}`,
      );
    };

    channel.onmessage = (event: MessageEvent) => {
      const payload = this.parseProviderPayload(event.data);
      if (payload) {
        this.handleProviderPayload(state, payload);
      }
    };
  }

  private parseProviderPayload(message: unknown): ProviderEventPayload | undefined {
    if (message == null) {
      return undefined;
    }
    try {
      if (typeof message === 'string') {
        return JSON.parse(message);
      }
      if (message instanceof ArrayBuffer) {
        return JSON.parse(Buffer.from(message).toString('utf8'));
      }
      if (Array.isArray(message)) {
        return undefined;
      }
      if ((message as Blob).arrayBuffer) {
        return undefined;
      }
      return JSON.parse(String(message));
    } catch (error) {
      this.logger.warn(
        `Failed to parse provider payload: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return undefined;
    }
  }

  private handleProviderPayload(state: BridgeSessionState, payload: ProviderEventPayload): void {
    switch (payload.type) {
      case 'conversation.item.created':
      case 'conversation.item.completed':
        break;
      case 'response.created': {
        const response = (payload as Record<string, unknown>).response as
          | Record<string, unknown>
          | undefined;
        const responseId = this.pickString(response, ['id', 'response_id']);
        if (responseId) {
          state.activeResponseId = responseId;
          state.cancelInFlight = false;
        }
        break;
      }
      case 'input_audio_buffer.speech_started':
        this.markSpeechObserved(state);
        if (this.enableBargeIn && (state.responsePending || state.activeResponseId)) {
          this.cancelActiveResponse(state, 'speech-start');
          if (!state.translatorMode) {
            this.requestAssistantResponse(
              state,
              'barge-in',
              this.pickString(payload as Record<string, unknown>, [
                'item_id',
                'input_audio_buffer_id',
              ]),
            );
          }
        }
        break;
      case 'input_audio_buffer.committed':
        this.markSpeechObserved(state);
        if (!state.translatorMode) {
          this.requestAssistantResponse(
            state,
            'buffer-committed',
            this.pickString(payload as Record<string, unknown>, [
              'item_id',
              'input_audio_buffer_id',
            ]),
          );
        }
        break;
      case 'input_audio_buffer.speech_stopped':
        this.markSpeechObserved(state);
        if (!state.translatorMode) {
          this.requestAssistantResponse(
            state,
            'speech-stopped',
            this.pickString(payload as Record<string, unknown>, [
              'item_id',
              'input_audio_buffer_id',
            ]),
          );
        }
        break;
      case 'conversation.item.input_audio_transcription.completed':
      case 'conversation.item.input_audio_transcription.done':
      case 'input_audio_transcription.completed':
      case 'input_audio_transcription.done':
        this.markSpeechObserved(state);
        if (state.translatorMode) {
          const payloadRecord = payload as Record<string, unknown>;
          const transcript = this.extractInputTranscript(payloadRecord);
          const inputItemId = this.pickString(payloadRecord, [
            'item_id',
            'itemId',
            'input_audio_buffer_id',
          ]);
          if (transcript) {
            this.requestTranslationResponse(
              state,
              'transcription-completed',
              transcript,
              inputItemId,
            );
            break;
          }
        }
        this.requestAssistantResponse(state, 'transcription-completed');
        break;
      case 'response.done':
      case 'response.error':
      case 'response.cancelled':
        this.markResponseCompleted(state);
        break;
      case 'error':
        this.handleProviderError(state, payload);
        break;
      default:
        break;
    }

    try {
      this.providerEvents.processEvents(state.sessionId, [payload]);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Provider event processing failed (${state.sessionId}, ${payload.type}): ${reason}`,
      );
    }
  }

  private markSpeechObserved(state: BridgeSessionState): void {
    const now = Date.now();
    if (
      state.lastSpeechDetected &&
      now - state.lastSpeechDetected < SPEECH_DEBOUNCE_MS
    ) {
      return;
    }
    state.lastSpeechDetected = now;
    state.speechObserved = true;
    this.logger.log(`Detected caller speech (${state.sessionId}).`);
  }

  private markResponseCompleted(state: BridgeSessionState): void {
    state.responsePending = false;
    state.pendingInputItemId = undefined;
    state.activeResponseId = undefined;
    state.cancelInFlight = false;
    state.lastResponseRequest = undefined;
  }

  private handleProviderError(state: BridgeSessionState, payload: ProviderEventPayload): void {
    const error = (payload as any)?.error;
    if (!error || typeof error !== 'object') {
      return;
    }
    const code = typeof error.code === 'string' ? error.code : undefined;
    if (code === 'conversation_already_has_active_response') {
      this.logger.warn(
        `Provider rejected response.create due to active response (${state.sessionId}).`,
      );
      state.responsePending = false;
      state.pendingInputItemId = undefined;
      state.activeResponseId = undefined;
      state.cancelInFlight = false;
    }
  }

  private requestAssistantResponse(
    state: BridgeSessionState,
    reason: string,
    inputItemId?: string,
  ): boolean {
    const channel = state.controlChannel;
    if (!channel || channel.readyState !== 'open') {
      return false;
    }
    if (state.responsePending) {
      return false;
    }
    if (state.pendingInputItemId && inputItemId && state.pendingInputItemId === inputItemId) {
      return false;
    }
    if (state.cancelInFlight) {
      return false;
    }

    const instructions = this.composeInstructions(state.persona);
    const responsePayload: Record<string, unknown> = {
      modalities: ['audio', 'text'],
    };
    if (instructions) {
      responsePayload.instructions = instructions;
    }
    if (state.translatorMode) {
      responsePayload.temperature = 0;
      responsePayload.max_output_tokens = 512;
    }
    const payload = JSON.stringify({
      type: 'response.create',
      response: responsePayload,
    });

    try {
      channel.send(payload);
      state.responsePending = true;
      state.pendingInputItemId = inputItemId ?? state.pendingInputItemId;
      state.lastResponseRequest = Date.now();
      state.speechObserved = false;
      state.initialResponseRequested = true;
      this.logger.log(`Sent response.create (${state.sessionId}, reason=${reason}).`);
      return true;
    } catch (error) {
      const reasonText = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to send response.create (${state.sessionId}): ${reasonText}`,
      );
      state.responsePending = false;
      return false;
    }
  }

  private requestTranslationResponse(
    state: BridgeSessionState,
    reason: string,
    transcript: string,
    inputItemId?: string,
  ): boolean {
    const channel = state.controlChannel;
    if (!channel || channel.readyState !== 'open') {
      return false;
    }
    if (state.responsePending) {
      return false;
    }
    if (state.pendingInputItemId && inputItemId && state.pendingInputItemId === inputItemId) {
      return false;
    }
    if (state.cancelInFlight) {
      return false;
    }

    const cleanedTranscript = transcript.trim();
    if (!cleanedTranscript) {
      return false;
    }

    const baseInstructions = this.composeInstructions(state.persona);
    const translationInstructions = [
      baseInstructions,
      'Translate the following text and output only the translation.',
      'Preserve punctuation and question marks; if the input is a question, the output must be a question.',
      'Do not answer or add new information.',
      `Text: """${cleanedTranscript}"""`,
    ]
      .filter((value) => Boolean(value && value.trim()))
      .join(' ');

    const responsePayload: Record<string, unknown> = {
      modalities: ['audio', 'text'],
      instructions: translationInstructions,
      temperature: 0,
      max_output_tokens: 512,
    };
    const payload = JSON.stringify({
      type: 'response.create',
      response: responsePayload,
    });

    try {
      channel.send(payload);
      state.responsePending = true;
      state.pendingInputItemId = inputItemId ?? state.pendingInputItemId;
      state.lastResponseRequest = Date.now();
      state.speechObserved = false;
      state.initialResponseRequested = true;
      this.logger.log(`Sent response.create (${state.sessionId}, reason=${reason}).`);
      return true;
    } catch (error) {
      const reasonText = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to send response.create (${state.sessionId}): ${reasonText}`,
      );
      state.responsePending = false;
      return false;
    }
  }

  private stopSink(sink?: RTCAudioSinkType): void {
    if (!sink) {
      return;
    }
    try {
      sink.stop();
    } catch {
      // ignore sink stop errors
    }
  }

  private stopTrack(track?: MediaStreamTrack): void {
    if (!track) {
      return;
    }
    try {
      track.stop();
    } catch {
      // ignore track stop errors
    }
  }

  private forwardSamplesToSource(
    source: RTCAudioSourceType | undefined,
    chunk: AudioSinkChunk | undefined,
    label: string,
  ): void {
    if (!source || !chunk) {
      return;
    }

    const numberOfChannels = chunk.numberOfChannels ?? chunk.channelCount ?? 1;
    const sampleRate = chunk.sampleRate ?? 48_000;

    const samples = this.extractInt16Samples(chunk);

    if (!samples) {
      this.logger.warn(`Unsupported audio sample format for ${label}.`);
      return;
    }

    try {
      source.onData({
        samples,
        sampleRate,
        bitsPerSample: chunk.bitsPerSample ?? 16,
        numberOfChannels,
        channelCount: numberOfChannels,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to forward audio chunk (${label}): ${reason}`);
    }
  }

  private float32ToInt16(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, input[i]));
      output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return output;
  }

  private extractInt16Samples(chunk: AudioSinkChunk | undefined): Int16Array | null {
    if (!chunk?.samples) {
      return null;
    }
    if (chunk.samples instanceof Int16Array) {
      return chunk.samples;
    }
    if (chunk.samples instanceof Float32Array) {
      return this.float32ToInt16(chunk.samples);
    }
    if (Buffer.isBuffer(chunk.samples)) {
      return new Int16Array(
        chunk.samples.buffer,
        chunk.samples.byteOffset,
        chunk.samples.byteLength / Int16Array.BYTES_PER_ELEMENT,
      );
    }
    return null;
  }

  private chunkContainsSpeech(chunk: AudioSinkChunk | undefined): boolean {
    const samples = this.extractInt16Samples(chunk);
    if (!samples || samples.length === 0) {
      return false;
    }

    for (let i = 0; i < samples.length; i += SPEECH_SAMPLE_STRIDE) {
      if (Math.abs(samples[i]) >= SPEECH_MIN_AMPLITUDE) {
        return true;
      }
    }

    return false;
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

  private extractInputTranscript(payload: Record<string, unknown>): string | undefined {
    const direct = this.extractTranscriptValue(payload.transcript ?? payload.text ?? payload.final);
    if (direct) {
      return direct;
    }
    const item = payload.item as Record<string, unknown> | undefined;
    if (item) {
      const nested = this.extractTranscriptValue(item.transcript ?? item.text ?? item.final);
      if (nested) {
        return nested;
      }
    }
    return undefined;
  }

  private extractTranscriptValue(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    if (value && typeof value === 'object') {
      return this.pickString(value as Record<string, unknown>, [
        'text',
        'transcript',
        'value',
      ]);
    }
    return undefined;
  }

  private cancelActiveResponse(state: BridgeSessionState, reason: string): void {
    if (state.cancelInFlight || (!state.responsePending && !state.activeResponseId)) {
      return;
    }
    const channel = state.controlChannel;
    if (!channel || channel.readyState !== 'open') {
      return;
    }

    const payload: Record<string, unknown> = { type: 'response.cancel' };
    if (state.activeResponseId) {
      payload.response_id = state.activeResponseId;
    }

    try {
      channel.send(JSON.stringify(payload));
      state.cancelInFlight = true;
      state.responsePending = false;
      state.pendingInputItemId = undefined;
      this.logger.log(`Sent response.cancel (${state.sessionId}, reason=${reason}).`);
    } catch (error) {
      const reasonText = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to send response.cancel (${state.sessionId}): ${reasonText}`);
    }
  }

  private sendSystemInstructions(state: BridgeSessionState): void {
    if (state.systemInstructionsSent) {
      return;
    }
    const channel = state.controlChannel;
    if (!channel || channel.readyState !== 'open') {
      return;
    }
    const instructions = this.composeInstructions(state.persona);
    if (!instructions) {
      return;
    }
    const payload = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'system',
        content: [{ type: 'input_text', text: instructions }],
      },
    };
    try {
      channel.send(JSON.stringify(payload));
      state.systemInstructionsSent = true;
      this.logger.debug(`Sent system instructions (${state.sessionId}).`);
    } catch (error) {
      const reasonText = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to send system instructions (${state.sessionId}): ${reasonText}`);
    }
  }

  private async disposePeer(peer?: RTCPeerConnectionType): Promise<void> {
    if (!peer) {
      return;
    }
    try {
      peer.ontrack = null;
      peer.ondatachannel = null;
      peer.onconnectionstatechange = null;
      peer.oniceconnectionstatechange = null;
    } catch {
      // ignore
    }
    try {
      await peer.close();
    } catch {
      // ignore close errors
    }
  }

  private async waitForIceGatheringComplete(peer: RTCPeerConnectionType): Promise<void> {
    if (peer.iceGatheringState === 'complete') {
      return;
    }

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        peer.removeEventListener?.('icegatheringstatechange', onStateChange);
        resolve();
      }, ICE_GATHERING_TIMEOUT_MS);

      const onStateChange = () => {
        if (peer.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          peer.removeEventListener?.('icegatheringstatechange', onStateChange);
          resolve();
        }
      };

      peer.addEventListener?.('icegatheringstatechange', onStateChange);
    });
  }

  private isOpenAiSessionExpired(session: OpenAiSessionInfo): boolean {
    if (!session.expiresAt || session.expiresAt <= 0) {
      return false;
    }
    return Date.now() >= session.expiresAt - this.openaiExpiryGraceMs;
  }

  private async refreshOpenAiSessionIfExpired(state: BridgeSessionState): Promise<void> {
    if (!state.openAiSession || !this.isOpenAiSessionExpired(state.openAiSession)) {
      return;
    }
    this.logger.warn(`OpenAI client secret expired; rebuilding peer for session ${state.sessionId}.`);
    await this.disposeOpenAiPeer(state);
    state.openAiSession = undefined;
    state.responsePending = false;
    state.initialResponseRequested = false;
  }

  private async disposeOpenAiPeer(state: BridgeSessionState): Promise<void> {
    this.stopSink(state.openAiAudioSink);
    state.openAiAudioSink = undefined;
    this.stopTrack(state.openAiOutboundTrack);
    state.openAiOutboundTrack = undefined;
    state.openAiAudioSource = undefined;
    try {
      state.controlChannel?.close();
    } catch {
      // ignore
    }
    state.controlChannel = undefined;
    await this.disposePeer(state.openAiPeer);
    state.openAiPeer = undefined;
  }

  private parseExpiresAt(raw: unknown): number | undefined {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
      return Math.round(raw);
    }
    if (typeof raw === 'string' && raw.trim().length > 0) {
      const parsed = Date.parse(raw);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
      const asNumber = Number(raw);
      if (Number.isFinite(asNumber)) {
        return Math.round(asNumber);
      }
    }
    return undefined;
  }

  private composeInstructions(persona: PersonalityConfig): string {
    const pieces: string[] = [];
    if (persona?.name?.trim()) {
      pieces.push(`You are "${persona.name.trim()}".`);
    }
    if (persona?.description?.trim()) {
      pieces.push(persona.description.trim());
    }
    if (persona?.tone?.trim()) {
      pieces.push(`Use a ${persona.tone.trim()} tone.`);
    }
    const locale = persona?.locale?.trim();
    if (locale && locale.toLowerCase() !== 'auto') {
      pieces.push(`Speak in ${locale}.`);
    }
    if (persona?.rules?.trim()) {
      pieces.push(`Rules: ${persona.rules.trim()}`);
    }
    if (pieces.length === 0) {
      return 'You are a helpful voice assistant. Respond concisely.';
    }
    return pieces.join(' ');
  }
}
