import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { AiModelService } from '../ai-model/ai-model.service';
import { DatabaseService } from '../database/database.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { StudentProfileService } from '../student-profile/student-profile.service';
import {
  BackgroundAiJobRecord,
  BackgroundAiJobStatus,
  BackgroundAiJobType,
  BackgroundAiStatus,
  TutorTurnBackgroundInput,
} from './background-ai.types';

@Injectable()
export class BackgroundAiService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackgroundAiService.name);
  private readonly sensitiveProfileKeyPattern =
    /diagnos|clinical|medical|health|illness|family|parent|mother|father|address|phone|email|relig|politic|trauma|abuse|диагноз|клиник|медицин|здоров|болез|семь|родител|мам|пап|адрес|телефон|почт|религи|полит|травм|насили/i;

  private readonly sensitiveProfileValuePattern =
    /adhd|autism|bipolar|depression|self-harm|suicide|medical record|my mother|my father|my parents|family problem|сдвг|аутизм|биполяр|депресс|суицид|самоповреж|медицин|моя мама|мой папа|родители|проблемы в семье|насили/i;

  private drainTimer: NodeJS.Timeout | undefined;
  private draining = false;

  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
    private readonly knowledgeService: KnowledgeService,
    private readonly aiModel: AiModelService,
    private readonly studentProfileService: StudentProfileService,
  ) {}

  onModuleInit(): void {
    if (!this.isEnabled()) {
      return;
    }
    this.drainTimer = setInterval(() => {
      this.drainPending().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Background AI drain failed: ${message}`);
      });
    }, this.getDrainIntervalMs());
  }

  onModuleDestroy(): void {
    if (this.drainTimer) {
      clearInterval(this.drainTimer);
      this.drainTimer = undefined;
    }
  }

  getStatus(): BackgroundAiStatus {
    const rows = this.db.all<{ status: BackgroundAiJobStatus; count: number }>(
      `SELECT status, COUNT(*) AS count
       FROM background_ai_jobs
       GROUP BY status`,
    );
    const status: BackgroundAiStatus = {
      pending: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
    };
    for (const row of rows) {
      status[row.status] = Number(row.count);
    }
    return status;
  }

  enqueueTutorTurnWork(input: TutorTurnBackgroundInput): void {
    if (!this.isEnabled()) {
      return;
    }

    const prompt = this.sanitizeTeachingString(input.prompt, 1_200);
    const answer = this.sanitizeTeachingString(input.answer.answer, 2_000);
    const now = new Date().toISOString();
    const basePayload = {
      userName: this.cleanString(input.userName, 80),
      source: input.source,
      prompt,
      answer,
      answerShape: input.answer,
      capturedAt: now,
    };

    this.enqueueJob({
      type: 'learning_signal_extraction',
      userId: input.userId,
      conversationId: input.conversationId,
      payload: basePayload,
    });

    const conversationTurnCount = this.countConversationTurns(input.userId, input.conversationId);
    if (conversationTurnCount > 0 && conversationTurnCount % this.getSessionSummaryTurnInterval() === 0) {
      this.enqueueJob({
        type: 'session_summary',
        userId: input.userId,
        conversationId: input.conversationId,
        payload: {
          reason: `conversation_${conversationTurnCount}_turns`,
          capturedAt: now,
        },
        dedupePending: true,
      });
    }

    const userTurnCount = this.countUserTurns(input.userId);
    if (userTurnCount > 0 && userTurnCount % this.getProfileRefreshTurnInterval() === 0) {
      this.enqueueJob({
        type: 'student_profile_refresh',
        userId: input.userId,
        conversationId: input.conversationId,
        payload: {
          reason: `user_${userTurnCount}_turns`,
          capturedAt: now,
        },
        dedupePending: true,
      });
      this.enqueueJob({
        type: 'teaching_strategy_refresh',
        userId: input.userId,
        conversationId: input.conversationId,
        payload: {
          reason: `user_${userTurnCount}_turns`,
          capturedAt: now,
        },
        dedupePending: true,
      });
    }

    if (this.shouldReviewQuality(input)) {
      this.enqueueJob({
        type: 'tutor_quality_review',
        userId: input.userId,
        conversationId: input.conversationId,
        payload: basePayload,
      });
    }
  }

  async drainPending(limit = this.getDrainBatchSize()): Promise<number> {
    if (!this.isEnabled() || this.draining) {
      return 0;
    }

    this.draining = true;
    let processed = 0;
    try {
      while (processed < limit) {
        const job = this.nextPendingJob();
        if (!job) {
          break;
        }
        await this.runJob(job);
        processed += 1;
      }
    } finally {
      this.draining = false;
    }
    return processed;
  }

  private async runJob(job: BackgroundAiJobRecord): Promise<void> {
    this.markJobRunning(job);
    try {
      const result = await this.executeJob(job);
      this.markJobSucceeded(job.id, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.markJobFailed(job, message);
      this.logger.warn(`Background AI job ${job.type} failed: ${message}`);
    }
  }

  private async executeJob(job: BackgroundAiJobRecord): Promise<Record<string, unknown>> {
    switch (job.type) {
      case 'learning_signal_extraction':
        return this.extractLearningSignals(job);
      case 'session_summary':
        return this.createSessionSummary(job);
      case 'student_profile_refresh':
        return this.refreshStudentProfile(job);
      case 'teaching_strategy_refresh':
        return this.refreshTeachingStrategy(job);
      case 'tutor_quality_review':
        return this.reviewTutorQuality(job);
      default:
        return { skipped: 'unknown_job_type' };
    }
  }

  private async extractLearningSignals(job: BackgroundAiJobRecord): Promise<Record<string, unknown>> {
    const payload = this.parsePayload(job);
    const parsed = await this.createBackgroundJsonResponse({
      specialist: 'learning-signal-extractor',
      instructions: this.getLearningSignalInstructions(),
      inputText: [
        'Один учебный ход ученика и ответ репетитора:',
        JSON.stringify(payload, null, 2),
      ].join('\n'),
      useRag: false,
    });
    this.persistLearningSignal(job, 'turn_signal', parsed);
    return parsed;
  }

  private async createSessionSummary(job: BackgroundAiJobRecord): Promise<Record<string, unknown>> {
    const turns = this.getRecentTutorTurns(job.user_id, job.conversation_id, 12);
    if (turns.length === 0) {
      return { skipped: 'no_turns' };
    }

    const parsed = await this.createBackgroundJsonResponse({
      specialist: 'session-summarizer',
      instructions: this.getSessionSummaryInstructions(),
      inputText: [
        'Последние ходы учебной сессии:',
        JSON.stringify(turns, null, 2),
      ].join('\n'),
      useRag: false,
    });
    this.persistLearningSignal(job, 'session_summary', parsed);
    return parsed;
  }

  private async refreshStudentProfile(job: BackgroundAiJobRecord): Promise<Record<string, unknown>> {
    const profile = this.studentProfileService.getProfile(job.user_id);
    if (!profile) {
      return { skipped: 'no_student_profile' };
    }

    const signals = this.getRecentLearningSignals(job.user_id, 30);
    if (signals.length === 0) {
      return { skipped: 'no_learning_signals' };
    }

    const parsed = await this.createBackgroundJsonResponse({
      specialist: 'student-profile-background-refresher',
      instructions: this.getProfileRefreshInstructions(this.hasVectorStores()),
      inputText: [
        'Текущий профиль ученика:',
        JSON.stringify({
          knowledgeState: profile.knowledgeState,
          learningPreferences: profile.learningPreferences,
          psychologicalProfile: profile.psychologicalProfile,
          aiSummary: profile.aiSummary,
        }, null, 2),
        'Новые учебные сигналы:',
        JSON.stringify(signals, null, 2),
      ].join('\n'),
      useRag: true,
    });

    const knowledgeStatePatch = this.pickObject(parsed, ['knowledgeStatePatch', 'knowledge_state_patch']);
    const learningPreferencesPatch = this.pickObject(parsed, [
      'learningPreferencesPatch',
      'learning_preferences_patch',
    ]);
    const psychologicalProfilePatch = this.pickObject(parsed, [
      'psychologicalProfilePatch',
      'psychological_profile_patch',
    ]);
    const aiSummary = this.pickString(parsed, ['aiSummary', 'ai_summary', 'summary']);
    const now = new Date().toISOString();

    const nextKnowledgeState = this.deepMerge(profile.knowledgeState, knowledgeStatePatch);
    const nextLearningPreferences = this.deepMerge(
      profile.learningPreferences,
      learningPreferencesPatch,
    );
    const nextPsychologicalProfile = this.deepMerge(
      profile.psychologicalProfile,
      psychologicalProfilePatch,
    );

    this.db.run(
      `UPDATE student_profiles
       SET knowledge_state_json = ?,
           learning_preferences_json = ?,
           psychological_profile_json = ?,
           ai_summary = ?,
           updated_at = ?
       WHERE user_id = ?`,
      [
        JSON.stringify(this.sanitizeTeachingObject(nextKnowledgeState)),
        JSON.stringify(this.sanitizeTeachingObject(nextLearningPreferences)),
        JSON.stringify(this.sanitizeTeachingObject(nextPsychologicalProfile)),
        this.sanitizeTeachingString(aiSummary, 1_500) ?? profile.aiSummary,
        now,
        job.user_id,
      ],
    );

    const result = {
      updated: true,
      knowledgeStatePatch,
      learningPreferencesPatch,
      psychologicalProfilePatch,
      aiSummaryUpdated: Boolean(aiSummary),
    };
    this.persistLearningSignal(job, 'profile_refresh', result);
    return result;
  }

  private async refreshTeachingStrategy(job: BackgroundAiJobRecord): Promise<Record<string, unknown>> {
    const profile = this.studentProfileService.getProfile(job.user_id);
    if (!profile) {
      return { skipped: 'no_student_profile' };
    }

    const signals = this.getRecentLearningSignals(job.user_id, 30);
    if (signals.length === 0) {
      return { skipped: 'no_learning_signals' };
    }

    const parsed = await this.createBackgroundJsonResponse({
      specialist: 'teaching-strategy-background-planner',
      instructions: this.getStrategyRefreshInstructions(this.hasVectorStores()),
      inputText: [
        'Текущий профиль и стратегия:',
        JSON.stringify({
          knowledgeState: profile.knowledgeState,
          learningPreferences: profile.learningPreferences,
          psychologicalProfile: profile.psychologicalProfile,
          explanationStrategy: profile.explanationStrategy,
          aiSummary: profile.aiSummary,
        }, null, 2),
        'Новые учебные сигналы:',
        JSON.stringify(signals, null, 2),
      ].join('\n'),
      useRag: true,
    });

    const explanationStrategyPatch = this.pickObject(parsed, [
      'explanationStrategyPatch',
      'explanation_strategy_patch',
    ]);
    const aiSummary = this.pickString(parsed, ['aiSummary', 'ai_summary', 'summary']);
    const nextStrategy = this.deepMerge(profile.explanationStrategy, explanationStrategyPatch);
    const now = new Date().toISOString();

    this.db.run(
      `UPDATE student_profiles
       SET explanation_strategy_json = ?,
           ai_summary = ?,
           updated_at = ?
       WHERE user_id = ?`,
      [
        JSON.stringify(this.sanitizeTeachingObject(nextStrategy)),
        this.sanitizeTeachingString(aiSummary, 1_500) ?? profile.aiSummary,
        now,
        job.user_id,
      ],
    );

    const result = {
      updated: true,
      explanationStrategyPatch,
      aiSummaryUpdated: Boolean(aiSummary),
    };
    this.persistLearningSignal(job, 'strategy_refresh', result);
    return result;
  }

  private async reviewTutorQuality(job: BackgroundAiJobRecord): Promise<Record<string, unknown>> {
    const payload = this.parsePayload(job);
    const parsed = await this.createBackgroundJsonResponse({
      specialist: 'tutor-quality-background-reviewer',
      instructions: this.getQualityReviewInstructions(),
      inputText: [
        'Проверь учебное качество одного ответа. Не переписывай ответ ученику, только оцени необходимость доработки:',
        JSON.stringify(payload, null, 2),
      ].join('\n'),
      useRag: false,
    });
    this.persistLearningSignal(job, 'quality_review', parsed);
    return parsed;
  }

  private async createBackgroundJsonResponse(options: {
    specialist: string;
    instructions: string;
    inputText: string;
    useRag: boolean;
  }): Promise<Record<string, unknown>> {
    const vectorStoreIds = options.useRag ? this.knowledgeService.getActiveVectorStoreIds() : [];
    const useFileSearch = options.useRag && vectorStoreIds.length > 0;
    const request: Record<string, unknown> = {
      model: this.getBackgroundModel(),
      instructions: options.instructions,
      metadata: {
        background_ai: true,
        background_specialist: options.specialist,
      },
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: options.inputText,
            },
          ],
        },
      ],
      tools: useFileSearch
        ? [
            {
              type: 'file_search',
              vector_store_ids: vectorStoreIds,
              max_num_results: 6,
            },
          ]
        : undefined,
      include: useFileSearch ? ['file_search_call.results'] : undefined,
    };

    const serviceTier = this.getServiceTier();
    if (serviceTier) {
      request.service_tier = serviceTier;
    }

    const response = await this.aiModel.createResponse(request);
    const text = this.extractOutputText(response);
    const parsed = this.parseJsonObject(text);
    if (!parsed) {
      throw new Error(`Background specialist ${options.specialist} returned invalid JSON`);
    }
    return this.sanitizeTeachingObject(parsed);
  }

  private enqueueJob(options: {
    type: BackgroundAiJobType;
    userId: string;
    conversationId?: string;
    payload: Record<string, unknown>;
    dedupePending?: boolean;
  }): void {
    if (options.dedupePending) {
      const existing = this.db.get<{ id: string }>(
        `SELECT id
         FROM background_ai_jobs
         WHERE type = ?
           AND user_id = ?
           AND COALESCE(conversation_id, '') = COALESCE(?, '')
           AND status IN ('pending', 'running')
         LIMIT 1`,
        [options.type, options.userId, options.conversationId ?? null],
      );
      if (existing) {
        return;
      }
    }

    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO background_ai_jobs (
         id, type, status, user_id, conversation_id, attempts, payload_json,
         scheduled_at, created_at, updated_at
       )
       VALUES (?, ?, 'pending', ?, ?, 0, ?, ?, ?, ?)`,
      [
        randomUUID(),
        options.type,
        options.userId,
        options.conversationId ?? null,
        JSON.stringify(this.sanitizeTeachingObject(options.payload)),
        now,
        now,
        now,
      ],
    );
  }

  private nextPendingJob(): BackgroundAiJobRecord | undefined {
    return this.db.get<BackgroundAiJobRecord>(
      `SELECT id, type, status, user_id, conversation_id, attempts, payload_json,
              result_json, error_message, scheduled_at, started_at, completed_at,
              created_at, updated_at
       FROM background_ai_jobs
       WHERE status = 'pending'
         AND scheduled_at <= ?
       ORDER BY created_at ASC
       LIMIT 1`,
      [new Date().toISOString()],
    );
  }

  private markJobRunning(job: BackgroundAiJobRecord): void {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE background_ai_jobs
       SET status = 'running',
           attempts = attempts + 1,
           started_at = ?,
           updated_at = ?
       WHERE id = ?`,
      [now, now, job.id],
    );
  }

  private markJobSucceeded(jobId: string, result: Record<string, unknown>): void {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE background_ai_jobs
       SET status = 'succeeded',
           result_json = ?,
           error_message = NULL,
           completed_at = ?,
           updated_at = ?
       WHERE id = ?`,
      [JSON.stringify(this.sanitizeTeachingObject(result)), now, now, jobId],
    );
  }

  private markJobFailed(job: BackgroundAiJobRecord, message: string): void {
    const now = new Date().toISOString();
    const nextAttempts = job.attempts + 1;
    const maxAttempts = this.getMaxAttempts();
    if (nextAttempts < maxAttempts) {
      const scheduledAt = new Date(Date.now() + nextAttempts * 30_000).toISOString();
      this.db.run(
        `UPDATE background_ai_jobs
         SET status = 'pending',
             error_message = ?,
             scheduled_at = ?,
             updated_at = ?
         WHERE id = ?`,
        [message.slice(0, 1_000), scheduledAt, now, job.id],
      );
      return;
    }

    this.db.run(
      `UPDATE background_ai_jobs
       SET status = 'failed',
           error_message = ?,
           completed_at = ?,
           updated_at = ?
       WHERE id = ?`,
      [message.slice(0, 1_000), now, now, job.id],
    );
  }

  private persistLearningSignal(
    job: BackgroundAiJobRecord,
    signalType: string,
    signal: Record<string, unknown>,
  ): void {
    this.db.run(
      `INSERT INTO student_learning_signals (
         id, user_id, conversation_id, signal_type, signal_json, source_job_id, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        job.user_id,
        job.conversation_id,
        signalType,
        JSON.stringify(this.sanitizeTeachingObject(signal)),
        job.id,
        new Date().toISOString(),
      ],
    );
  }

  private getRecentLearningSignals(userId: string, limit: number): Record<string, unknown>[] {
    const rows = this.db.all<{ signal_type: string; signal_json: string; created_at: string }>(
      `SELECT signal_type, signal_json, created_at
       FROM student_learning_signals
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit],
    );

    return rows
      .reverse()
      .map((row) => ({
        signalType: row.signal_type,
        createdAt: row.created_at,
        signal: this.parseJsonObject(row.signal_json) ?? {},
      }));
  }

  private getRecentTutorTurns(
    userId: string,
    conversationId: string | null,
    limit: number,
  ): Record<string, unknown>[] {
    const rows = this.db.all<{ prompt: string; answer_json: string; created_at: string }>(
      `SELECT prompt, answer_json, created_at
       FROM tutor_turns
       WHERE user_id = ?
         AND conversation_id = COALESCE(?, conversation_id)
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, conversationId, limit],
    );

    return rows.reverse().map((row) => {
      const answer = this.parseJsonObject(row.answer_json) ?? {};
      return {
        createdAt: row.created_at,
        prompt: this.sanitizeTeachingString(row.prompt, 1_200),
        answer: this.sanitizeTeachingString(this.pickString(answer, ['answer']), 2_000),
        tasksCount: Array.isArray(answer.tasks) ? answer.tasks.length : 0,
        examplesCount: Array.isArray(answer.examples) ? answer.examples.length : 0,
        needsImage: Boolean(answer.needsImage ?? answer.needs_image),
      };
    });
  }

  private countUserTurns(userId: string): number {
    const row = this.db.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM tutor_turns WHERE user_id = ?',
      [userId],
    );
    return Number(row?.count ?? 0);
  }

  private countConversationTurns(userId: string, conversationId: string): number {
    const row = this.db.get<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM tutor_turns
       WHERE user_id = ? AND conversation_id = ?`,
      [userId, conversationId],
    );
    return Number(row?.count ?? 0);
  }

  private shouldReviewQuality(input: TutorTurnBackgroundInput): boolean {
    return (
      input.answer.answer.includes('Не удалось разобрать') ||
      (input.answer.answer.length < 80 &&
        input.answer.tasksCount === 0 &&
        input.answer.examplesCount === 0)
    );
  }

  private hasVectorStores(): boolean {
    return this.knowledgeService.getActiveVectorStoreIds().length > 0;
  }

  private parsePayload(job: BackgroundAiJobRecord): Record<string, unknown> {
    return this.parseJsonObject(job.payload_json) ?? {};
  }

  private parseJsonObject(text: string): Record<string, unknown> | undefined {
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start < 0 || end <= start) {
        return undefined;
      }
      try {
        return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return undefined;
      }
    }
  }

  private extractOutputText(response: Record<string, unknown>): string {
    const direct = this.pickString(response, ['output_text']);
    if (direct) {
      return direct;
    }

    const output = response.output;
    if (!Array.isArray(output)) {
      return '';
    }

    const chunks: string[] = [];
    for (const item of output) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const content = (item as Record<string, unknown>).content;
      if (!Array.isArray(content)) {
        continue;
      }
      for (const part of content) {
        if (!part || typeof part !== 'object') {
          continue;
        }
        const text = this.pickString(part as Record<string, unknown>, ['text', 'output_text']);
        if (text) {
          chunks.push(text);
        }
      }
    }

    return chunks.join('\n').trim();
  }

  private sanitizeTeachingObject(value: Record<string, unknown>): Record<string, unknown> {
    const sanitized = this.sanitizeTeachingValue(value, 0);
    return sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)
      ? (sanitized as Record<string, unknown>)
      : {};
  }

  private sanitizeTeachingValue(value: unknown, depth: number): unknown {
    if (value === null || value === undefined || depth > 6) {
      return undefined;
    }
    if (typeof value === 'string') {
      return this.sanitizeTeachingString(value, 800);
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (Array.isArray(value)) {
      const sanitizedItems = value
        .slice(0, 30)
        .map((item) => this.sanitizeTeachingValue(item, depth + 1))
        .filter((item) => item !== undefined);
      return sanitizedItems.length > 0 ? sanitizedItems : undefined;
    }
    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        if (this.sensitiveProfileKeyPattern.test(key)) {
          continue;
        }
        const sanitized = this.sanitizeTeachingValue(nestedValue, depth + 1);
        if (sanitized !== undefined) {
          result[key.slice(0, 80)] = sanitized;
        }
      }
      return Object.keys(result).length > 0 ? result : undefined;
    }
    return undefined;
  }

  private sanitizeTeachingString(value: unknown, maxLength: number): string | undefined {
    const cleaned = this.cleanString(value, maxLength);
    if (!cleaned || this.sensitiveProfileValuePattern.test(cleaned)) {
      return undefined;
    }
    return cleaned;
  }

  private cleanString(value: unknown, maxLength: number): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const normalized = value.trim().replace(/\s+/g, ' ');
    return normalized ? normalized.slice(0, maxLength) : undefined;
  }

  private deepMerge(
    base: Record<string, unknown>,
    patch: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(patch)) {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        result[key] &&
        typeof result[key] === 'object' &&
        !Array.isArray(result[key])
      ) {
        result[key] = this.deepMerge(
          result[key] as Record<string, unknown>,
          value as Record<string, unknown>,
        );
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private pickObject(source: Record<string, unknown>, keys: string[]): Record<string, unknown> {
    for (const key of keys) {
      const value = source[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
    }
    return {};
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
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
    return undefined;
  }

  private getLearningSignalInstructions(): string {
    return [
      'Ты фоновый анализатор учебных сигналов для AI-репетитора ЕГЭ.',
      'Выделяй только сведения, которые помогают выбирать объяснения, темп, примеры, подсказки, визуализацию и практику.',
      'Не сохраняй чувствительные личные сведения, диагнозы, семейные подробности, адреса, контакты, религию, политику, здоровье или травматичный опыт.',
      'Если встречаются такие подробности, замени их на нейтральный учебный сигнал или пропусти.',
      'Верни только валидный JSON без Markdown.',
      'Формат JSON: {"signals":[{"category":"knowledge|preference|confidence|misconception|pace|visual|motivation","value":"...","confidence":"low|medium|high","evidence":["..."]}],"knowledgeDelta":{},"learningPreferenceDelta":{},"teachingStrategyHints":[]}.',
    ].join(' ');
  }

  private getSessionSummaryInstructions(): string {
    return [
      'Ты фоновый суммаризатор учебной сессии AI-репетитора ЕГЭ.',
      'Сделай компактную учебную сводку только для будущей стратегии объяснений.',
      'Не включай сырые персональные детали и не делай клинических выводов.',
      'Верни только валидный JSON без Markdown.',
      'Формат JSON: {"summary":"...","topicsWorked":[],"successes":[],"mistakes":[],"nextSteps":[],"strategyHints":[]}.',
    ].join(' ');
  }

  private getProfileRefreshInstructions(hasRag: boolean): string {
    return [
      'Ты фоновый обновитель учебного профиля ученика для AI-репетитора ЕГЭ.',
      'Обновляй только знания, учебные предпочтения и нейтральные психолого-педагогические гипотезы для объяснения.',
      'Не ставь диагнозы, не сохраняй чувствительные личные сведения и не делай выводы вне учебного контекста.',
      hasRag
        ? 'Используй file_search только для общих педагогических стратегий, рубрик ЕГЭ и безопасных методик объяснения.'
        : 'Если RAG материалов нет, используй только текущий профиль, новые учебные сигналы и безопасные педагогические принципы.',
      'Верни только валидный JSON без Markdown.',
      'Формат JSON: {"knowledgeStatePatch":{},"learningPreferencesPatch":{},"psychologicalProfilePatch":{},"aiSummary":"короткое русское резюме для будущего prompt"}.',
    ].join(' ');
  }

  private getStrategyRefreshInstructions(hasRag: boolean): string {
    return [
      'Ты фоновый методист AI-репетитора ЕГЭ. Обнови только практическую стратегию объяснения по новым учебным сигналам.',
      'Стратегия должна помочь выбрать темп, структуру ответа, подсказки, примеры, визуальную поддержку и практику.',
      'Не добавляй диагнозы или чувствительные сведения.',
      hasRag
        ? 'Используй file_search только для общих методик объяснения, task strategy и безопасных учебных практик.'
        : 'Если RAG материалов нет, используй текущий профиль и безопасные педагогические принципы.',
      'Верни только валидный JSON без Markdown.',
      'Формат JSON: {"explanationStrategyPatch":{},"aiSummary":"короткое русское резюме для будущего prompt"}.',
    ].join(' ');
  }

  private getQualityReviewInstructions(): string {
    return [
      'Ты фоновый ревьюер качества ответа AI-репетитора по математике ЕГЭ.',
      'Проверь только учебные риски: слишком коротко, нет шагов, возможная математическая ошибка, плохая адаптация под подростка.',
      'Не пиши новое объяснение ученику. Не сохраняй чувствительные личные сведения.',
      'Верни только валидный JSON без Markdown.',
      'Формат JSON: {"risk":"none|low|needs_review","issues":[],"repairHints":[],"studentVisibleCorrectionNeeded":false}.',
    ].join(' ');
  }

  private isEnabled(): boolean {
    return this.configService.get<boolean>('ai.background.enabled') ?? true;
  }

  private getBackgroundModel(): string {
    return (
      this.configService.get<string>('ai.background.responsesModel') ||
      this.configService.get<string>('ai.openai.responsesModel') ||
      'gpt-5.5'
    );
  }

  private getServiceTier(): string | undefined {
    const configured = this.configService.get<string>('ai.background.serviceTier') ?? 'flex';
    const normalized = configured.trim().toLowerCase();
    return normalized && normalized !== 'standard' && normalized !== 'none'
      ? normalized
      : undefined;
  }

  private getDrainIntervalMs(): number {
    return this.positiveNumber(this.configService.get<number>('ai.background.drainIntervalMs'), 2_000);
  }

  private getDrainBatchSize(): number {
    return this.positiveNumber(this.configService.get<number>('ai.background.drainBatchSize'), 3);
  }

  private getMaxAttempts(): number {
    return this.positiveNumber(this.configService.get<number>('ai.background.maxAttempts'), 2);
  }

  private getProfileRefreshTurnInterval(): number {
    return this.positiveNumber(
      this.configService.get<number>('ai.background.profileRefreshTurnInterval'),
      10,
    );
  }

  private getSessionSummaryTurnInterval(): number {
    return this.positiveNumber(
      this.configService.get<number>('ai.background.sessionSummaryTurnInterval'),
      5,
    );
  }

  private positiveNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
