import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiAssistantRole,
  AiOperationKey,
  AiResponseFormat,
  ResolvedAiOperationPolicy,
} from './ai-model.types';

interface AiOperationDefinition {
  operation: string;
  role: AiAssistantRole;
  responseFormat: AiResponseFormat;
  modelPaths: string[];
  fallbackModel: string;
  serviceTierPaths?: string[];
  promptCacheKeyEnabled?: boolean;
}

const OPERATION_DEFINITIONS: Record<AiOperationKey, AiOperationDefinition> = {
  tutorAnswer: {
    operation: 'tutor.answer',
    role: 'tutor',
    responseFormat: 'json',
    modelPaths: ['ai.operationModels.tutorAnswer', 'ai.openai.responsesModel'],
    fallbackModel: 'gpt-5.5',
    serviceTierPaths: ['ai.operationServiceTiers.tutorAnswer'],
  },
  tutorAnswerWithRag: {
    operation: 'tutor.answer_with_rag',
    role: 'tutor',
    responseFormat: 'json',
    modelPaths: [
      'ai.operationModels.tutorAnswerWithRag',
      'ai.operationModels.tutorAnswer',
      'ai.openai.responsesModel',
    ],
    fallbackModel: 'gpt-5.5',
    serviceTierPaths: ['ai.operationServiceTiers.tutorAnswerWithRag'],
  },
  tutorImage: {
    operation: 'tutor.generate_image',
    role: 'image_explainer',
    responseFormat: 'image',
    modelPaths: ['ai.operationModels.tutorImage', 'ai.openai.imageModel'],
    fallbackModel: 'gpt-image-2',
  },
  onboardingKnowledgeDiagnosis: {
    operation: 'onboarding.assess_math_level',
    role: 'onboarding_diagnostician',
    responseFormat: 'json',
    modelPaths: ['ai.operationModels.onboardingKnowledgeDiagnosis', 'ai.openai.responsesModel'],
    fallbackModel: 'gpt-5.5',
    serviceTierPaths: ['ai.operationServiceTiers.onboardingKnowledgeDiagnosis'],
  },
  onboardingPsychopedagogicalProfile: {
    operation: 'onboarding.build_psychopedagogical_profile',
    role: 'psychopedagogical_profiler',
    responseFormat: 'json',
    modelPaths: [
      'ai.operationModels.onboardingPsychopedagogicalProfile',
      'ai.openai.responsesModel',
    ],
    fallbackModel: 'gpt-5.5',
    serviceTierPaths: ['ai.operationServiceTiers.onboardingPsychopedagogicalProfile'],
  },
  onboardingStrategyPlan: {
    operation: 'onboarding.plan_explanation_strategy',
    role: 'strategy_planner',
    responseFormat: 'json',
    modelPaths: ['ai.operationModels.onboardingStrategyPlan', 'ai.openai.responsesModel'],
    fallbackModel: 'gpt-5.5',
    serviceTierPaths: ['ai.operationServiceTiers.onboardingStrategyPlan'],
  },
  backgroundLearningSignal: {
    operation: 'background.extract_learning_signal',
    role: 'background_learning_analyst',
    responseFormat: 'json',
    modelPaths: [
      'ai.operationModels.backgroundLearningSignal',
      'ai.background.responsesModel',
      'ai.openai.responsesModel',
    ],
    fallbackModel: 'gpt-5.5',
    serviceTierPaths: [
      'ai.operationServiceTiers.backgroundLearningSignal',
      'ai.background.serviceTier',
    ],
    promptCacheKeyEnabled: true,
  },
  backgroundLearningWindow: {
    operation: 'background.analyze_learning_window',
    role: 'background_learning_analyst',
    responseFormat: 'json',
    modelPaths: [
      'ai.operationModels.backgroundLearningWindow',
      'ai.background.windowResponsesModel',
      'ai.background.responsesModel',
      'ai.openai.responsesModel',
    ],
    fallbackModel: 'gpt-5.5',
    serviceTierPaths: [
      'ai.operationServiceTiers.backgroundLearningWindow',
      'ai.background.serviceTier',
    ],
    promptCacheKeyEnabled: true,
  },
  backgroundSessionSummary: {
    operation: 'background.create_session_summary',
    role: 'background_learning_analyst',
    responseFormat: 'json',
    modelPaths: [
      'ai.operationModels.backgroundSessionSummary',
      'ai.background.responsesModel',
      'ai.openai.responsesModel',
    ],
    fallbackModel: 'gpt-5.5',
    serviceTierPaths: [
      'ai.operationServiceTiers.backgroundSessionSummary',
      'ai.background.serviceTier',
    ],
    promptCacheKeyEnabled: true,
  },
  backgroundProfileRefresh: {
    operation: 'background.refresh_student_profile',
    role: 'background_profile_refresher',
    responseFormat: 'json',
    modelPaths: [
      'ai.operationModels.backgroundProfileRefresh',
      'ai.background.refreshResponsesModel',
      'ai.background.responsesModel',
      'ai.openai.responsesModel',
    ],
    fallbackModel: 'gpt-5.5',
    serviceTierPaths: [
      'ai.operationServiceTiers.backgroundProfileRefresh',
      'ai.background.serviceTier',
    ],
    promptCacheKeyEnabled: true,
  },
  backgroundTeachingStrategyRefresh: {
    operation: 'background.refresh_teaching_strategy',
    role: 'background_strategy_refresher',
    responseFormat: 'json',
    modelPaths: [
      'ai.operationModels.backgroundTeachingStrategyRefresh',
      'ai.background.refreshResponsesModel',
      'ai.background.responsesModel',
      'ai.openai.responsesModel',
    ],
    fallbackModel: 'gpt-5.5',
    serviceTierPaths: [
      'ai.operationServiceTiers.backgroundTeachingStrategyRefresh',
      'ai.background.serviceTier',
    ],
    promptCacheKeyEnabled: true,
  },
  backgroundProfileStrategyRefresh: {
    operation: 'background.refresh_profile_strategy',
    role: 'background_profile_refresher',
    responseFormat: 'json',
    modelPaths: [
      'ai.operationModels.backgroundProfileStrategyRefresh',
      'ai.background.refreshResponsesModel',
      'ai.background.responsesModel',
      'ai.openai.responsesModel',
    ],
    fallbackModel: 'gpt-5.5',
    serviceTierPaths: [
      'ai.operationServiceTiers.backgroundProfileStrategyRefresh',
      'ai.background.serviceTier',
    ],
    promptCacheKeyEnabled: true,
  },
  backgroundQualityReview: {
    operation: 'background.review_quality',
    role: 'quality_reviewer',
    responseFormat: 'json',
    modelPaths: [
      'ai.operationModels.backgroundQualityReview',
      'ai.background.responsesModel',
      'ai.openai.responsesModel',
    ],
    fallbackModel: 'gpt-5.5',
    serviceTierPaths: [
      'ai.operationServiceTiers.backgroundQualityReview',
      'ai.background.serviceTier',
    ],
    promptCacheKeyEnabled: true,
  },
};

@Injectable()
export class AiOperationPolicyService {
  constructor(private readonly configService: ConfigService) {}

  resolve(operationKey: AiOperationKey): ResolvedAiOperationPolicy {
    const definition = OPERATION_DEFINITIONS[operationKey];
    return {
      operationKey,
      operation: definition.operation,
      role: definition.role,
      provider: this.resolveProvider(),
      model: this.resolveFirstString(definition.modelPaths) ?? definition.fallbackModel,
      responseFormat: definition.responseFormat,
      serviceTier: this.normalizeServiceTier(
        this.resolveFirstString(definition.serviceTierPaths ?? []),
      ),
      promptCacheKeyEnabled: this.resolvePromptCacheKeyEnabled(definition),
    };
  }

  private resolveProvider(): string {
    return (this.configService.get<string>('ai.modelProvider') || 'openai').toLowerCase();
  }

  private resolveFirstString(paths: string[]): string | undefined {
    for (const path of paths) {
      const value = this.configService.get<string>(path);
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return undefined;
  }

  private normalizeServiceTier(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }
    const normalized = value.trim().toLowerCase();
    return normalized && normalized !== 'standard' && normalized !== 'none'
      ? normalized
      : undefined;
  }

  private resolvePromptCacheKeyEnabled(definition: AiOperationDefinition): boolean {
    if (!definition.promptCacheKeyEnabled) {
      return false;
    }
    return this.configService.get<boolean>('ai.background.promptCacheKeyEnabled') ?? true;
  }
}
