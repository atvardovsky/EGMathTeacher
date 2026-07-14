import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  AiOperationFailureReason,
  ResolvedAiOperationPolicy,
} from '../ai-model/ai-model.types';
import { DatabaseService } from '../database/database.service';
import {
  AiUsageContext,
  AiUsageLedgerItem,
  AiUsageRecord,
  AiUsageTotals,
  BackgroundJobUsageItem,
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
    const pricing = this.resolvePricing(policy.model, policy.serviceTier);
    const estimatedCostUsd = this.estimateCost(counts, pricing);
    return this.insertLedgerItem(
      policy,
      context,
      counts,
      estimatedCostUsd,
      pricing.source,
    );
  }

  recordOperationFailure(
    policy: ResolvedAiOperationPolicy,
    context: AiUsageContext | undefined,
    _request: Record<string, unknown>,
    failureReason: AiOperationFailureReason,
  ): AiUsageLedgerItem | null {
    if (!this.trackingEnabled || !context?.userId) {
      return null;
    }

    return this.insertLedgerItem(
      policy,
      context,
      {
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        imageCount: 0,
      },
      0,
      `usage_unavailable:${failureReason}`,
    );
  }

  private insertLedgerItem(
    policy: ResolvedAiOperationPolicy,
    context: AiUsageContext,
    counts: UsageCounts,
    estimatedCostUsd: number,
    pricingSource: string,
  ): AiUsageLedgerItem {
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO ai_usage_ledger (
         id, correlation_id, user_id, conversation_id, lesson_session_id, lesson_type,
         operation_key, operation, assistant_role, provider, model,
         response_format, service_tier, input_tokens, cached_input_tokens,
         output_tokens, total_tokens, image_count, estimated_cost_usd,
         pricing_source, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        context.correlationId ?? null,
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
        pricingSource,
        now,
      ],
    );

    return {
      id,
      correlationId: context.correlationId ?? null,
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
      pricingSource,
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
      backgroundJobs: this.getBackgroundJobItems(userId, currentLessonId),
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
      decisions: this.getDecisionItems(userId, lessonSessionId, itemLimit),
      verifiedOutcomes: this.getVerifiedOutcomeCount(userId, lessonSessionId),
      costPerVerifiedOutcomeUsd: this.getCostPerVerifiedOutcome(userId, lessonSessionId),
    };
  }

  private getLedgerItems(
    userId: string,
    lessonSessionId: string,
    limit: number,
  ): AiUsageLedgerItem[] {
    const rows = this.db.all<AiUsageRecord>(
      `SELECT id, correlation_id, user_id, conversation_id, lesson_session_id, lesson_type,
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
      correlationId: row.correlation_id,
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

  private getDecisionItems(
    userId: string,
    lessonSessionId: string,
    limit: number,
  ) {
    const rows = this.db.all<{
      id: string;
      usage_correlation_id: string | null;
      tool_name: string;
      accepted: number;
      rejection_reason: string | null;
      evidence_level: string;
      verifier_result: string | null;
      latency_ms: number;
      retry_count: number;
      fallback_used: number | null;
      lesson_outcome: string | null;
      created_at: string;
    }>(
      `SELECT id, usage_correlation_id, tool_name, accepted, rejection_reason,
              evidence_level, verifier_result, latency_ms, retry_count,
              fallback_used, lesson_outcome, created_at
       FROM lesson_decisions
       WHERE user_id = ?
         AND lesson_session_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, lessonSessionId, limit],
    );
    return rows.map((row) => ({
      id: row.id,
      correlationId: row.usage_correlation_id,
      toolName: row.tool_name,
      accepted: row.accepted === 1,
      rejectionReason: row.rejection_reason ?? undefined,
      evidenceLevel: row.evidence_level,
      verifierResult: row.verifier_result ?? undefined,
      latencyMs: row.latency_ms,
      fallbackUsed: (row.fallback_used ?? row.retry_count) > 0,
      lessonOutcome: row.lesson_outcome ?? undefined,
      createdAt: row.created_at,
    }));
  }

  private getVerifiedOutcomeCount(userId: string, lessonSessionId: string): number {
    const row = this.db.get<{ count: number | null }>(
      `SELECT COUNT(*) AS count
       FROM mastery_evidence
       WHERE user_id = ?
         AND lesson_session_id = ?`,
      [userId, lessonSessionId],
    );
    return this.normalizeCount(row?.count);
  }

  private getCostPerVerifiedOutcome(
    userId: string,
    lessonSessionId: string,
  ): number | null {
    const verifiedOutcomes = this.getVerifiedOutcomeCount(userId, lessonSessionId);
    if (verifiedOutcomes <= 0) {
      return null;
    }
    const totals = this.getTotals(`WHERE user_id = ? AND lesson_session_id = ?`, [
      userId,
      lessonSessionId,
    ]);
    return this.normalizeMoney(totals.estimatedCostUsd / verifiedOutcomes);
  }

  private getBackgroundJobItems(
    userId: string,
    lessonSessionId?: string,
  ): BackgroundJobUsageItem[] {
    const rows = this.db.all<{
      id: string;
      type: string;
      status: string;
      conversation_id: string | null;
      attempts: number;
      payload_json: string;
      result_json: string | null;
      error_message: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, type, status, conversation_id, attempts, payload_json,
              result_json, error_message, created_at, updated_at
       FROM background_ai_jobs
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT 20`,
      [userId],
    );

    return rows
      .map((row) => {
        const payload = this.parseJsonObject(row.payload_json);
        const resolvedLessonSessionId = this.pickString(payload, [
          'lessonSessionId',
          'lesson_session_id',
        ]);
        const item: BackgroundJobUsageItem = {
          id: row.id,
          type: row.type,
          status: row.status,
          conversationId: row.conversation_id,
          lessonSessionId: resolvedLessonSessionId ?? null,
          attempts: this.normalizeCount(row.attempts),
          resultPreview: this.summarizeBackgroundResult(row.result_json),
          errorMessage: row.error_message ? row.error_message.slice(0, 280) : undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
        return {
          item,
          priority:
            lessonSessionId && resolvedLessonSessionId === lessonSessionId
              ? 0
              : 1,
        };
      })
      .sort((left, right) => left.priority - right.priority)
      .slice(0, 8)
      .map(({ item }) => item);
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
         SUM(
           CASE
             WHEN pricing_source != 'not_configured'
              AND pricing_source NOT LIKE 'usage_unavailable:%'
             THEN 1
             ELSE 0
           END
         ) AS configured_count,
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
    const imageCount = dataCount || requestedCount || 1;
    const tokenUsage = this.extractTokenUsage(response);
    const estimatedOutputTokens =
      tokenUsage.outputTokens > 0 ? 0 : this.estimateGptImageOutputTokens(request) * imageCount;
    const outputTokens = tokenUsage.outputTokens + estimatedOutputTokens;
    const totalTokens = Math.max(tokenUsage.totalTokens, tokenUsage.inputTokens + outputTokens);
    return {
      ...tokenUsage,
      outputTokens,
      totalTokens,
      imageCount,
    };
  }

  private estimateGptImageOutputTokens(request: Record<string, unknown>): number {
    const quality = this.pickString(request, ['quality'])?.toLowerCase() ?? 'low';
    const size = this.pickString(request, ['size'])?.toLowerCase() ?? '1024x1024';
    const normalizedSize = size.replace(/\s+/g, '');
    const estimates: Record<string, Record<string, number>> = {
      low: {
        '1024x1024': 196,
        '1024x1536': 167,
        '1536x1024': 167,
      },
      medium: {
        '1024x1024': 1767,
        '1024x1536': 1367,
        '1536x1024': 1367,
      },
      high: {
        '1024x1024': 7033,
        '1024x1536': 5500,
        '1536x1024': 5500,
      },
    };
    return (
      estimates[quality]?.[normalizedSize] ??
      estimates[quality]?.['1024x1024'] ??
      estimates.low['1024x1024']
    );
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

  private resolvePricing(model: string, serviceTier?: string): Pricing {
    const pricingTable = this.parseModelPricing();
    const serviceTierKey = serviceTier?.trim().toLowerCase();
    const tierPricingKey = serviceTierKey ? `${model}:${serviceTierKey}` : undefined;
    const modelPricing =
      (tierPricingKey ? pricingTable[tierPricingKey] : undefined) ??
      pricingTable[model] ??
      {};
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

  private summarizeBackgroundResult(raw: string | null): string | undefined {
    const parsed = this.parseJsonObject(raw);
    if (!parsed) {
      return undefined;
    }

    const sessionSummary = this.pickObject(parsed, [
      'sessionSummary',
      'session_summary',
    ]);
    const qualityReview = this.pickObject(parsed, ['qualityReview', 'quality_review']);
    const candidates = [
      this.pickString(parsed, ['skipped']),
      this.pickString(parsed, ['summary', 'aiSummary', 'ai_summary']),
      this.pickString(sessionSummary, ['summary', 'text']),
      this.pickString(qualityReview, ['summary', 'risk']),
    ].filter((value): value is string => Boolean(value));

    if (candidates.length > 0) {
      return candidates[0].slice(0, 280);
    }

    const compact = this.compactBackgroundResult(parsed);
    const serialized = JSON.stringify(compact);
    return serialized && serialized !== '{}' ? serialized.slice(0, 280) : undefined;
  }

  private compactBackgroundResult(source: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key of [
      'profileUpdateRecommended',
      'qualityReview',
      'signals',
      'teachingStrategyHints',
      'skillProgressSignals',
      'knowledgeDelta',
      'learningPreferencesPatch',
      'explanationStrategyPatch',
    ]) {
      const value = source[key];
      if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
        result[key] = value;
      } else if (Array.isArray(value)) {
        result[key] = value.slice(0, 2);
      } else if (value && typeof value === 'object') {
        result[key] = value;
      }
    }
    return result;
  }

  private parseJsonObject(raw: string | null | undefined): Record<string, unknown> | undefined {
    if (!raw?.trim()) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  }

  private pickString(
    source: Record<string, unknown> | undefined,
    keys: string[],
  ): string | undefined {
    if (!source) {
      return undefined;
    }
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return undefined;
  }

  private pickObject(
    source: Record<string, unknown> | undefined,
    keys: string[],
  ): Record<string, unknown> {
    if (!source) {
      return {};
    }
    for (const key of keys) {
      const value = source[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
    }
    return {};
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
