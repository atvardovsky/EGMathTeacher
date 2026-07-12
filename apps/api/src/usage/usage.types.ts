import type {
  AiAssistantRole,
  AiOperationKey,
  AiResponseFormat,
} from '../ai-model/ai-model.types';
import type { LessonType } from '../tutor/tutor.types';

export type { AiUsageContext } from '../ai-model/ai-model.types';

export interface AiUsageTotals {
  estimatedCostUsd: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  imageCount: number;
  pricingConfigured: boolean;
}

export interface AiUsageLedgerItem {
  id: string;
  lessonSessionId: string | null;
  conversationId: string | null;
  lessonType: LessonType | null;
  operationKey: AiOperationKey;
  operation: string;
  assistantRole: AiAssistantRole;
  provider: string;
  model: string;
  responseFormat: AiResponseFormat;
  serviceTier?: string;
  estimatedCostUsd: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  imageCount: number;
  pricingSource: string;
  createdAt: string;
}

export interface LessonUsageSummary {
  lessonSessionId: string;
  conversationId: string | null;
  lessonType: LessonType | null;
  status: string | null;
  goalStatus: string | null;
  total: AiUsageTotals;
  items: AiUsageLedgerItem[];
}

export interface UserUsageSummary {
  currency: 'USD';
  today: AiUsageTotals;
  currentLesson: LessonUsageSummary | null;
  recentLessons: LessonUsageSummary[];
}

export interface AiUsageRecord {
  id: string;
  user_id: string | null;
  conversation_id: string | null;
  lesson_session_id: string | null;
  lesson_type: LessonType | null;
  operation_key: AiOperationKey;
  operation: string;
  assistant_role: AiAssistantRole;
  provider: string;
  model: string;
  response_format: AiResponseFormat;
  service_tier: string | null;
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  image_count: number;
  estimated_cost_usd: number;
  pricing_source: string;
  created_at: string;
}
