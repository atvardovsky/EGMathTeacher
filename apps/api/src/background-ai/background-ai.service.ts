import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { AiModelService } from '../ai-model/ai-model.service';
import { AiOperationKey } from '../ai-model/ai-model.types';
import { DatabaseService } from '../database/database.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { StudentProfileService } from '../student-profile/student-profile.service';
import type { LessonType } from '../tutor/tutor.types';
import {
  BackgroundAiJobRecord,
  BackgroundAiJobStatus,
  BackgroundAiJobType,
  BackgroundAiStatus,
  BackgroundLearningObservationRecord,
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
      lessonSessionId: input.lessonSessionId,
      lessonType: input.lessonType,
      prompt,
      answer,
      answerShape: input.answer,
      evidenceLevel: 'L1_turn_observation',
      capturedAt: now,
    };

    if (this.isBatchingEnabled()) {
      this.enqueueBatchedTutorTurnWork(input, basePayload, now);
      return;
    }

    this.enqueueLegacyTutorTurnWork(input, basePayload, now);
  }

  private enqueueLegacyTutorTurnWork(
    input: TutorTurnBackgroundInput,
    basePayload: Record<string, unknown>,
    now: string,
  ): void {
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
          lessonSessionId: input.lessonSessionId,
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

  private enqueueBatchedTutorTurnWork(
    input: TutorTurnBackgroundInput,
    basePayload: Record<string, unknown>,
    now: string,
  ): void {
    this.persistLearningObservation(input, basePayload, now);

    const pendingCount = this.countPendingLearningObservations(
      input.userId,
      input.conversationId,
    );
    const qualityTrigger = this.shouldReviewQuality(input);
    const dueNow = qualityTrigger || pendingCount >= this.getObservationWindowSize();
    const triggerReason = qualityTrigger
      ? 'quality_review_trigger'
      : dueNow
        ? `window_${pendingCount}_observations`
        : 'idle_flush';
    const scheduledAt = dueNow
      ? now
      : new Date(Date.now() + this.getObservationIdleFlushMs()).toISOString();

    this.enqueueLearningWindowJob({
      userId: input.userId,
      conversationId: input.conversationId,
      scheduledAt,
      triggerReason,
      observationCount: pendingCount,
      dueNow,
      lessonSessionId: input.lessonSessionId,
    });
  }

  async drainPending(limit = this.getDrainBatchSize()): Promise<number> {
    if (!this.isEnabled() || this.draining) {
      return 0;
    }

    this.draining = true;
    let processed = 0;
    try {
      this.recoverInterruptedBackgroundState();
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
      case 'learning_window_analysis':
        return this.analyzeLearningWindow(job);
      case 'session_summary':
        return this.createSessionSummary(job);
      case 'student_profile_refresh':
        return this.refreshStudentProfile(job);
      case 'profile_strategy_refresh':
        return this.refreshProfileAndStrategy(job);
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
      operation: 'backgroundLearningSignal',
      specialist: 'learning-signal-extractor',
      userId: job.user_id,
      conversationId: job.conversation_id ?? undefined,
      lessonSessionId: this.pickString(payload, ['lessonSessionId', 'lesson_session_id']),
      lessonType: this.normalizeLessonType(payload.lessonType),
      instructions: this.getLearningSignalInstructions(),
      inputText: [
        'Один учебный ход ученика и ответ репетитора:',
        JSON.stringify(payload, null, 2),
      ].join('\n'),
      useRag: false,
    });
    this.persistSkillProgressSignals(
      job,
      parsed,
      this.normalizeLessonType(payload.lessonType),
    );
    this.persistLearningSignal(job, 'turn_signal', parsed);
    return parsed;
  }

  private async analyzeLearningWindow(
    job: BackgroundAiJobRecord,
  ): Promise<Record<string, unknown>> {
    const payload = this.parsePayload(job);
    const observations = this.getPendingLearningObservations(
      job.user_id,
      job.conversation_id,
      this.getObservationMaxWindowSize(),
    );
    if (observations.length === 0) {
      return { skipped: 'no_pending_observations' };
    }

    const observationIds = observations.map((observation) => observation.id);
    if (this.markObservationsQueued(observationIds) === 0) {
      return { skipped: 'no_claimed_observations' };
    }

    try {
      const lessonType = this.pickWindowLessonType(observations, payload);
      const lessonSessionId =
        this.pickString(payload, ['lessonSessionId', 'lesson_session_id']) ??
        this.pickObservationLessonSessionId(observations);
      const parsed = await this.createBackgroundJsonResponse({
        operation: 'backgroundLearningWindow',
        specialist: 'learning-window-analyzer',
        userId: job.user_id,
        conversationId: job.conversation_id ?? undefined,
        lessonSessionId,
        lessonType,
        instructions: this.getLearningWindowInstructions(),
        inputText: [
          'Окно последних учебных наблюдений ученика:',
          JSON.stringify(
            {
              triggerReason: this.pickString(payload, ['triggerReason']) ?? 'unknown',
              observations,
            },
            null,
            2,
          ),
        ].join('\n'),
        useRag: false,
        promptCacheKey: this.buildPromptCacheKey(
          job.user_id,
          job.conversation_id,
          'learning-window',
        ),
      });

      this.db.transaction(() => {
        const windowId = this.persistAnalysisWindow(job, payload, observations, parsed);
        this.persistLearningSignal(job, 'learning_window', parsed);
        const summary = this.extractSessionSummaryText(parsed);
        if (summary) {
          this.persistLearningSignal(job, 'session_summary', {
            summary,
            lessonType,
            source: 'learning_window_analysis',
          });
        }
        this.persistSessionSummary(job, parsed, lessonType, windowId);
        this.persistSkillProgressSignals(job, parsed, lessonType, windowId);
        this.markObservationsProcessed(observationIds, windowId);

        if (this.shouldRefreshProfileStrategy(job.user_id)) {
          this.enqueueJob({
            type: 'profile_strategy_refresh',
            userId: job.user_id,
            conversationId: job.conversation_id ?? undefined,
            payload: {
              reason: this.pickString(payload, ['triggerReason']) ?? 'learning_window_analysis',
              sourceJobId: job.id,
              capturedAt: new Date().toISOString(),
            },
            dedupePending: true,
          });
        }
      });

      return parsed;
    } catch (error) {
      this.releaseQueuedObservations(observationIds);
      throw error;
    }
  }

  private async createSessionSummary(job: BackgroundAiJobRecord): Promise<Record<string, unknown>> {
    const turns = this.getRecentTutorTurns(job.user_id, job.conversation_id, 12);
    if (turns.length === 0) {
      return { skipped: 'no_turns' };
    }

    const lessonType = this.pickTurnLessonType(turns);
    const payload = this.parsePayload(job);
    const parsed = await this.createBackgroundJsonResponse({
      operation: 'backgroundSessionSummary',
      specialist: 'session-summarizer',
      userId: job.user_id,
      conversationId: job.conversation_id ?? undefined,
      lessonSessionId: this.pickString(payload, ['lessonSessionId', 'lesson_session_id']),
      lessonType,
      instructions: this.getSessionSummaryInstructions(),
      inputText: [
        'Последние ходы учебной сессии:',
        JSON.stringify(turns, null, 2),
      ].join('\n'),
      useRag: false,
    });
    this.persistSessionSummary(job, parsed, lessonType);
    this.persistLearningSignal(job, 'session_summary', parsed);
    return parsed;
  }

  private async refreshStudentProfile(job: BackgroundAiJobRecord): Promise<Record<string, unknown>> {
    const profile = this.studentProfileService.getProfile(job.user_id);
    if (!profile) {
      return { skipped: 'no_student_profile' };
    }

    const signals = this.getRecentLearningSignals(job.user_id, 30);
    const sessionSummaries = this.getRecentSessionSummaries(job.user_id, 5);
    const skillProgress = this.getRecentSkillProgressSignals(job.user_id, 30);
    if (signals.length === 0 && sessionSummaries.length === 0 && skillProgress.length === 0) {
      return { skipped: 'no_learning_signals' };
    }

    const parsed = await this.createBackgroundJsonResponse({
      operation: 'backgroundProfileRefresh',
      specialist: 'student-profile-background-refresher',
      userId: job.user_id,
      conversationId: job.conversation_id ?? undefined,
      lessonSessionId: this.pickString(this.parsePayload(job), [
        'lessonSessionId',
        'lesson_session_id',
      ]),
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
        JSON.stringify({ signals, sessionSummaries, skillProgress }, null, 2),
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
    const sessionSummaries = this.getRecentSessionSummaries(job.user_id, 5);
    const skillProgress = this.getRecentSkillProgressSignals(job.user_id, 30);
    if (signals.length === 0 && sessionSummaries.length === 0 && skillProgress.length === 0) {
      return { skipped: 'no_learning_signals' };
    }

    const parsed = await this.createBackgroundJsonResponse({
      operation: 'backgroundTeachingStrategyRefresh',
      specialist: 'teaching-strategy-background-planner',
      userId: job.user_id,
      conversationId: job.conversation_id ?? undefined,
      lessonSessionId: this.pickString(this.parsePayload(job), [
        'lessonSessionId',
        'lesson_session_id',
      ]),
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
        JSON.stringify({ signals, sessionSummaries, skillProgress }, null, 2),
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

  private async refreshProfileAndStrategy(
    job: BackgroundAiJobRecord,
  ): Promise<Record<string, unknown>> {
    const profile = this.studentProfileService.getProfile(job.user_id);
    if (!profile) {
      return { skipped: 'no_student_profile' };
    }

    const signals = this.getRecentLearningSignals(job.user_id, 30);
    const sessionSummaries = this.getRecentSessionSummaries(job.user_id, 5);
    const skillProgress = this.getRecentSkillProgressSignals(job.user_id, 30);
    if (signals.length === 0 && sessionSummaries.length === 0 && skillProgress.length === 0) {
      return { skipped: 'no_learning_signals' };
    }

    const parsed = await this.createBackgroundJsonResponse({
      operation: 'backgroundProfileStrategyRefresh',
      specialist: 'profile-strategy-background-refresher',
      userId: job.user_id,
      conversationId: job.conversation_id ?? undefined,
      lessonSessionId: this.pickString(this.parsePayload(job), [
        'lessonSessionId',
        'lesson_session_id',
      ]),
      instructions: this.getProfileStrategyRefreshInstructions(this.hasVectorStores()),
      inputText: [
        'Текущий профиль и стратегия ученика:',
        JSON.stringify({
          knowledgeState: profile.knowledgeState,
          learningPreferences: profile.learningPreferences,
          psychologicalProfile: profile.psychologicalProfile,
          explanationStrategy: profile.explanationStrategy,
          aiSummary: profile.aiSummary,
        }, null, 2),
        'Новые агрегированные учебные сигналы:',
        JSON.stringify({ signals, sessionSummaries, skillProgress }, null, 2),
      ].join('\n'),
      useRag: true,
      promptCacheKey: this.buildPromptCacheKey(
        job.user_id,
        job.conversation_id,
        'profile-strategy',
      ),
    });

    const knowledgeStatePatch = this.pickObject(parsed, [
      'knowledgeStatePatch',
      'knowledge_state_patch',
    ]);
    const learningPreferencesPatch = this.pickObject(parsed, [
      'learningPreferencesPatch',
      'learning_preferences_patch',
    ]);
    const psychologicalProfilePatch = this.pickObject(parsed, [
      'psychologicalProfilePatch',
      'psychological_profile_patch',
    ]);
    const explanationStrategyPatch = this.pickObject(parsed, [
      'explanationStrategyPatch',
      'explanation_strategy_patch',
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
    const nextStrategy = this.deepMerge(profile.explanationStrategy, explanationStrategyPatch);

    this.db.run(
      `UPDATE student_profiles
       SET knowledge_state_json = ?,
           learning_preferences_json = ?,
           psychological_profile_json = ?,
           explanation_strategy_json = ?,
           ai_summary = ?,
           updated_at = ?
       WHERE user_id = ?`,
      [
        JSON.stringify(this.sanitizeTeachingObject(nextKnowledgeState)),
        JSON.stringify(this.sanitizeTeachingObject(nextLearningPreferences)),
        JSON.stringify(this.sanitizeTeachingObject(nextPsychologicalProfile)),
        JSON.stringify(this.sanitizeTeachingObject(nextStrategy)),
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
      explanationStrategyPatch,
      aiSummaryUpdated: Boolean(aiSummary),
    };
    this.persistLearningSignal(job, 'profile_strategy_refresh', result);
    return result;
  }

  private async reviewTutorQuality(job: BackgroundAiJobRecord): Promise<Record<string, unknown>> {
    const payload = this.parsePayload(job);
    const parsed = await this.createBackgroundJsonResponse({
      operation: 'backgroundQualityReview',
      specialist: 'tutor-quality-background-reviewer',
      userId: job.user_id,
      conversationId: job.conversation_id ?? undefined,
      lessonSessionId: this.pickString(payload, ['lessonSessionId', 'lesson_session_id']),
      lessonType: this.normalizeLessonType(payload.lessonType),
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
    operation: AiOperationKey;
    specialist: string;
    userId: string;
    conversationId?: string;
    lessonSessionId?: string;
    lessonType?: LessonType;
    instructions: string;
    inputText: string;
    useRag: boolean;
    promptCacheKey?: string;
  }): Promise<Record<string, unknown>> {
    const vectorStoreIds = options.useRag ? this.knowledgeService.getActiveVectorStoreIds() : [];
    const useFileSearch = options.useRag && vectorStoreIds.length > 0;
    const request: Record<string, unknown> = {
      instructions: options.instructions,
      usageContext: {
        userId: options.userId,
        conversationId: options.conversationId,
        lessonSessionId: options.lessonSessionId,
        lessonType: options.lessonType,
      },
      metadata: {
        background_ai: 'true',
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

    if (this.isPromptCacheKeyEnabled() && options.promptCacheKey) {
      request.prompt_cache_key = options.promptCacheKey;
    }

    const response = await this.aiModel.createOperationResponse(options.operation, request);
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
    scheduledAt?: string;
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
    const scheduledAt = options.scheduledAt ?? now;
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
        scheduledAt,
        now,
        now,
      ],
    );
  }

  private enqueueLearningWindowJob(options: {
    userId: string;
    conversationId: string;
    scheduledAt: string;
    triggerReason: string;
    observationCount: number;
    dueNow: boolean;
    lessonSessionId?: string;
  }): void {
    const existing = this.db.get<{ id: string; status: BackgroundAiJobStatus; scheduled_at: string }>(
      `SELECT id, status, scheduled_at
       FROM background_ai_jobs
       WHERE type = 'learning_window_analysis'
         AND user_id = ?
         AND conversation_id = ?
         AND status IN ('pending', 'running')
       ORDER BY created_at ASC
       LIMIT 1`,
      [options.userId, options.conversationId],
    );

    const payload = {
      triggerReason: options.triggerReason,
      observationCount: options.observationCount,
      lessonSessionId: options.lessonSessionId,
      capturedAt: new Date().toISOString(),
    };

    if (existing) {
      const shouldReschedule =
        existing.status === 'pending' &&
        ((options.dueNow && existing.scheduled_at > options.scheduledAt) ||
          (!options.dueNow && existing.scheduled_at < options.scheduledAt));
      if (shouldReschedule) {
        this.db.run(
          `UPDATE background_ai_jobs
           SET scheduled_at = ?,
               payload_json = ?,
               updated_at = ?
           WHERE id = ?`,
          [
            options.scheduledAt,
            JSON.stringify(this.sanitizeTeachingObject(payload)),
            new Date().toISOString(),
            existing.id,
          ],
        );
      }
      return;
    }

    this.enqueueJob({
      type: 'learning_window_analysis',
      userId: options.userId,
      conversationId: options.conversationId,
      payload,
      scheduledAt: options.scheduledAt,
    });
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

  private recoverInterruptedBackgroundState(): void {
    const timeoutMs = this.getRunningJobTimeoutMs();
    const cutoff = new Date(Date.now() - timeoutMs).toISOString();
    const now = new Date().toISOString();
    const maxAttempts = this.getMaxAttempts();

    const observations = this.db.run(
      `UPDATE background_learning_observations
       SET status = 'pending',
           window_id = NULL,
           updated_at = ?
       WHERE status = 'queued'
         AND updated_at <= ?`,
      [now, cutoff],
    ).changes;

    const failedJobs = this.db.run(
      `UPDATE background_ai_jobs
       SET status = 'failed',
           error_message = ?,
           completed_at = ?,
           updated_at = ?
       WHERE status = 'running'
         AND COALESCE(started_at, updated_at) <= ?
         AND attempts >= ?`,
      [
        'Background job timed out while running',
        now,
        now,
        cutoff,
        maxAttempts,
      ],
    ).changes;

    const requeuedJobs = this.db.run(
      `UPDATE background_ai_jobs
       SET status = 'pending',
           error_message = ?,
           scheduled_at = ?,
           started_at = NULL,
           completed_at = NULL,
           updated_at = ?
       WHERE status = 'running'
         AND COALESCE(started_at, updated_at) <= ?
         AND attempts < ?`,
      [
        'Recovered stale running background job',
        now,
        now,
        cutoff,
        maxAttempts,
      ],
    ).changes;

    if (observations > 0 || failedJobs > 0 || requeuedJobs > 0) {
      this.logger.warn(
        `Recovered background AI state: observations=${observations}, requeuedJobs=${requeuedJobs}, failedJobs=${failedJobs}`,
      );
    }
  }

  private persistLearningObservation(
    input: TutorTurnBackgroundInput,
    payload: Record<string, unknown>,
    now: string,
  ): void {
    this.db.run(
      `INSERT INTO background_learning_observations (
         id, user_id, conversation_id, lesson_type, source, observation_json, status,
         window_id, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)`,
      [
        randomUUID(),
        input.userId,
        input.conversationId,
        input.lessonType,
        input.source,
        JSON.stringify(this.sanitizeTeachingObject(payload)),
        now,
        now,
      ],
    );
  }

  private countPendingLearningObservations(userId: string, conversationId: string): number {
    const row = this.db.get<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM background_learning_observations
       WHERE user_id = ?
         AND conversation_id = ?
         AND status = 'pending'`,
      [userId, conversationId],
    );
    return Number(row?.count ?? 0);
  }

  private getPendingLearningObservations(
    userId: string,
    conversationId: string | null,
    limit: number,
  ): Array<Record<string, unknown> & { id: string }> {
    const rows = this.db.all<BackgroundLearningObservationRecord>(
      `SELECT id, user_id, conversation_id, lesson_type, source, observation_json, status,
              window_id, created_at, updated_at
       FROM background_learning_observations
       WHERE user_id = ?
         AND conversation_id = COALESCE(?, conversation_id)
         AND status = 'pending'
       ORDER BY created_at ASC
       LIMIT ?`,
      [userId, conversationId, limit],
    );

    return rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      lessonType: row.lesson_type,
      source: row.source,
      observation: this.parseJsonObject(row.observation_json) ?? {},
    }));
  }

  private persistAnalysisWindow(
    job: BackgroundAiJobRecord,
    payload: Record<string, unknown>,
    observations: Array<Record<string, unknown> & { id: string }>,
    result: Record<string, unknown>,
  ): string {
    const now = new Date().toISOString();
    const windowId = randomUUID();
    this.db.run(
      `INSERT INTO background_analysis_windows (
         id, user_id, conversation_id, status, trigger_reason, observation_count,
         observation_ids_json, result_json, source_job_id, created_at, completed_at
       )
       VALUES (?, ?, ?, 'succeeded', ?, ?, ?, ?, ?, ?, ?)`,
      [
        windowId,
        job.user_id,
        job.conversation_id,
        this.pickString(payload, ['triggerReason']) ?? 'unknown',
        observations.length,
        JSON.stringify(observations.map((observation) => observation.id)),
        JSON.stringify(this.sanitizeTeachingObject(result)),
        job.id,
        now,
        now,
      ],
    );
    return windowId;
  }

  private markObservationsProcessed(observationIds: string[], windowId: string): void {
    if (observationIds.length === 0) {
      return;
    }
    const placeholders = observationIds.map(() => '?').join(', ');
    this.db.run(
      `UPDATE background_learning_observations
       SET status = 'processed',
           window_id = ?,
           updated_at = ?
       WHERE id IN (${placeholders})`,
      [windowId, new Date().toISOString(), ...observationIds],
    );
  }

  private markObservationsQueued(observationIds: string[]): number {
    if (observationIds.length === 0) {
      return 0;
    }
    const placeholders = observationIds.map(() => '?').join(', ');
    return this.db.run(
      `UPDATE background_learning_observations
       SET status = 'queued',
           updated_at = ?
       WHERE id IN (${placeholders})
         AND status = 'pending'`,
      [new Date().toISOString(), ...observationIds],
    ).changes;
  }

  private releaseQueuedObservations(observationIds: string[]): void {
    if (observationIds.length === 0) {
      return;
    }
    const placeholders = observationIds.map(() => '?').join(', ');
    this.db.run(
      `UPDATE background_learning_observations
       SET status = 'pending',
           window_id = NULL,
           updated_at = ?
       WHERE id IN (${placeholders})
         AND status = 'queued'`,
      [new Date().toISOString(), ...observationIds],
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

  private persistSessionSummary(
    job: BackgroundAiJobRecord,
    result: Record<string, unknown>,
    lessonType: LessonType,
    sourceWindowId?: string,
  ): void {
    const summary = this.extractSessionSummaryObject(result);
    if (Object.keys(summary).length === 0) {
      return;
    }

    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO student_session_summaries (
         id, user_id, conversation_id, lesson_type, summary_json,
         evidence_levels_json, source_window_id, source_job_id, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        job.user_id,
        job.conversation_id,
        lessonType,
        JSON.stringify(this.sanitizeTeachingObject(summary)),
        JSON.stringify(this.extractEvidenceLevels(result)),
        sourceWindowId ?? null,
        job.id,
        now,
        now,
      ],
    );
  }

  private persistSkillProgressSignals(
    job: BackgroundAiJobRecord,
    result: Record<string, unknown>,
    lessonType: LessonType,
    sourceWindowId?: string,
  ): void {
    const signals = this.extractSkillProgressSignals(result);
    if (signals.length === 0) {
      return;
    }

    const now = new Date().toISOString();
    for (const signal of signals) {
      const topic = this.pickString(signal, ['topic', 'egeTopic', 'ege_topic']) ?? 'unknown';
      const skill = this.pickString(signal, ['skill', 'subskill', 'ability']) ?? topic;
      const evidence = this.sanitizeTeachingObject({
        evidence: this.pickStringArray(signal, ['evidence']),
        mistakePatterns: this.pickStringArray(signal, ['mistakePatterns', 'mistake_patterns']),
        recommendedNextAction: this.pickString(signal, [
          'recommendedNextAction',
          'recommended_next_action',
          'nextAction',
          'next_action',
        ]),
      });

      this.db.run(
        `INSERT INTO student_skill_progress (
           id, user_id, conversation_id, lesson_type, topic, skill, direction,
           confidence, support_needed, independence, evidence_json,
           source_window_id, source_job_id, created_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          job.user_id,
          job.conversation_id,
          lessonType,
          topic.slice(0, 160),
          skill.slice(0, 160),
          this.normalizeProgressDirection(this.pickString(signal, ['direction', 'trend'])),
          this.normalizeConfidence(this.pickString(signal, ['confidence'])),
          this.normalizeSupportNeeded(this.pickString(signal, ['supportNeeded', 'support_needed'])),
          this.normalizeIndependence(this.pickString(signal, ['independence'])),
          JSON.stringify(evidence),
          sourceWindowId ?? null,
          job.id,
          now,
        ],
      );
    }
  }

  private extractSessionSummaryText(result: Record<string, unknown>): string | undefined {
    const sessionSummary = this.pickObject(result, ['sessionSummary', 'session_summary']);
    return (
      this.pickString(result, ['summary']) ??
      this.pickString(sessionSummary, ['summary', 'text'])
    );
  }

  private extractSessionSummaryObject(result: Record<string, unknown>): Record<string, unknown> {
    const sessionSummary = this.pickObject(result, ['sessionSummary', 'session_summary']);
    const summary = this.extractSessionSummaryText(result);
    const candidate: Record<string, unknown> = { ...sessionSummary };
    if (summary && !candidate.summary) {
      candidate.summary = summary;
    }
    for (const [targetKey, sourceKeys] of Object.entries({
      topicsWorked: ['topicsWorked', 'topics_worked'],
      successes: ['successes'],
      mistakes: ['mistakes'],
      nextSteps: ['nextSteps', 'next_steps'],
      strategyHints: ['strategyHints', 'strategy_hints', 'teachingStrategyHints'],
    })) {
      const values = this.pickArray(result, sourceKeys);
      if (values.length > 0 && !candidate[targetKey]) {
        candidate[targetKey] = values;
      }
    }
    return this.sanitizeTeachingObject(candidate);
  }

  private extractEvidenceLevels(result: Record<string, unknown>): Record<string, unknown> {
    const explicit = this.pickObject(result, ['evidenceLevels', 'evidence_levels']);
    if (Object.keys(explicit).length > 0) {
      return this.sanitizeTeachingObject(explicit);
    }

    return this.sanitizeTeachingObject({
      level0RawTurnData: 'stored separately in tutor_turns with limited raw prompt/answer JSON',
      level1TurnObservations: this.pickArray(result, ['observations']).length,
      level2SessionSummary: Boolean(this.extractSessionSummaryText(result)),
      level3LearningSignals: this.pickArray(result, ['signals']).length,
      level4SkillTrends: this.extractSkillProgressSignals(result).length,
      level5StrategyUpdateHints: this.pickArray(result, ['teachingStrategyHints', 'strategyHints']).length,
    });
  }

  private extractSkillProgressSignals(result: Record<string, unknown>): Record<string, unknown>[] {
    return this.pickArray(result, [
      'skillProgressSignals',
      'skill_progress_signals',
      'skillProgress',
      'skill_progress',
      'progressSignals',
      'progress_signals',
    ]).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)));
  }

  private pickWindowLessonType(
    observations: Array<Record<string, unknown> & { id: string }>,
    payload: Record<string, unknown>,
  ): LessonType {
    const fromPayload = this.normalizeLessonType(payload.lessonType);
    if (fromPayload) {
      return fromPayload;
    }
    for (const observation of observations) {
      const lessonType = this.normalizeLessonType(observation.lessonType);
      if (lessonType) {
        return lessonType;
      }
    }
    return 'tutor';
  }

  private pickObservationLessonSessionId(
    observations: Array<Record<string, unknown> & { id: string }>,
  ): string | undefined {
    for (const observation of observations) {
      const payload = this.pickObject(observation, ['observation']);
      const lessonSessionId = this.pickString(payload, ['lessonSessionId', 'lesson_session_id']);
      if (lessonSessionId) {
        return lessonSessionId;
      }
    }
    return undefined;
  }

  private pickTurnLessonType(turns: Record<string, unknown>[]): LessonType {
    for (const turn of turns) {
      const lessonType = this.normalizeLessonType(turn.lessonType);
      if (lessonType) {
        return lessonType;
      }
    }
    return 'tutor';
  }

  private normalizeLessonType(value: unknown): LessonType {
    return typeof value === 'string' && this.isLessonType(value) ? value : 'tutor';
  }

  private isLessonType(value: string): value is LessonType {
    return [
      'meeting',
      'tutor',
      'concept',
      'practice',
      'diagnostic',
      'exam_strategy',
      'mistake_review',
      'visual_explanation',
      'reflection',
    ].includes(value);
  }

  private normalizeProgressDirection(value: string | undefined): 'progress' | 'regression' | 'stable' | 'unknown' {
    return value === 'progress' || value === 'regression' || value === 'stable' ? value : 'unknown';
  }

  private normalizeConfidence(value: string | undefined): 'low' | 'medium' | 'high' | 'unknown' {
    return value === 'low' || value === 'medium' || value === 'high' ? value : 'unknown';
  }

  private normalizeSupportNeeded(
    value: string | undefined,
  ): 'none' | 'hint' | 'step_by_step' | 'full_explanation' | 'unknown' {
    return value === 'none' || value === 'hint' || value === 'step_by_step' || value === 'full_explanation'
      ? value
      : 'unknown';
  }

  private normalizeIndependence(value: string | undefined): 'low' | 'medium' | 'high' | 'unknown' {
    return value === 'low' || value === 'medium' || value === 'high' ? value : 'unknown';
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

  private getRecentSessionSummaries(userId: string, limit: number): Record<string, unknown>[] {
    const rows = this.db.all<{
      conversation_id: string | null;
      lesson_type: LessonType;
      summary_json: string;
      evidence_levels_json: string;
      created_at: string;
    }>(
      `SELECT conversation_id, lesson_type, summary_json, evidence_levels_json, created_at
       FROM student_session_summaries
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit],
    );

    return rows.reverse().map((row) => ({
      conversationId: row.conversation_id,
      lessonType: row.lesson_type,
      summary: this.parseJsonObject(row.summary_json) ?? {},
      evidenceLevels: this.parseJsonObject(row.evidence_levels_json) ?? {},
      createdAt: row.created_at,
    }));
  }

  private getRecentSkillProgressSignals(userId: string, limit: number): Record<string, unknown>[] {
    const rows = this.db.all<{
      conversation_id: string | null;
      lesson_type: LessonType;
      topic: string;
      skill: string;
      direction: string;
      confidence: string;
      support_needed: string;
      independence: string;
      evidence_json: string;
      created_at: string;
    }>(
      `SELECT conversation_id, lesson_type, topic, skill, direction, confidence,
              support_needed, independence, evidence_json, created_at
       FROM student_skill_progress
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit],
    );

    return rows.reverse().map((row) => ({
      conversationId: row.conversation_id,
      lessonType: row.lesson_type,
      topic: row.topic,
      skill: row.skill,
      direction: row.direction,
      confidence: row.confidence,
      supportNeeded: row.support_needed,
      independence: row.independence,
      evidence: this.parseJsonObject(row.evidence_json) ?? {},
      createdAt: row.created_at,
    }));
  }

  private getRecentTutorTurns(
    userId: string,
    conversationId: string | null,
    limit: number,
  ): Record<string, unknown>[] {
    const rows = this.db.all<{
      prompt: string;
      answer_json: string;
      lesson_type: LessonType;
      created_at: string;
    }>(
      `SELECT prompt, answer_json, lesson_type, created_at
       FROM tutor_turns
       WHERE user_id = ?
         AND conversation_id = COALESCE(?, conversation_id)
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, conversationId, limit],
    );

    return rows.reverse().map((row) => {
      const answer = this.parseJsonObject(row.answer_json) ?? {};
      const blocks = Array.isArray(answer.blocks) ? answer.blocks : [];
      return {
        createdAt: row.created_at,
        lessonType: row.lesson_type,
        prompt: this.sanitizeTeachingString(row.prompt, 1_200),
        answer: this.sanitizeTeachingString(this.pickString(answer, ['answer']), 2_000),
        tasksCount: Array.isArray(answer.tasks)
          ? answer.tasks.length
          : blocks.filter((block) => this.isResponseBlockType(block, 'task')).length,
        examplesCount: Array.isArray(answer.examples)
          ? answer.examples.length
          : blocks.filter((block) => this.isResponseBlockType(block, 'example')).length,
        needsImage: Boolean(
          answer.needsImage ??
            answer.needs_image ??
            blocks.some((block) => this.isResponseBlockType(block, 'image')),
        ),
      };
    });
  }

  private isResponseBlockType(block: unknown, type: string): boolean {
    return Boolean(
      block && typeof block === 'object' && (block as Record<string, unknown>).type === type,
    );
  }

  private countUserTurns(userId: string): number {
    const row = this.db.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM tutor_turns WHERE user_id = ?',
      [userId],
    );
    return Number(row?.count ?? 0);
  }

  private shouldRefreshProfileStrategy(userId: string): boolean {
    const userTurnCount = this.countUserTurns(userId);
    return userTurnCount > 0 && userTurnCount % this.getProfileRefreshTurnInterval() === 0;
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

  private pickArray(source: Record<string, unknown>, keys: string[]): unknown[] {
    for (const key of keys) {
      const value = source[key];
      if (Array.isArray(value)) {
        return value;
      }
    }
    return [];
  }

  private pickStringArray(source: Record<string, unknown>, keys: string[]): string[] {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return [value.trim().slice(0, 400)];
      }
      if (Array.isArray(value)) {
        return value
          .map((item) => this.sanitizeTeachingString(item, 400))
          .filter((item): item is string => Boolean(item))
          .slice(0, 10);
      }
    }
    return [];
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
      'Учитывай lessonType из входа. Для practice/diagnostic/mistake_review особенно оцени прогресс, регресс, самостоятельность и поддержку по темам.',
      'Не сохраняй чувствительные личные сведения, диагнозы, семейные подробности, адреса, контакты, религию, политику, здоровье или травматичный опыт.',
      'Если встречаются такие подробности, замени их на нейтральный учебный сигнал или пропусти.',
      'Верни только валидный JSON без Markdown.',
      'Формат JSON: {"signals":[{"category":"knowledge|preference|confidence|misconception|pace|visual|motivation","value":"...","confidence":"low|medium|high","evidence":["..."]}],"skillProgressSignals":[{"topic":"...","skill":"...","direction":"progress|regression|stable|unknown","confidence":"low|medium|high","evidence":["..."],"mistakePatterns":[],"supportNeeded":"none|hint|step_by_step|full_explanation","independence":"low|medium|high","recommendedNextAction":"..."}],"knowledgeDelta":{},"learningPreferenceDelta":{},"teachingStrategyHints":[]}.',
    ].join(' ');
  }

  private getLearningWindowInstructions(): string {
    return [
      'Ты фоновый анализатор окна учебных наблюдений для AI-репетитора ЕГЭ.',
      'Анализируй несколько ходов вместе, чтобы не вызывать модель после каждого сообщения.',
      'Выделяй только сведения, которые помогают выбирать объяснения, темп, примеры, подсказки, визуализацию, диагностику и практику.',
      'Сделай компактную сводку сессии и явно разложи информацию по уровням: L0 сырые ходы только как количество/ссылку на tutor_turns, L1 наблюдения, L2 сводка сессии, L3 учебные сигналы, L4 прогресс/регресс навыков, L5 подсказки для стратегии.',
      'Для каждого навыка определи direction: progress, regression, stable или unknown. Не делай вывод без evidence и confidence.',
      'Не сохраняй диагнозы, семейные подробности, адреса, контакты, религию, политику, здоровье, травмы или другие неучебные чувствительные сведения.',
      'Если такие сведения встретились, пропусти их или замени на нейтральный учебный сигнал.',
      'Верни только валидный JSON без Markdown.',
      'Формат JSON: {"summary":"...","sessionSummary":{"summary":"...","topicsWorked":[],"successes":[],"mistakes":[],"nextSteps":[],"strategyHints":[]},"evidenceLevels":{"L0":"raw tutor turns stored in tutor_turns, not repeated here","L1":[],"L2":"...","L3":[],"L4":[],"L5":[]},"signals":[{"category":"knowledge|preference|confidence|misconception|pace|visual|motivation|quality","value":"...","confidence":"low|medium|high","evidence":["..."]}],"skillProgressSignals":[{"topic":"...","skill":"...","direction":"progress|regression|stable|unknown","confidence":"low|medium|high","evidence":["..."],"mistakePatterns":[],"supportNeeded":"none|hint|step_by_step|full_explanation","independence":"low|medium|high","recommendedNextAction":"..."}],"knowledgeDelta":{},"learningPreferenceDelta":{},"teachingStrategyHints":[],"qualityReview":{"risk":"none|low|needs_review","issues":[],"repairHints":[],"studentVisibleCorrectionNeeded":false},"profileUpdateRecommended":true}.',
    ].join(' ');
  }

  private getSessionSummaryInstructions(): string {
    return [
      'Ты фоновый суммаризатор учебной сессии AI-репетитора ЕГЭ.',
      'Сделай компактную учебную сводку только для будущей стратегии объяснений.',
      'Верни уровни информации: L0 как ссылку на tutor_turns/количество ходов, L1 наблюдения, L2 сводка, L3 сигналы, L4 прогресс или регресс, L5 подсказки стратегии.',
      'Не включай сырые персональные детали и не делай клинических выводов.',
      'Верни только валидный JSON без Markdown.',
      'Формат JSON: {"summary":"...","sessionSummary":{"summary":"...","topicsWorked":[],"successes":[],"mistakes":[],"nextSteps":[],"strategyHints":[]},"evidenceLevels":{"L0":"raw tutor turns stored in tutor_turns, not repeated here","L1":[],"L2":"...","L3":[],"L4":[],"L5":[]},"skillProgressSignals":[{"topic":"...","skill":"...","direction":"progress|regression|stable|unknown","confidence":"low|medium|high","evidence":["..."],"mistakePatterns":[],"supportNeeded":"none|hint|step_by_step|full_explanation","independence":"low|medium|high","recommendedNextAction":"..."}]}.',
    ].join(' ');
  }

  private getProfileRefreshInstructions(hasRag: boolean): string {
    return [
      'Ты фоновый обновитель учебного профиля ученика для AI-репетитора ЕГЭ.',
      'Обновляй только знания, учебные предпочтения и нейтральные психолого-педагогические гипотезы для объяснения. Учитывай sessionSummaries и skillProgress: прогресс усиливает самостоятельность, регресс требует смены объяснения или повторения.',
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
      'Стратегия должна помочь выбрать темп, структуру ответа, подсказки, примеры, визуальную поддержку и практику. Учитывай прогресс/регресс по skillProgress и не повышай сложность при слабой самостоятельности.',
      'Не добавляй диагнозы или чувствительные сведения.',
      hasRag
        ? 'Используй file_search только для общих методик объяснения, task strategy и безопасных учебных практик.'
        : 'Если RAG материалов нет, используй текущий профиль и безопасные педагогические принципы.',
      'Верни только валидный JSON без Markdown.',
      'Формат JSON: {"explanationStrategyPatch":{},"aiSummary":"короткое русское резюме для будущего prompt"}.',
    ].join(' ');
  }

  private getProfileStrategyRefreshInstructions(hasRag: boolean): string {
    return [
      'Ты фоновый обновитель учебного профиля и стратегии объяснения для AI-репетитора ЕГЭ.',
      'Используй агрегированные учебные сигналы, sessionSummaries и skillProgress, а не сырые диалоги, чтобы обновить только знания, учебные предпочтения, нейтральные психолого-педагогические гипотезы и практическую стратегию объяснения.',
      'Стратегия должна помогать выбирать темп, структуру ответа, подсказки, примеры, визуальную поддержку и практику.',
      'Не ставь диагнозы, не сохраняй чувствительные личные сведения и не делай выводы вне учебного контекста.',
      hasRag
        ? 'Используй file_search только для общих педагогических стратегий, рубрик ЕГЭ и безопасных методик объяснения.'
        : 'Если RAG материалов нет, используй только текущий профиль, новые учебные сигналы и безопасные педагогические принципы.',
      'Верни только валидный JSON без Markdown.',
      'Формат JSON: {"knowledgeStatePatch":{},"learningPreferencesPatch":{},"psychologicalProfilePatch":{},"explanationStrategyPatch":{},"aiSummary":"короткое русское резюме для будущего prompt"}.',
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

  private isBatchingEnabled(): boolean {
    return this.configService.get<boolean>('ai.background.batchingEnabled') ?? true;
  }

  private isPromptCacheKeyEnabled(): boolean {
    return this.configService.get<boolean>('ai.background.promptCacheKeyEnabled') ?? true;
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

  private getObservationWindowSize(): number {
    return this.positiveNumber(
      this.configService.get<number>('ai.background.observationWindowSize'),
      10,
    );
  }

  private getObservationMaxWindowSize(): number {
    return this.positiveNumber(
      this.configService.get<number>('ai.background.observationMaxWindowSize'),
      12,
    );
  }

  private getObservationIdleFlushMs(): number {
    return this.positiveNumber(
      this.configService.get<number>('ai.background.observationIdleFlushMs'),
      900_000,
    );
  }

  private getRunningJobTimeoutMs(): number {
    return this.positiveNumber(
      this.configService.get<number>('ai.background.runningJobTimeoutMs'),
      600_000,
    );
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

  private buildPromptCacheKey(
    userId: string,
    conversationId: string | null,
    scope: string,
  ): string | undefined {
    if (!this.isPromptCacheKeyEnabled()) {
      return undefined;
    }
    const digest = createHash('sha256')
      .update(`${scope}:${userId}:${conversationId ?? 'all'}`)
      .digest('hex')
      .slice(0, 32);
    const compactScope = scope.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase();
    return `egmt:${compactScope}:${digest}`;
  }

  private positiveNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
