import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { ResolvedAiOperationPolicy } from '../ai-model/ai-model.types';
import { DatabaseService } from '../database/database.service';
import {
  AiUsageContext,
  AiUsageLedgerItem,
  AiUsageRecord,
  AiUsageTotals,
  UserUsageSummary,
} from './usage.types';

interface UsageCounts {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  imageCount: number;
}

interface Pricing {
  inputUsdPer1M: number;
  cachedInputUsdPer1M: number;
  outputUsdPer1M: number;
  imageUsd: number;
  source: string;
  configured: boolean;
}

@Injectable()
export class UsageService {
  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  recordOperation(
    policy: ResolvedAiOperationPolicy,
    context: AiUsageContext | undefined,
    request: Record<string, unknown>,
    response: Record<string, unknown>,
  ): AiUsageLedgerItem | null {
    if (!this.trackingEnabled || !context?.userId) {
      return null;
    }

    const counts =
      policy.responseFormat === 'image'
        ? this.extractImageUsage(request, response)
        : this.extractTokenUsage(response);
    const pricing = this.resolvePricing(policy.model);
    const estimatedCostUsd = this.estimateCost(counts, pricing);
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO ai_usage_ledger (
         id, user_id, conversation_id, lesson_session_id, lesson_type,
         operation_key, operation, assistant_role, provider, model,
         response_format, service_tier, input_tokens, cached_input_tokens,
         output_tokens, total_tokens, image_count, estimated_cost_usd,
         pricing_source, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        context.userId,
        context.conversationId ?? null,
        context.lessonSessionId ?? null,
        context.lessonType ?? null,
        policy.operationKey,
        policy.operation,
        policy.role,
        policy.provider,
        policy.model,
        policy.responseFormat,
        policy.serviceTier ?? null,
        counts.inputTokens,
        counts.cachedInputTokens,
        counts.outputTokens,
        counts.totalTokens,
        counts.imageCount,
        estimatedCostUsd,
        pricing.source,
        now,
      ],
    );

    return {
      id,
      lessonSessionId: context.lessonSessionId ?? null,
      conversationId: context.conversationId ?? null,
      lessonType: (context.lessonType ?? null) as AiUsageLedgerItem['lessonType'],
      operationKey: policy.operationKey,
      operation: policy.operation,
      assistantRole: policy.role,
      provider: policy.provider,
      model: policy.model,
      responseFormat: policy.responseFormat,
      serviceTier: policy.serviceTier,
      estimatedCostUsd,
      inputTokens: counts.inputTokens,
      cachedInputTokens: counts.cachedInputTokens,
      outputTokens: counts.outputTokens,
      totalTokens: counts.totalTokens,
      imageCount: counts.imageCount,
      pricingSource: pricing.source,
      createdAt: now,
    };
  }

  getUserSummary(userId: string, lessonSessionId?: string): UserUsageSummary {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const currentLessonId = lessonSessionId?.trim() || this.getLatestLessonSessionId(userId);

    return {
      currency: 'USD',
      today: this.getTotals(
        `WHERE user_id = ? AND created_at >= ?`,
        [userId, todayStart.toISOString()],
      ),
      currentLesson: currentLessonId
        ? this.getLessonSummary(userId, currentLessonId, 25)
        : null,
      recentLessons: this.getRecentLessonSummaries(userId),
    };
  }

  getLessonUsageSnapshot(
    userId: string,
    lessonSessionId: string,
  ): {
    currency: 'USD';
    lesson: AiUsageTotals;
    today: AiUsageTotals;
  } {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return {
      currency: 'USD',
      lesson: this.getTotals(`WHERE user_id = ? AND lesson_session_id = ?`, [
        userId,
        lessonSessionId,
      ]),
      today: this.getTotals(
        `WHERE user_id = ? AND created_at >= ?`,
        [userId, todayStart.toISOString()],
      ),
    };
  }

  private getRecentLessonSummaries(userId: string) {
    const rows = this.db.all<{
      lesson_session_id: string;
    }>(
      `SELECT lesson_session_id
       FROM ai_usage_ledger
       WHERE user_id = ? AND lesson_session_id IS NOT NULL
       GROUP BY lesson_session_id
       ORDER BY MAX(created_at) DESC
       LIMIT 5`,
      [userId],
    );

    return rows
      .map((row) => this.getLessonSummary(userId, row.lesson_session_id, 8))
      .filter((summary): summary is NonNullable<typeof summary> => Boolean(summary));
  }

  private getLessonSummary(userId: string, lessonSessionId: string, itemLimit: number) {
    const lesson = this.db.get<{
      id: string;
      conversation_id: string | null;
      lesson_type: string | null;
      status: string | null;
      goal_status: string | null;
    }>(
      `SELECT id, conversation_id, lesson_type, status, goal_status
       FROM lesson_sessions
       WHERE id = ? AND user_id = ?`,
      [lessonSessionId, userId],
    );
    const items = this.getLedgerItems(userId, lessonSessionId, itemLimit);
    if (!lesson && items.length === 0) {
      return null;
    }

    return {
      lessonSessionId,
      conversationId: lesson?.conversation_id ?? items[0]?.conversationId ?? null,
      lessonType: (lesson?.lesson_type ?? items[0]?.lessonType ?? null) as any,
      status: lesson?.status ?? null,
      goalStatus: lesson?.goal_status ?? null,
      total: this.getTotals(`WHERE user_id = ? AND lesson_session_id = ?`, [
        userId,
        lessonSessionId,
      ]),
      items,
    };
  }

  private getLedgerItems(
    userId: string,
    lessonSessionId: string,
    limit: number,
  ): AiUsageLedgerItem[] {
    const rows = this.db.all<AiUsageRecord>(
      `SELECT id, user_id, conversation_id, lesson_session_id, lesson_type,
              operation_key, operation, assistant_role, provider, model,
              response_format, service_tier, input_tokens, cached_input_tokens,
              output_tokens, total_tokens, image_count, estimated_cost_usd,
              pricing_source, created_at
       FROM ai_usage_ledger
       WHERE user_id = ? AND lesson_session_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, lessonSessionId, limit],
    );
    return rows.map((row) => ({
      id: row.id,
      lessonSessionId: row.lesson_session_id,
      conversationId: row.conversation_id,
      lessonType: row.lesson_type,
      operationKey: row.operation_key,
      operation: row.operation,
      assistantRole: row.assistant_role,
      provider: row.provider,
      model: row.model,
      responseFormat: row.response_format,
      serviceTier: row.service_tier ?? undefined,
      estimatedCostUsd: row.estimated_cost_usd,
      inputTokens: row.input_tokens,
      cachedInputTokens: row.cached_input_tokens,
      outputTokens: row.output_tokens,
      totalTokens: row.total_tokens,
      imageCount: row.image_count,
      pricingSource: row.pricing_source,
      createdAt: row.created_at,
    }));
  }

  private getLatestLessonSessionId(userId: string): string | undefined {
    const row = this.db.get<{ id: string }>(
      `SELECT id
       FROM lesson_sessions
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId],
    );
    return row?.id;
  }

  private getTotals(whereSql: string, params: unknown[]): AiUsageTotals {
    const row = this.db.get<{
      estimated_cost_usd: number | null;
      input_tokens: number | null;
      cached_input_tokens: number | null;
      output_tokens: number | null;
      total_tokens: number | null;
      image_count: number | null;
      configured_count: number | null;
      total_count: number | null;
    }>(
      `SELECT
         SUM(estimated_cost_usd) AS estimated_cost_usd,
         SUM(input_tokens) AS input_tokens,
         SUM(cached_input_tokens) AS cached_input_tokens,
         SUM(output_tokens) AS output_tokens,
         SUM(total_tokens) AS total_tokens,
         SUM(image_count) AS image_count,
         SUM(CASE WHEN pricing_source != 'not_configured' THEN 1 ELSE 0 END) AS configured_count,
         COUNT(*) AS total_count
       FROM ai_usage_ledger
       ${whereSql}`,
      params,
    );
    return {
      estimatedCostUsd: this.normalizeMoney(row?.estimated_cost_usd),
      inputTokens: this.normalizeCount(row?.input_tokens),
      cachedInputTokens: this.normalizeCount(row?.cached_input_tokens),
      outputTokens: this.normalizeCount(row?.output_tokens),
      totalTokens: this.normalizeCount(row?.total_tokens),
      imageCount: this.normalizeCount(row?.image_count),
      pricingConfigured:
        this.normalizeCount(row?.total_count) > 0 &&
        this.normalizeCount(row?.configured_count) === this.normalizeCount(row?.total_count),
    };
  }

  private extractTokenUsage(response: Record<string, unknown>): UsageCounts {
    const usage = response.usage;
    const record = usage && typeof usage === 'object' ? (usage as Record<string, unknown>) : {};
    const inputTokens = this.pickNumber(record, [
      'input_tokens',
      'prompt_tokens',
      'input_token_count',
    ]);
    const outputTokens = this.pickNumber(record, [
      'output_tokens',
      'completion_tokens',
      'output_token_count',
    ]);
    const totalTokens =
      this.pickNumber(record, ['total_tokens', 'total_token_count']) ||
      inputTokens + outputTokens;
    const inputDetails = this.pickObject(record, [
      'input_tokens_details',
      'prompt_tokens_details',
      'input_details',
    ]);
    const cachedInputTokens = this.pickNumber(inputDetails, [
      'cached_tokens',
      'cached_input_tokens',
    ]);

    return {
      inputTokens,
      cachedInputTokens,
      outputTokens,
      totalTokens,
      imageCount: 0,
    };
  }

  private extractImageUsage(
    request: Record<string, unknown>,
    response: Record<string, unknown>,
  ): UsageCounts {
    const dataCount = Array.isArray(response.data) ? response.data.length : 0;
    const requestedCount = this.pickNumber(request, ['n']);
    return {
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      imageCount: dataCount || requestedCount || 1,
    };
  }

  private estimateCost(counts: UsageCounts, pricing: Pricing): number {
    const billableInputTokens = Math.max(0, counts.inputTokens - counts.cachedInputTokens);
    const tokenCost =
      (billableInputTokens / 1_000_000) * pricing.inputUsdPer1M +
      (counts.cachedInputTokens / 1_000_000) * pricing.cachedInputUsdPer1M +
      (counts.outputTokens / 1_000_000) * pricing.outputUsdPer1M;
    const imageCost = counts.imageCount * pricing.imageUsd;
    return this.normalizeMoney(tokenCost + imageCost);
  }

  private resolvePricing(model: string): Pricing {
    const modelPricing = this.parseModelPricing()[model] ?? {};
    const inputUsdPer1M = this.normalizePrice(
      modelPricing.inputUsdPer1M,
      this.configService.get<number>('ai.usage.defaultInputUsdPer1M') ?? 0,
    );
    const outputUsdPer1M = this.normalizePrice(
      modelPricing.outputUsdPer1M,
      this.configService.get<number>('ai.usage.defaultOutputUsdPer1M') ?? 0,
    );
    const cachedInputUsdPer1M = this.normalizePrice(
      modelPricing.cachedInputUsdPer1M,
      this.configService.get<number>('ai.usage.defaultCachedInputUsdPer1M') ?? inputUsdPer1M,
    );
    const imageUsd = this.normalizePrice(
      modelPricing.imageUsd,
      this.configService.get<number>('ai.usage.defaultImageUsd') ?? 0,
    );
    const configured =
      inputUsdPer1M > 0 || outputUsdPer1M > 0 || cachedInputUsdPer1M > 0 || imageUsd > 0;

    return {
      inputUsdPer1M,
      outputUsdPer1M,
      cachedInputUsdPer1M,
      imageUsd,
      source: configured
        ? modelPricing.source || (Object.keys(modelPricing).length > 0 ? 'model_pricing_json' : 'env_default')
        : 'not_configured',
      configured,
    };
  }

  private parseModelPricing(): Record<
    string,
    Partial<Pricing> & { source?: string }
  > {
    const raw = this.configService.get<string>('ai.usage.modelPricingJson');
    if (!raw?.trim()) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, Partial<Pricing> & { source?: string }>)
        : {};
    } catch {
      return {};
    }
  }

  private pickNumber(source: Record<string, unknown>, keys: string[]): number {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return Math.floor(value);
      }
    }
    return 0;
  }

  private pickObject(
    source: Record<string, unknown>,
    keys: string[],
  ): Record<string, unknown> {
    for (const key of keys) {
      const value = source[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
    }
    return {};
  }

  private normalizePrice(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private normalizeCount(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? Math.floor(value)
      : 0;
  }

  private normalizeMoney(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? Number(value.toFixed(8))
      : 0;
  }

  private get trackingEnabled(): boolean {
    return this.configService.get<boolean>('ai.usage.trackingEnabled') ?? true;
  }
}
