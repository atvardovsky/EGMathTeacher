import { registerAs } from '@nestjs/config';

function parseIceServers(raw?: string): string[] {
  if (!raw) {
    return ['stun:stun.l.google.com:19302'];
  }

  const parsed = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : ['stun:stun.l.google.com:19302'];
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (typeof value !== 'string') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

export default registerAs('webrtc', () => ({
  openaiRealtimeModel: process.env.OPENAI_REALTIME_MODEL ?? 'gpt-4o-realtime-preview',
  inputAudioTranscriptionModel: process.env.OPENAI_INPUT_TRANSCRIPTION_MODEL ?? 'gpt-4o-mini-transcribe',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  iceServers: parseIceServers(process.env.WEBRTC_ICE_SERVERS),
  maxConcurrentSessions: parseInt(process.env.WEBRTC_MAX_SESSIONS ?? '25', 10),
  enableBargeIn: parseBoolean(process.env.WEBRTC_ENABLE_BARGE_IN, true),
  sessionIdleTimeoutMs: parseNumber(process.env.WEBRTC_SESSION_IDLE_TIMEOUT_MS, 5 * 60 * 1000),
  sessionIdleSweepIntervalMs: parseNumber(process.env.WEBRTC_IDLE_SWEEP_INTERVAL_MS, 60 * 1000),
  openaiRequestTimeoutMs: parseNumber(process.env.OPENAI_REQUEST_TIMEOUT_MS, 10_000),
  openaiRequestRetries: parseNumber(process.env.OPENAI_REQUEST_RETRIES, 2),
  openaiClientSecretGraceMs: parseNumber(process.env.OPENAI_CLIENT_SECRET_GRACE_MS, 5_000),
  assistantPersonality: {
    name: process.env.ASSISTANT_PERSONALITY_NAME ?? 'Voice Assistant',
    description:
      process.env.ASSISTANT_PERSONALITY_DESCRIPTION ??
      'A helpful, conversational voice companion.',
    tone: process.env.ASSISTANT_PERSONALITY_TONE ?? 'friendly',
    locale: process.env.ASSISTANT_PERSONALITY_LOCALE ?? 'auto',
    rules:
      process.env.ASSISTANT_RULES ??
      'Stay polite, concise, and clarify when unsure. Always cite relevant documents when answering policy or documentation questions.',
  },
  fileSearch: {
    documentationIds: (process.env.FILE_SEARCH_DOCUMENTATION_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
    ruleIds: (process.env.FILE_SEARCH_RULE_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  },
  voices: {
    default: process.env.ASSISTANT_DEFAULT_VOICE ?? 'alloy',
    available: (process.env.ASSISTANT_AVAILABLE_VOICES ?? 'alloy,verse,sol')
      .split(',')
      .map((voice) => voice.trim())
      .filter(Boolean),
  },
}));
