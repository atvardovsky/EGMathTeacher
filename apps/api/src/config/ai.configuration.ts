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
