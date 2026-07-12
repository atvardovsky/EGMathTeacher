export type AiAssistantRole =
  | 'tutor'
  | 'lesson_decision_agent'
  | 'image_explainer'
  | 'onboarding_diagnostician'
  | 'psychopedagogical_profiler'
  | 'strategy_planner'
  | 'background_learning_analyst'
  | 'background_profile_refresher'
  | 'background_strategy_refresher'
  | 'quality_reviewer';

export type AiOperationKey =
  | 'lessonDecision'
  | 'tutorAnswer'
  | 'tutorAnswerWithRag'
  | 'tutorImage'
  | 'onboardingKnowledgeDiagnosis'
  | 'onboardingPsychopedagogicalProfile'
  | 'onboardingStrategyPlan'
  | 'backgroundLearningSignal'
  | 'backgroundLearningWindow'
  | 'backgroundSessionSummary'
  | 'backgroundProfileRefresh'
  | 'backgroundTeachingStrategyRefresh'
  | 'backgroundProfileStrategyRefresh'
  | 'backgroundQualityReview';

export type AiResponseFormat = 'json' | 'text' | 'image';

export interface ResolvedAiOperationPolicy {
  operationKey: AiOperationKey;
  operation: string;
  role: AiAssistantRole;
  provider: string;
  model: string;
  responseFormat: AiResponseFormat;
  serviceTier?: string;
  promptCacheKeyEnabled: boolean;
}

export interface AiModelProvider {
  readonly id: string;
  createResponse(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  generateImage(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  createVectorStore(name: string): Promise<Record<string, unknown>>;
  uploadFile(file: Express.Multer.File): Promise<Record<string, unknown>>;
  attachFileToVectorStore(
    vectorStoreId: string,
    fileId: string,
  ): Promise<Record<string, unknown>>;
  removeFileFromVectorStore(
    vectorStoreId: string,
    fileId: string,
  ): Promise<Record<string, unknown>>;
  listVectorStoreFiles(vectorStoreId: string): Promise<Record<string, unknown>>;
}

export interface AiUsageContext {
  userId?: string;
  conversationId?: string;
  lessonSessionId?: string;
  lessonType?: string;
  correlationId?: string;
}

export interface AiOperationPayload extends Record<string, unknown> {
  usageContext?: AiUsageContext;
}
