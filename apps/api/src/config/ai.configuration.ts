import { registerAs } from '@nestjs/config';

export default registerAs('ai', () => ({
  provider: (process.env.AI_PROVIDER ?? 'openai-realtime').toLowerCase(),
  modelProvider: (process.env.AI_MODEL_PROVIDER ?? 'openai').toLowerCase(),
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    realtimeModel:
      process.env.OPENAI_REALTIME_MODEL ?? 'gpt-4o-realtime-preview',
    responsesModel: process.env.OPENAI_RESPONSES_MODEL ?? 'gpt-5.5',
    imageModel: process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2',
    vectorStoreIds: (process.env.OPENAI_VECTOR_STORE_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
    requestTimeoutMs: parseInt(process.env.OPENAI_REQUEST_TIMEOUT_MS ?? '30000', 10),
  },
  background: {
    enabled: (process.env.AI_BACKGROUND_ENABLED ?? 'true').toLowerCase() !== 'false',
    batchingEnabled: (process.env.AI_BACKGROUND_BATCHING_ENABLED ?? 'true').toLowerCase() !== 'false',
    responsesModel: process.env.OPENAI_BACKGROUND_RESPONSES_MODEL ?? '',
    windowResponsesModel: process.env.OPENAI_BACKGROUND_WINDOW_RESPONSES_MODEL ?? '',
    refreshResponsesModel: process.env.OPENAI_BACKGROUND_REFRESH_RESPONSES_MODEL ?? '',
    serviceTier: process.env.OPENAI_BACKGROUND_SERVICE_TIER ?? 'flex',
    promptCacheKeyEnabled:
      (process.env.AI_BACKGROUND_PROMPT_CACHE_KEY_ENABLED ?? 'true').toLowerCase() !== 'false',
    drainIntervalMs: parseInt(process.env.AI_BACKGROUND_DRAIN_INTERVAL_MS ?? '2000', 10),
    drainBatchSize: parseInt(process.env.AI_BACKGROUND_DRAIN_BATCH_SIZE ?? '3', 10),
    maxAttempts: parseInt(process.env.AI_BACKGROUND_MAX_ATTEMPTS ?? '2', 10),
    observationWindowSize: parseInt(
      process.env.AI_BACKGROUND_OBSERVATION_WINDOW_SIZE ?? '10',
      10,
    ),
    observationMaxWindowSize: parseInt(
      process.env.AI_BACKGROUND_OBSERVATION_MAX_WINDOW_SIZE ?? '12',
      10,
    ),
    observationIdleFlushMs: parseInt(
      process.env.AI_BACKGROUND_OBSERVATION_IDLE_FLUSH_MS ?? '900000',
      10,
    ),
    profileRefreshTurnInterval: parseInt(
      process.env.AI_BACKGROUND_PROFILE_REFRESH_TURN_INTERVAL ?? '10',
      10,
    ),
    sessionSummaryTurnInterval: parseInt(
      process.env.AI_BACKGROUND_SESSION_SUMMARY_TURN_INTERVAL ?? '5',
      10,
    ),
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    liveModel: process.env.GEMINI_LIVE_MODEL ?? '',
  },
  hume: {
    apiKey: process.env.HUME_API_KEY ?? '',
    secretKey: process.env.HUME_SECRET_KEY ?? '',
  },
  retell: {
    apiKey: process.env.RETELL_API_KEY ?? '',
  },
}));
