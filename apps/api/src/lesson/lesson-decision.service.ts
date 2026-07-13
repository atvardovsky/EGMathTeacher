import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { AiModelService } from '../ai-model/ai-model.service';
import type { AiUsageContext, ResolvedAiOperationPolicy } from '../ai-model/ai-model.types';
import { DatabaseService } from '../database/database.service';
import type { LessonType } from '../tutor/tutor.types';
import { LessonPolicyService } from './lesson-policy.service';
import {
  LessonDecision,
  LessonDecisionAction,
  LessonDecisionActionName,
  LessonDecisionConfidence,
  LessonDecisionPolicyResult,
  LessonDecisionResult,
  LessonEvidenceLevel,
  LessonVerifierEvidence,
  LessonVerifierResult,
  LessonLifecycleDto,
  CurriculumContext,
} from './lesson.types';

interface DecideInput {
  userId: string;
  userName: string;
  conversationId: string;
  lessonType: LessonType;
  lifecycle: LessonLifecycleDto;
  studentMessage: string;
  source: 'text' | 'voice';
  studentProfileContext?: string;
  topicHint?: string;
  curriculum?: CurriculumContext;
  verifierEvidence?: LessonVerifierEvidence;
  usageContext?: AiUsageContext;
}

interface RecentTutorTurn {
  prompt: string;
  answer_json: string;
  lesson_type: LessonType;
  created_at: string;
}

const ALLOWED_ACTIONS: LessonDecisionActionName[] = [
  'continue_lesson',
  'explain_concept',
  'give_example',
  'give_task',
  'request_student_attempt',
  'request_student_explanation',
  'check_student_answer',
  'give_hint',
  'change_explanation_strategy',
  'suggest_visual_support',
  'propose_goal_completion',
  'mark_goal_blocked',
  'suggest_break',
  'finish_lesson',
  'record_learning_observation',
  'propose_profile_delta',
];

const EVIDENCE_LEVELS: LessonEvidenceLevel[] = [
  'none',
  'self_reported',
  'agent_interpreted',
  'attempt_submitted',
  'deterministically_verified',
  'repeated_independent_success',
];

const CONFIDENCE_LEVELS: LessonDecisionConfidence[] = ['low', 'medium', 'high', 'unknown'];

const VERIFIER_RESULTS: LessonVerifierResult[] = [
  'none',
  'correct',
  'incorrect',
  'equivalent',
  'partially_correct',
  'invalid_format',
  'cannot_verify',
];

@Injectable()
export class LessonDecisionService {
  constructor(
    private readonly db: DatabaseService,
    private readonly aiModel: AiModelService,
    private readonly policyService: LessonPolicyService,
    @Optional()
    private readonly configService?: ConfigService,
  ) {}

  async decide(input: DecideInput): Promise<LessonDecisionResult> {
    const policy = this.aiModel.resolveOperationPolicy('lessonDecision');
    const startedAt = Date.now();
    let decision: LessonDecision;

    if (!this.decisionEnabled) {
      decision = this.buildFallbackDecision('Decision agent disabled by configuration.');
    } else {
      try {
        const response = await this.withTimeout(
          this.aiModel.createOperationResponse('lessonDecision', this.buildDecisionRequest(input)),
        );
        decision = this.parseDecision(this.extractOutputText(response));
      } catch {
        decision = this.buildFallbackDecision();
      }
    }
    decision = this.applyBackendVerifierEvidence(decision, input.verifierEvidence);

    const policyResult = this.policyService.evaluateDecision({
      lessonType: input.lessonType,
      lifecycle: input.lifecycle,
      decision,
      verifierEvidence: input.verifierEvidence,
    });
    const profileDeltaRouted = this.routeProfileDeltaObservations(input, decision, policyResult);
    const latencyMs = Date.now() - startedAt;
    this.persistDecision(
      input,
      decision,
      policyResult,
      policy,
      latencyMs,
      profileDeltaRouted,
    );
    return {
      decision,
      policy: policyResult,
      debug: this.buildDebug(decision, policyResult, latencyMs),
    };
  }

  private buildDecisionRequest(input: DecideInput): Record<string, unknown> {
    return {
      instructions: [
        'Ты Lesson Decision Agent для AI-репетитора по математике ЕГЭ.',
        'Ты не пишешь финальный ответ ученику. Ты выбираешь разрешенные педагогические действия.',
        'Не меняй состояние урока напрямую. Backend policy примет или отклонит durable state changes.',
        'Фразы вроде "я понял", "спасибо", "получилось" являются self_reported evidence, а не доказанным освоением.',
        'Если не хватает evidence, выбирай request_student_attempt или request_student_explanation.',
        'Не предлагай propose_profile_delta для чувствительных, клинических, семейных, религиозных, политических или неучебных данных.',
        'Верни только валидный JSON без Markdown.',
        'Формат JSON: {"actions":[{"name":"request_student_attempt","arguments":{},"reason":"...","expectedEvidence":"attempt_submitted","confidence":"medium"}],"evidenceLevel":"self_reported|agent_interpreted|attempt_submitted|deterministically_verified|repeated_independent_success|none","confidence":"low|medium|high|unknown","reason":"...","verifierResult":"none|cannot_verify|correct|incorrect|equivalent|partially_correct|invalid_format"}',
      ].join(' '),
      usageContext: input.usageContext,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                `Имя ученика: ${input.userName}`,
                `Источник: ${input.source}`,
                `lessonType: ${input.lessonType}`,
                `topicHint: ${input.topicHint ?? 'unknown'}`,
                `curriculum: ${JSON.stringify(input.curriculum ?? {})}`,
                `backendVerifierEvidence: ${JSON.stringify(this.publicVerifierEvidence(input.verifierEvidence))}`,
                `Цель: ${input.lifecycle.lessonGoal}`,
                `Критерии успеха: ${input.lifecycle.successCriteria.join('; ')}`,
                `Статус цели: ${input.lifecycle.goalStatus}`,
                `Evidence статуса цели: ${input.lifecycle.goalStatusEvidence}`,
                `Уровень evidence: ${input.lifecycle.goalEvidenceLevel}`,
                `Ход урока: ${input.lifecycle.turnCount}`,
                `Лимиты: day=${input.lifecycle.dailyLimit.status}, continuous=${input.lifecycle.continuousLimit.status}`,
                `Сигнал стратегии: ${input.lifecycle.strategySignal.direction}; ${input.lifecycle.strategySignal.summary}; ${input.lifecycle.strategySignal.recommendedAdjustment}`,
                `Доступные действия: ${ALLOWED_ACTIONS.join(', ')}`,
                `Профиль: ${this.sanitizeTeachingText(input.studentProfileContext ?? 'нет сохраненного профиля', 1_200)}`,
                `Недавняя история: ${JSON.stringify(this.getRecentTurns(input))}`,
                `Сообщение ученика: ${this.sanitizeTeachingText(input.studentMessage, 1_500)}`,
              ].join('\n'),
            },
          ],
        },
      ],
    };
  }

  private parseDecision(text: string): LessonDecision {
    const parsed = this.parseJsonObject(text);
    if (!parsed) {
      return this.buildFallbackDecision();
    }
    const actions = this.normalizeActions(parsed.actions);
    return {
      id: randomUUID(),
      actions: actions.length > 0 ? actions : this.buildFallbackDecision().actions,
      evidenceLevel: this.normalizeEvidenceLevel(parsed.evidenceLevel ?? parsed.evidence_level),
      confidence: this.normalizeConfidence(parsed.confidence),
      reason: this.pickString(parsed, ['reason']) ?? 'Decision agent did not provide a reason.',
      verifierResult: this.normalizeVerifierResult(
        this.pickString(parsed, ['verifierResult', 'verifier_result']),
      ),
    };
  }

  private normalizeActions(value: unknown): LessonDecisionAction[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((item): LessonDecisionAction | undefined => {
        if (!item || typeof item !== 'object') {
          return undefined;
        }
        const record = item as Record<string, unknown>;
        const name = this.normalizeActionName(record.name);
        if (!name) {
          return undefined;
        }
        return {
          name,
          arguments: this.sanitizeActionArguments(name, this.pickObject(record.arguments)),
          reason: this.sanitizeTeachingText(this.pickString(record, ['reason']), 300),
          expectedEvidence: this.normalizeEvidenceLevel(
            record.expectedEvidence ?? record.expected_evidence,
          ),
          confidence: this.normalizeConfidence(record.confidence),
        };
      })
      .filter((action): action is LessonDecisionAction => Boolean(action));
  }

  private buildFallbackDecision(reason = 'Decision agent failed or returned invalid JSON; using local safe fallback.'): LessonDecision {
    return {
      id: randomUUID(),
      actions: [
        {
          name: 'continue_lesson',
          reason: 'Decision agent fallback kept the lesson in progress.',
          expectedEvidence: 'agent_interpreted',
          confidence: 'low',
        },
        {
          name: 'request_student_attempt',
          reason: 'Fallback cannot verify mastery, so it asks for a concrete attempt.',
          expectedEvidence: 'attempt_submitted',
          confidence: 'low',
        },
      ],
      evidenceLevel: 'agent_interpreted',
      confidence: 'low',
      reason,
      fallback: true,
      verifierResult: 'cannot_verify',
    };
  }

  private applyBackendVerifierEvidence(
    decision: LessonDecision,
    verifierEvidence: LessonVerifierEvidence | undefined,
  ): LessonDecision {
    if (!verifierEvidence?.attemptSubmitted) {
      return decision;
    }
    const result = verifierEvidence.result;
    if (verifierEvidence.masteryUpdateAllowed) {
      const actions = [...decision.actions];
      if (!actions.some((action) => action.name === 'propose_goal_completion')) {
        actions.push({
          name: 'propose_goal_completion',
          arguments: {
            verificationSource: 'backend_verifier',
            taskId: verifierEvidence.taskId,
            sourceTaskId: verifierEvidence.sourceTaskId,
            attemptId: verifierEvidence.attemptId,
          },
          reason: 'Backend verifier accepted the current independent attempt.',
          expectedEvidence: verifierEvidence.masteryEvidenceLevel ?? 'deterministically_verified',
          confidence: 'high',
        });
      }
      return {
        ...decision,
        actions,
        evidenceLevel: this.strongerEvidence(
          decision.evidenceLevel,
          verifierEvidence.masteryEvidenceLevel ?? 'deterministically_verified',
        ),
        confidence: decision.confidence === 'low' ? 'medium' : decision.confidence,
        verifierResult: result,
      };
    }

    return {
      ...decision,
      evidenceLevel: this.strongerEvidence(decision.evidenceLevel, 'attempt_submitted'),
      verifierResult: result,
      actions: decision.actions.some((action) => action.name === 'check_student_answer')
        ? decision.actions
        : [
            ...decision.actions,
            {
              name: 'check_student_answer',
              arguments: {
                verificationSource: 'backend_verifier',
                taskId: verifierEvidence.taskId,
                sourceTaskId: verifierEvidence.sourceTaskId,
                attemptId: verifierEvidence.attemptId,
              },
              reason: 'Backend verifier has evidence for the submitted attempt.',
              expectedEvidence: 'attempt_submitted',
              confidence: verifierEvidence.confidence,
            },
          ],
    };
  }

  private persistDecision(
    input: DecideInput,
    decision: LessonDecision,
    policyResult: LessonDecisionPolicyResult,
    modelPolicy: ResolvedAiOperationPolicy,
    latencyMs: number,
    profileDeltaRouted: boolean,
  ): void {
    const now = new Date().toISOString();
    const results =
      policyResult.actionResults.length > 0
        ? policyResult.actionResults
        : [
            {
              toolName: 'continue_lesson' as const,
              accepted: true,
              reason: 'No explicit action result was produced.',
              evidenceLevel: decision.evidenceLevel,
            },
          ];

    for (const result of results) {
      this.db.run(
        `INSERT INTO lesson_decisions (
           id, user_id, lesson_session_id, conversation_id, lesson_type,
           operation_key, operation, assistant_role, provider, model,
           tool_name, decision_json, policy_result_json, accepted,
           rejection_reason, evidence_level, verifier_result, latency_ms,
           retry_count, lesson_outcome, created_at, usage_correlation_id,
           fallback_used, profile_delta_routed
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          input.userId,
          input.lifecycle.lessonSessionId,
          input.conversationId,
          input.lessonType,
          modelPolicy.operationKey,
          modelPolicy.operation,
          modelPolicy.role,
          modelPolicy.provider,
          modelPolicy.model,
          result.toolName,
          JSON.stringify(this.sanitizeDecisionForStorage(decision)),
          JSON.stringify(this.sanitizePolicyResultForStorage(result)),
          result.accepted ? 1 : 0,
          result.accepted ? null : result.reason,
          result.evidenceLevel,
          policyResult.verifierResult ?? null,
          latencyMs,
          decision.fallback ? 1 : 0,
          policyResult.goalCompletion.accepted
            ? 'goal_completion_accepted'
            : policyResult.goalCompletion.proposed
              ? 'goal_completion_rejected'
              : 'in_progress',
          now,
          input.usageContext?.correlationId ?? null,
          decision.fallback ? 1 : 0,
          profileDeltaRouted ? 1 : 0,
        ],
      );
    }
  }

  private getRecentTurns(input: DecideInput): Array<Record<string, unknown>> {
    return this.db
      .all<RecentTutorTurn>(
        `SELECT prompt, answer_json, lesson_type, created_at
         FROM tutor_turns
         WHERE user_id = ?
           AND conversation_id = ?
         ORDER BY created_at DESC
         LIMIT 4`,
        [input.userId, input.conversationId],
      )
      .map((turn) => {
        const answer = this.parseJsonObject(turn.answer_json) ?? {};
        return {
          lessonType: turn.lesson_type,
          prompt: this.sanitizeTeachingText(turn.prompt, 500) ?? '',
          answer: this.sanitizeTeachingText(this.pickString(answer, ['answer']), 700) ?? '',
          goalStatus: this.pickObject(answer.lessonLifecycle)?.goalStatus,
          createdAt: turn.created_at,
        };
      });
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
      for (const block of content) {
        const text = this.pickString(block, ['text']);
        if (text) {
          chunks.push(text);
        }
      }
    }
    return chunks.join('\n');
  }

  private parseJsonObject(text: unknown): Record<string, unknown> | undefined {
    if (typeof text !== 'string') {
      return undefined;
    }
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  }

  private normalizeActionName(value: unknown): LessonDecisionActionName | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const normalized = value.trim();
    return ALLOWED_ACTIONS.includes(normalized as LessonDecisionActionName)
      ? (normalized as LessonDecisionActionName)
      : undefined;
  }

  private normalizeEvidenceLevel(value: unknown): LessonEvidenceLevel {
    if (typeof value !== 'string') {
      return 'agent_interpreted';
    }
    return EVIDENCE_LEVELS.includes(value as LessonEvidenceLevel)
      ? (value as LessonEvidenceLevel)
      : 'agent_interpreted';
  }

  private normalizeVerifierResult(value: unknown): LessonVerifierResult {
    if (typeof value !== 'string') {
      return 'cannot_verify';
    }
    return VERIFIER_RESULTS.includes(value as LessonVerifierResult)
      ? (value as LessonVerifierResult)
      : 'cannot_verify';
  }

  private normalizeConfidence(value: unknown): LessonDecisionConfidence {
    if (typeof value !== 'string') {
      return 'unknown';
    }
    return CONFIDENCE_LEVELS.includes(value as LessonDecisionConfidence)
      ? (value as LessonDecisionConfidence)
      : 'unknown';
  }

  private pickString(source: unknown, keys: string[]): string | undefined {
    if (!source || typeof source !== 'object') {
      return undefined;
    }
    const record = source as Record<string, unknown>;
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return undefined;
  }

  private pickObject(source: unknown): Record<string, unknown> | undefined {
    return source && typeof source === 'object' && !Array.isArray(source)
      ? (source as Record<string, unknown>)
      : undefined;
  }

  private sanitizeActionArguments(
    name: LessonDecisionActionName,
    args: Record<string, unknown> | undefined,
  ): Record<string, unknown> | undefined {
    if (!args) {
      return undefined;
    }
    const allowedKeys: Partial<Record<LessonDecisionActionName, string[]>> = {
      request_student_attempt: ['skill_id', 'skillId', 'task_id', 'taskId', 'reason'],
      request_student_explanation: ['skill_id', 'skillId', 'reason'],
      check_student_answer: ['verificationSource', 'taskId', 'attemptId'],
      give_hint: ['hintLevel', 'taskId', 'skillId'],
      change_explanation_strategy: ['from', 'to', 'reason'],
      suggest_visual_support: ['reason', 'visualType'],
      propose_goal_completion: ['verificationSource', 'taskId', 'attemptId', 'evidenceId'],
      mark_goal_blocked: ['reason', 'nextStep'],
      suggest_break: ['reason'],
      record_learning_observation: ['category', 'value', 'confidence', 'scope'],
      propose_profile_delta: ['field', 'value', 'confidence', 'scope', 'evidence'],
    };
    const keys = allowedKeys[name] ?? [];
    const sanitized: Record<string, unknown> = {};
    for (const key of keys) {
      const value = args[key];
      if (typeof value === 'string') {
        const safe = this.sanitizeTeachingText(value, 300);
        if (safe) {
          sanitized[key] = safe;
        }
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (Array.isArray(value)) {
        sanitized[key] = value
          .filter((item): item is string => typeof item === 'string')
          .map((item) => this.sanitizeTeachingText(item, 180))
          .filter((item): item is string => Boolean(item))
          .slice(0, 5);
      }
    }
    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }

  private sanitizeDecisionForStorage(decision: LessonDecision): LessonDecision {
    return {
      ...decision,
      actions: decision.actions.map((action) => ({
        ...action,
        arguments: this.sanitizeActionArguments(action.name, action.arguments),
        reason: this.sanitizeTeachingText(action.reason, 300),
      })),
      reason: this.sanitizeTeachingText(decision.reason, 500) ?? '',
    };
  }

  private sanitizePolicyResultForStorage(
    result: LessonDecisionPolicyResult['actionResults'][number],
  ): LessonDecisionPolicyResult['actionResults'][number] {
    return {
      ...result,
      reason: this.sanitizeTeachingText(result.reason, 400) ?? '',
    };
  }

  private sanitizeTeachingText(value: string | undefined, maxLength: number): string | undefined {
    if (!value?.trim()) {
      return undefined;
    }
    const withoutSensitiveLabels = value
      .replace(/diagnos(?:is|e|ed)?[:\s][^\n.;]*/gi, '[redacted]')
      .replace(/диагноз[:\s][^\n.;]*/gi, '[redacted]')
      .replace(/адрес[:\s][^\n.;]*/gi, '[redacted]')
      .replace(/телефон[:\s][^\n.;]*/gi, '[redacted]')
      .replace(/religion[:\s][^\n.;]*/gi, '[redacted]')
      .replace(/политическ[^\n.;]*/gi, '[redacted]');
    return withoutSensitiveLabels.trim().slice(0, maxLength);
  }

  private routeProfileDeltaObservations(
    input: DecideInput,
    decision: LessonDecision,
    policyResult: LessonDecisionPolicyResult,
  ): boolean {
    const profileDeltaActions = decision.actions.filter(
      (action) => action.name === 'propose_profile_delta',
    );
    if (profileDeltaActions.length === 0) {
      return false;
    }
    const rejectedForBackground = policyResult.rejectedActions.some(
      (result) =>
        result.toolName === 'propose_profile_delta' &&
        result.requiredAction === 'record_learning_observation',
    );
    if (!rejectedForBackground) {
      return false;
    }
    const now = new Date().toISOString();
    for (const action of profileDeltaActions) {
      this.db.run(
        `INSERT INTO background_learning_observations (
           id, user_id, conversation_id, source, lesson_type,
           observation_json, status, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [
          randomUUID(),
          input.userId,
          input.conversationId,
          input.source,
          input.lessonType,
          JSON.stringify({
            category: 'profile_delta_candidate',
            value: this.sanitizeActionArguments(action.name, action.arguments),
            confidence: action.confidence ?? decision.confidence,
            evidence: this.sanitizeTeachingText(action.reason, 300),
            scope: input.curriculum?.skillId ?? input.lessonType,
            source: 'lesson_decision_agent',
          }),
          now,
          now,
        ],
      );
    }
    return true;
  }

  private buildDebug(
    decision: LessonDecision,
    policyResult: LessonDecisionPolicyResult,
    latencyMs: number,
  ): LessonDecisionResult['debug'] {
    return {
      decisionId: decision.id,
      acceptedActions: policyResult.acceptedActions,
      rejectedActions: policyResult.rejectedActions,
      evidenceLevel: policyResult.evidenceLevel,
      verifierResult: policyResult.verifierResult ?? 'none',
      recommendedNextAction: policyResult.recommendedNextAction,
      goalCompletionAccepted: policyResult.goalCompletion.accepted,
      goalCompletionReason: policyResult.goalCompletion.reason,
      latencyMs,
      fallbackUsed: Boolean(decision.fallback),
    };
  }

  private publicVerifierEvidence(
    evidence: LessonVerifierEvidence | undefined,
  ): Record<string, unknown> {
    if (!evidence?.attemptSubmitted) {
      return { attemptSubmitted: false, result: 'none' };
    }
    return {
      attemptSubmitted: true,
      taskId: evidence.taskId,
      attemptId: evidence.attemptId,
      sourceTaskId: evidence.sourceTaskId,
      result: evidence.result,
      confidence: evidence.confidence,
      masteryUpdateAllowed: evidence.masteryUpdateAllowed,
      masteryPolicyReason: evidence.masteryPolicyReason,
      masteryEvidenceLevel: evidence.masteryEvidenceLevel,
      currentLessonVerifiedSuccessCount: evidence.currentLessonVerifiedSuccessCount,
      currentLessonIndependentSuccessCount: evidence.currentLessonIndependentSuccessCount,
      cumulativeVerifiedSuccessCount: evidence.cumulativeVerifiedSuccessCount,
      cumulativeIndependentSuccessCount: evidence.cumulativeIndependentSuccessCount,
      verifiedSuccessCount: evidence.verifiedSuccessCount,
      independentSuccessCount: evidence.independentSuccessCount,
      requiredSuccessCount: evidence.requiredSuccessCount,
      nextHint: evidence.nextHint,
      nextHintRoute: evidence.nextHintRoute,
      misconceptionId: evidence.misconceptionId,
      hintLadder: evidence.hintLadder,
      commonErrors: evidence.commonErrors,
      topicId: evidence.topicId,
      skillId: evidence.skillId,
      taskTypeId: evidence.taskTypeId,
    };
  }

  private strongerEvidence(
    current: LessonEvidenceLevel,
    candidate: LessonEvidenceLevel,
  ): LessonEvidenceLevel {
    return EVIDENCE_LEVELS.indexOf(candidate) > EVIDENCE_LEVELS.indexOf(current)
      ? candidate
      : current;
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    const timeoutMs = this.decisionTimeoutMs;
    if (timeoutMs <= 0) {
      return promise;
    }
    let timeout: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<T>((_resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('Lesson decision timed out')), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
      if (timeout) {
        clearTimeout(timeout);
      }
    });
  }

  private get decisionEnabled(): boolean {
    return this.configService?.get<boolean>('ai.lessonDecision.enabled') ?? true;
  }

  private get decisionTimeoutMs(): number {
    const value = this.configService?.get<number>('ai.lessonDecision.timeoutMs');
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 4_000;
  }
}
