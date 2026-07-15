import { registerAs } from '@nestjs/config';

export default registerAs('ai', () => {
  const responsesModel = process.env.OPENAI_RESPONSES_MODEL ?? 'gpt-5.5';
  const imageModel = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2';
  const backgroundResponsesModel = process.env.OPENAI_BACKGROUND_RESPONSES_MODEL ?? '';
  const backgroundWindowModel = process.env.OPENAI_BACKGROUND_WINDOW_RESPONSES_MODEL ?? '';
  const backgroundRefreshModel = process.env.OPENAI_BACKGROUND_REFRESH_RESPONSES_MODEL ?? '';
  const backgroundServiceTier = process.env.OPENAI_BACKGROUND_SERVICE_TIER ?? 'flex';

  return {
    provider: (process.env.AI_PROVIDER ?? 'openai-realtime').toLowerCase(),
    modelProvider: (process.env.AI_MODEL_PROVIDER ?? 'openai').toLowerCase(),
    openai: {
      apiKey: process.env.OPENAI_API_KEY ?? '',
      realtimeModel:
        process.env.OPENAI_REALTIME_MODEL ?? 'gpt-4o-realtime-preview',
      responsesModel,
      imageModel,
      imageSize: process.env.OPENAI_IMAGE_SIZE ?? '1024x1024',
      imageQuality: process.env.OPENAI_IMAGE_QUALITY ?? 'low',
      vectorStoreIds: (process.env.OPENAI_VECTOR_STORE_IDS ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
      requestTimeoutMs: parseInt(process.env.OPENAI_REQUEST_TIMEOUT_MS ?? '30000', 10),
    },
    operationModels: {
      lessonDecision: process.env.AI_OPERATION_LESSON_DECISION_MODEL ?? responsesModel,
      tutorAnswer: process.env.AI_OPERATION_TUTOR_ANSWER_MODEL ?? responsesModel,
      tutorAnswerWithRag:
        process.env.AI_OPERATION_TUTOR_ANSWER_WITH_RAG_MODEL ??
        process.env.AI_OPERATION_TUTOR_ANSWER_MODEL ??
        responsesModel,
      tutorImage: process.env.AI_OPERATION_TUTOR_IMAGE_MODEL ?? imageModel,
      onboardingConversationExtraction:
        process.env.AI_OPERATION_ONBOARDING_CONVERSATION_EXTRACTION_MODEL ??
        process.env.AI_OPERATION_ONBOARDING_KNOWLEDGE_MODEL ??
        responsesModel,
      onboardingKnowledgeDiagnosis:
        process.env.AI_OPERATION_ONBOARDING_KNOWLEDGE_MODEL ?? responsesModel,
      onboardingPsychopedagogicalProfile:
        process.env.AI_OPERATION_ONBOARDING_PSYCHOPEDAGOGICAL_MODEL ?? responsesModel,
      onboardingStrategyPlan:
        process.env.AI_OPERATION_ONBOARDING_STRATEGY_MODEL ?? responsesModel,
      backgroundLearningSignal:
        process.env.AI_OPERATION_BACKGROUND_LEARNING_SIGNAL_MODEL ??
        backgroundResponsesModel,
      backgroundLearningWindow:
        process.env.AI_OPERATION_BACKGROUND_LEARNING_WINDOW_MODEL ??
        backgroundWindowModel,
      backgroundRealtimeSessionReview:
        process.env.AI_OPERATION_BACKGROUND_REALTIME_SESSION_REVIEW_MODEL ??
        backgroundResponsesModel,
      backgroundSessionSummary:
        process.env.AI_OPERATION_BACKGROUND_SESSION_SUMMARY_MODEL ??
        backgroundResponsesModel,
      backgroundProfileRefresh:
        process.env.AI_OPERATION_BACKGROUND_PROFILE_REFRESH_MODEL ??
        backgroundRefreshModel,
      backgroundTeachingStrategyRefresh:
        process.env.AI_OPERATION_BACKGROUND_TEACHING_STRATEGY_REFRESH_MODEL ??
        backgroundRefreshModel,
      backgroundProfileStrategyRefresh:
        process.env.AI_OPERATION_BACKGROUND_PROFILE_STRATEGY_REFRESH_MODEL ??
        backgroundRefreshModel,
      backgroundQualityReview:
        process.env.AI_OPERATION_BACKGROUND_QUALITY_REVIEW_MODEL ??
        backgroundResponsesModel,
    },
    operationServiceTiers: {
      lessonDecision: process.env.AI_OPERATION_LESSON_DECISION_SERVICE_TIER ?? '',
      tutorAnswer: process.env.AI_OPERATION_TUTOR_ANSWER_SERVICE_TIER ?? '',
      tutorAnswerWithRag:
        process.env.AI_OPERATION_TUTOR_ANSWER_WITH_RAG_SERVICE_TIER ?? '',
      onboardingConversationExtraction:
        process.env.AI_OPERATION_ONBOARDING_CONVERSATION_EXTRACTION_SERVICE_TIER ??
        process.env.AI_OPERATION_ONBOARDING_KNOWLEDGE_SERVICE_TIER ??
        '',
      onboardingKnowledgeDiagnosis:
        process.env.AI_OPERATION_ONBOARDING_KNOWLEDGE_SERVICE_TIER ?? '',
      onboardingPsychopedagogicalProfile:
        process.env.AI_OPERATION_ONBOARDING_PSYCHOPEDAGOGICAL_SERVICE_TIER ?? '',
      onboardingStrategyPlan:
        process.env.AI_OPERATION_ONBOARDING_STRATEGY_SERVICE_TIER ?? '',
      backgroundLearningSignal:
        process.env.AI_OPERATION_BACKGROUND_LEARNING_SIGNAL_SERVICE_TIER ??
        backgroundServiceTier,
      backgroundLearningWindow:
        process.env.AI_OPERATION_BACKGROUND_LEARNING_WINDOW_SERVICE_TIER ??
        backgroundServiceTier,
      backgroundRealtimeSessionReview:
        process.env.AI_OPERATION_BACKGROUND_REALTIME_SESSION_REVIEW_SERVICE_TIER ??
        backgroundServiceTier,
      backgroundSessionSummary:
        process.env.AI_OPERATION_BACKGROUND_SESSION_SUMMARY_SERVICE_TIER ??
        backgroundServiceTier,
      backgroundProfileRefresh:
        process.env.AI_OPERATION_BACKGROUND_PROFILE_REFRESH_SERVICE_TIER ??
        backgroundServiceTier,
      backgroundTeachingStrategyRefresh:
        process.env.AI_OPERATION_BACKGROUND_TEACHING_STRATEGY_REFRESH_SERVICE_TIER ??
        backgroundServiceTier,
      backgroundProfileStrategyRefresh:
        process.env.AI_OPERATION_BACKGROUND_PROFILE_STRATEGY_REFRESH_SERVICE_TIER ??
        backgroundServiceTier,
      backgroundQualityReview:
        process.env.AI_OPERATION_BACKGROUND_QUALITY_REVIEW_SERVICE_TIER ??
        backgroundServiceTier,
    },
    background: {
      enabled: (process.env.AI_BACKGROUND_ENABLED ?? 'true').toLowerCase() !== 'false',
      batchingEnabled: (process.env.AI_BACKGROUND_BATCHING_ENABLED ?? 'true').toLowerCase() !== 'false',
      responsesModel: backgroundResponsesModel,
      windowResponsesModel: backgroundWindowModel,
      refreshResponsesModel: backgroundRefreshModel,
      serviceTier: backgroundServiceTier,
      promptCacheKeyEnabled:
        (process.env.AI_BACKGROUND_PROMPT_CACHE_KEY_ENABLED ?? 'true').toLowerCase() !== 'false',
      realtimeReviewEnabled:
        (process.env.AI_BACKGROUND_REALTIME_REVIEW_ENABLED ?? 'true').toLowerCase() !== 'false',
      realtimeReviewMaxTranscriptChars: parseInt(
        process.env.AI_BACKGROUND_REALTIME_REVIEW_MAX_TRANSCRIPT_CHARS ?? '4000',
        10,
      ),
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
      runningJobTimeoutMs: parseInt(
        process.env.AI_BACKGROUND_RUNNING_JOB_TIMEOUT_MS ?? '600000',
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
    lessonDecision: {
      enabled: (process.env.AI_LESSON_DECISION_ENABLED ?? 'true').toLowerCase() !== 'false',
      timeoutMs: parseInt(process.env.AI_LESSON_DECISION_TIMEOUT_MS ?? '3500', 10),
    },
    usage: {
      trackingEnabled: (process.env.AI_USAGE_TRACKING_ENABLED ?? 'true').toLowerCase() !== 'false',
      modelPricingJson: process.env.AI_USAGE_MODEL_PRICING_JSON ?? '',
      defaultInputUsdPer1M: parseFloat(process.env.AI_USAGE_DEFAULT_INPUT_USD_PER_1M ?? '0'),
      defaultCachedInputUsdPer1M: parseFloat(
        process.env.AI_USAGE_DEFAULT_CACHED_INPUT_USD_PER_1M ?? '0',
      ),
      defaultOutputUsdPer1M: parseFloat(process.env.AI_USAGE_DEFAULT_OUTPUT_USD_PER_1M ?? '0'),
      defaultImageUsd: parseFloat(process.env.AI_USAGE_DEFAULT_IMAGE_USD ?? '0'),
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
  };
});
