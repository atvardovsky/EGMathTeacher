import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { AiModelService } from '../ai-model/ai-model.service';
import { AiOperationKey } from '../ai-model/ai-model.types';
import { AuthSession } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import {
  DiagnosticAnswer,
  StudentOnboardingAnswers,
  StudentMeetingReadiness,
  StudentMeetingSignal,
  StudentProfileDto,
  StudentProfileConversationContext,
  StudentProfileRecord,
  StudentProfileRequestContext,
  StudentProfileStatus,
  StudentSessionSummaryDto,
  StudentSkillProgressDto,
} from './student-profile.types';

interface GeneratedProfile {
  knowledgeState: Record<string, unknown>;
  learningPreferences: Record<string, unknown>;
  psychologicalProfile: Record<string, unknown>;
  explanationStrategy: Record<string, unknown>;
  aiSummary: string;
}

interface ProfileSpecialistRequest {
  operation: AiOperationKey;
  specialist: string;
  userId: string;
  conversationId?: string;
  lessonSessionId?: string;
  heartbeat?: () => void;
  instructions: string;
  inputText: string;
  vectorStoreIds: string[];
  useRag: boolean;
  failureMessage: string;
}

interface OnboardingConversationTurn {
  id: string;
  prompt: string;
  answer_json: string;
  lesson_type: string;
  created_at: string;
}

interface ProfileCreationRunRecord {
  id: string;
  user_id: string;
  conversation_id: string;
  transcript_hash: string;
  status: 'running' | 'completed' | 'failed';
  attempts: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ProfileCreationClaim {
  runId: string;
  status: 'claimed' | 'completed';
  transcriptHash: string;
  claimedStartedAt?: string;
}

const REQUIRED_MEETING_SIGNALS: StudentMeetingSignal[] = [
  'preparation_goal',
  'self_assessment',
  'weak_topic',
  'explanation_preference',
  'diagnostic_or_contentful_reply',
];

@Injectable()
export class StudentProfileService {
  private readonly sensitiveProfileKeyPattern =
    /diagnos|clinical|medical|health|illness|family|parent|mother|father|address|phone|email|relig|politic|trauma|abuse|диагноз|клиник|медицин|здоров|болез|семь|родител|мам|пап|адрес|телефон|почт|религи|полит|травм|насили/i;

  private readonly sensitiveProfileValuePattern =
    /adhd|autism|bipolar|depression|self-harm|suicide|medical record|my mother|my father|my parents|family problem|сдвг|аутизм|биполяр|депресс|суицид|самоповреж|медицин|моя мама|мой папа|родители|проблемы в семье|насили/i;

  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
    private readonly knowledgeService: KnowledgeService,
    private readonly aiModel: AiModelService,
  ) {}

  getStatus(user: AuthSession): StudentProfileStatus {
    const profile = this.getProfile(user.id);
    return {
      onboardingRequired: user.role === 'student' && !profile,
      profile,
    };
  }

  getProfile(userId: string): StudentProfileDto | null {
    const record = this.db.get<StudentProfileRecord>(
      `SELECT user_id, onboarding_completed_at, onboarding_answers_json,
              knowledge_state_json, learning_preferences_json, psychological_profile_json,
              explanation_strategy_json, ai_summary, created_at, updated_at
       FROM student_profiles
       WHERE user_id = ?`,
      [userId],
    );
    return record ? this.toDto(record) : null;
  }

  getTutorContext(userId: string): string | undefined {
    const profile = this.getProfile(userId);
    if (!profile) {
      return undefined;
    }

    return [
      'Профиль ученика из базы данных. Он предварительно очищен до учебно полезных сигналов. Используй только для выбора стратегии объяснения, не называй это психологическим диагнозом.',
      `Краткое резюме: ${profile.aiSummary}`,
      `Состояние знаний: ${JSON.stringify(profile.knowledgeState)}`,
      `Предпочтения обучения: ${JSON.stringify(profile.learningPreferences)}`,
      `Психолого-педагогический профиль: ${JSON.stringify(profile.psychologicalProfile)}`,
      `Стратегия объяснения: ${JSON.stringify(profile.explanationStrategy)}`,
      profile.recentSessionSummaries.length > 0
        ? `Недавние сводки занятий: ${JSON.stringify(profile.recentSessionSummaries)}`
        : undefined,
      profile.skillProgress.length > 0
        ? `Прогресс и регресс по навыкам: ${JSON.stringify(profile.skillProgress)}`
        : undefined,
    ].filter(Boolean).join('\n');
  }

  getMeetingReadiness(
    user: AuthSession,
    conversationIdInput?: string,
  ): StudentMeetingReadiness {
    const conversationId =
      this.cleanString(conversationIdInput, 160) ??
      this.getLatestMeetingConversationId(user.id);
    if (!conversationId) {
      return this.emptyMeetingReadiness();
    }
    const turns = this.getMeetingConversationTurns(user.id, conversationId);
    return this.buildMeetingReadiness(user.id, conversationId, turns);
  }

  async completeOnboarding(
    context: StudentProfileRequestContext,
  ): Promise<StudentProfileStatus> {
    const answers = this.toTeachingOnlyAnswers(this.normalizeAnswers(context.answers));
    const profile = await this.generateProfile(context.user, answers, {
      conversationId: context.conversationId,
      lessonSessionId: context.lessonSessionId,
    });
    this.upsertStudentProfile(context.user.id, answers, profile, new Date().toISOString());
    return this.getStatus(context.user);
  }

  async completeOnboardingFromConversation(
    context: StudentProfileConversationContext,
  ): Promise<StudentProfileStatus> {
    const requestedConversationId = this.cleanString(context.conversationId, 160);
    const existingProfile = this.getProfile(context.user.id);
    if (existingProfile) {
      const reconcileConversationId =
        requestedConversationId ??
        this.getRunningProfileCreationConversationId(context.user.id);
      if (reconcileConversationId) {
        this.reconcileExistingConversationProfile(
          context.user.id,
          reconcileConversationId,
        );
      }
      return {
        onboardingRequired: false,
        profile: existingProfile,
      };
    }

    const conversationId =
      requestedConversationId ?? this.getLatestMeetingConversationId(context.user.id);
    if (!conversationId) {
      throw new BadRequestException('First meeting conversation is missing');
    }

    const turns = this.getMeetingConversationTurns(context.user.id, conversationId);
    const readiness = this.buildMeetingReadiness(context.user.id, conversationId, turns);
    if (!readiness.canCreateProfile) {
      throw new BadRequestException(
        `First meeting needs more teaching context: ${readiness.missingSignals.join(', ')}`,
      );
    }

    const transcriptHash = this.hashMeetingTranscript(turns);
    let claim = this.claimProfileCreationRun(
      context.user.id,
      conversationId,
      transcriptHash,
    );
    if (claim.status === 'completed') {
      const profile = this.getProfile(context.user.id);
      if (profile) {
        return {
          onboardingRequired: false,
          profile,
        };
      }
      this.markProfileCreationRunInconsistent(
        claim.runId,
        'Completed profile creation run has no stored student profile',
      );
      claim = this.claimProfileCreationRun(
        context.user.id,
        conversationId,
        transcriptHash,
      );
      if (claim.status === 'completed') {
        throw new BadRequestException('Stored profile creation state is inconsistent');
      }
    }

    try {
      const heartbeat = () =>
        this.heartbeatProfileCreationRun(claim.runId, claim.claimedStartedAt);
      heartbeat();
      const answers = await this.extractOnboardingAnswersFromConversation(
        context.user,
        conversationId,
        turns,
        readiness.lessonSessionId,
        heartbeat,
      );
      heartbeat();
      const profile = await this.generateProfile(context.user, answers, {
        conversationId,
        lessonSessionId: readiness.lessonSessionId,
        heartbeat,
      });
      return this.finalizeConversationOnboarding({
        user: context.user,
        answers,
        profile,
        conversationId,
        runId: claim.runId,
        claimedStartedAt: claim.claimedStartedAt,
      });
    } catch (error) {
      this.markProfileCreationRunFailed(
        claim.runId,
        error instanceof Error ? error.message : 'Profile creation failed',
        claim.claimedStartedAt,
      );
      throw error;
    }
  }

  private async generateProfile(
    user: AuthSession,
    answers: StudentOnboardingAnswers,
    usageContext: {
      conversationId?: string;
      lessonSessionId?: string;
      heartbeat?: () => void;
    } = {},
  ): Promise<GeneratedProfile> {
    const vectorStoreIds = this.knowledgeService.getActiveVectorStoreIds();

    usageContext.heartbeat?.();
    const knowledgeParsed = await this.runProfileSpecialist({
      operation: 'onboardingKnowledgeDiagnosis',
      specialist: 'math-knowledge-diagnostician',
      userId: user.id,
      conversationId: usageContext.conversationId,
      lessonSessionId: usageContext.lessonSessionId,
      heartbeat: usageContext.heartbeat,
      instructions: this.getKnowledgeDiagnosticInstructions(vectorStoreIds.length > 0),
      inputText: [
        `Имя ученика: ${user.name}`,
        'Ответы первой встречи:',
        JSON.stringify(answers, null, 2),
      ].join('\n'),
      vectorStoreIds,
      useRag: true,
      failureMessage: 'Could not create student knowledge state',
    });
    usageContext.heartbeat?.();
    const knowledgeState = this.sanitizeTeachingObject(
      this.pickObject(knowledgeParsed, ['knowledgeState', 'knowledge_state']),
    );
    if (Object.keys(knowledgeState).length === 0) {
      throw new BadRequestException('Student knowledge state is missing');
    }

    usageContext.heartbeat?.();
    const psychopedagogicalParsed = await this.runProfileSpecialist({
      operation: 'onboardingPsychopedagogicalProfile',
      specialist: 'psychopedagogical-profiler',
      userId: user.id,
      conversationId: usageContext.conversationId,
      lessonSessionId: usageContext.lessonSessionId,
      heartbeat: usageContext.heartbeat,
      instructions: this.getPsychopedagogicalInstructions(vectorStoreIds.length > 0),
      inputText: [
        `Имя ученика: ${user.name}`,
        'Ответы первой встречи:',
        JSON.stringify(answers, null, 2),
        'Состояние знаний от математического диагноста:',
        JSON.stringify(knowledgeState, null, 2),
      ].join('\n'),
      vectorStoreIds,
      useRag: true,
      failureMessage: 'Could not create student psychopedagogical profile',
    });
    usageContext.heartbeat?.();
    const learningPreferences = this.sanitizeTeachingObject(
      this.pickObject(psychopedagogicalParsed, ['learningPreferences', 'learning_preferences']),
    );
    const psychologicalProfile = this.sanitizeTeachingObject(
      this.pickObject(psychopedagogicalParsed, ['psychologicalProfile', 'psychological_profile']),
    );
    if (Object.keys(learningPreferences).length === 0 || Object.keys(psychologicalProfile).length === 0) {
      throw new BadRequestException('Student learning profile is missing');
    }

    usageContext.heartbeat?.();
    const strategyParsed = await this.runProfileSpecialist({
      operation: 'onboardingStrategyPlan',
      specialist: 'teaching-strategy-planner',
      userId: user.id,
      conversationId: usageContext.conversationId,
      lessonSessionId: usageContext.lessonSessionId,
      heartbeat: usageContext.heartbeat,
      instructions: this.getTeachingStrategyInstructions(vectorStoreIds.length > 0),
      inputText: [
        `Имя ученика: ${user.name}`,
        'Ответы первой встречи:',
        JSON.stringify(answers, null, 2),
        'Состояние знаний:',
        JSON.stringify(knowledgeState, null, 2),
        'Предпочтения обучения:',
        JSON.stringify(learningPreferences, null, 2),
        'Психолого-педагогический профиль:',
        JSON.stringify(psychologicalProfile, null, 2),
      ].join('\n'),
      vectorStoreIds,
      useRag: true,
      failureMessage: 'Could not create student explanation strategy',
    });
    usageContext.heartbeat?.();
    const explanationStrategy = this.sanitizeTeachingObject(
      this.pickObject(strategyParsed, ['explanationStrategy', 'explanation_strategy']),
    );
    const aiSummary = this.sanitizeTeachingString(
      this.pickString(strategyParsed, ['aiSummary', 'ai_summary', 'summary']),
      1_500,
    );
    if (!aiSummary) {
      throw new BadRequestException('Student profile summary is missing');
    }
    if (Object.keys(explanationStrategy).length === 0) {
      throw new BadRequestException('Student explanation strategy is missing');
    }

    return {
      knowledgeState,
      learningPreferences,
      psychologicalProfile,
      explanationStrategy,
      aiSummary,
    };
  }

  private async runProfileSpecialist(
    request: ProfileSpecialistRequest,
  ): Promise<Record<string, unknown>> {
    const response = await this.runWithProfileCreationHeartbeat(
      request.heartbeat,
      (abortSignal) =>
        this.aiModel.createOperationResponse(
          request.operation,
          this.withAbortSignal(this.buildProfileRequest(request), abortSignal),
        ),
    );
    const text = this.extractOutputText(response);
    const parsed = this.parseJsonObject(text);
    if (!parsed) {
      throw new BadRequestException(request.failureMessage);
    }
    return parsed;
  }

  private async extractOnboardingAnswersFromConversation(
    user: AuthSession,
    conversationId: string,
    turns: OnboardingConversationTurn[],
    lessonSessionId?: string,
    heartbeat?: () => void,
  ): Promise<StudentOnboardingAnswers> {
    const response = await this.runWithProfileCreationHeartbeat(
      heartbeat,
      (abortSignal) =>
        this.aiModel.createOperationResponse(
          'onboardingConversationExtraction',
          this.withAbortSignal({
            instructions: this.getConversationExtractionInstructions(),
            usageContext: {
              userId: user.id,
              conversationId,
              lessonSessionId,
              lessonType: 'meeting',
            },
            metadata: {
              profile_specialist: 'first-meeting-conversation-extractor',
            },
            input: [
              {
                role: 'user',
                content: [
                  {
                    type: 'input_text',
                    text: [
                      `Имя ученика: ${user.name}`,
                      `Conversation ID: ${conversationId}`,
                      'Сохраненный transcript первой встречи:',
                      this.formatMeetingTranscript(turns),
                    ].join('\n'),
                  },
                ],
              },
            ],
          }, abortSignal),
        ),
    );
    const parsed = this.parseJsonObject(this.extractOutputText(response));
    if (!parsed) {
      throw new BadRequestException('Could not extract first meeting answers');
    }
    const extracted = this.pickObject(parsed, [
      'answers',
      'onboardingAnswers',
      'studentOnboardingAnswers',
    ]);
    const rawAnswers =
      Object.keys(extracted).length > 0
        ? extracted
        : parsed;
    const answers = this.toTeachingOnlyAnswers(
      this.normalizeAnswers(rawAnswers as unknown as StudentOnboardingAnswers),
    );
    const missingSignals = this.getMissingOnboardingAnswerSignals(answers);
    if (missingSignals.length > 0) {
      throw new BadRequestException(
        `First meeting extracted profile is incomplete: ${missingSignals.join(', ')}`,
      );
    }
    return answers;
  }

  private buildProfileRequest(
    request: ProfileSpecialistRequest,
  ): Record<string, unknown> {
    const useFileSearch = request.useRag && request.vectorStoreIds.length > 0;
    const tools =
      useFileSearch
        ? [
            {
              type: 'file_search',
              vector_store_ids: request.vectorStoreIds,
              max_num_results: 6,
            },
          ]
        : undefined;

    return {
      instructions: request.instructions,
      usageContext: {
        userId: request.userId,
        conversationId: request.conversationId,
        lessonSessionId: request.lessonSessionId,
        lessonType: 'meeting',
      },
      metadata: {
        profile_specialist: request.specialist,
      },
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: request.inputText,
            },
          ],
        },
      ],
      tools,
      include: useFileSearch ? ['file_search_call.results'] : undefined,
    };
  }

  private withAbortSignal(
    payload: Record<string, unknown>,
    abortSignal?: AbortSignal,
  ): Record<string, unknown> {
    return abortSignal ? { ...payload, abortSignal } : payload;
  }

  private getConversationExtractionInstructions(): string {
    return [
      'Ты извлекаешь ответы первой встречи для AI-репетитора ЕГЭ по математике из естественного голосового/текстового диалога.',
      'Сохраняй только учебно полезные сведения: цель, класс, экзамен, стартовую самооценку, отношение к математике, сложные темы, предпочтительный темп, формат объяснений, подсказки, практику, визуальные опоры и диагностические ответы.',
      'Не выдумывай отсутствующие факты. Если сведений нет, используй пустые массивы или пропусти поле.',
      'Первый student prompt может быть технической командой приложения начать встречу. Не считай такую команду ответом ученика.',
      'Игнорируй и не повторяй чувствительные, медицинские, семейные, контактные, политические, религиозные и травматические сведения.',
      'Не ставь диагнозы и не присваивай тип личности. Формулируй только нейтральные учебные сигналы.',
      'Диагностические ответы добавляй только когда ученик реально отвечал на учебный вопрос или задачу.',
      'Верни только валидный JSON без Markdown и без текста вокруг.',
      'Формат JSON: {"answers":{"exam":"...","grade":"...","examYear":"...","targetScore":80,"currentLevel":"...","confidence":"...","mathFeeling":"...","motivation":"...","weakTopics":["..."],"explanationStyle":"...","pacing":"...","visualPreference":true,"hintPreference":"...","practicePreference":"...","feedbackStyle":"...","analogyInterests":["..."],"diagnosticAnswers":[{"prompt":"...","answer":"..."}],"freeform":"..."}}.',
    ].join(' ');
  }

  private getKnowledgeDiagnosticInstructions(hasRag: boolean): string {
    return [
      'Ты математический диагност для AI-репетитора ЕГЭ по математике. Оцени только учебное состояние ученика 14-16 лет.',
      'Используй только очищенные ответы первой встречи, слабые темы и короткие диагностические ответы. Не оценивай личность ученика.',
      'Если во входе остались личные, семейные, медицинские или иные чувствительные сведения, игнорируй их и не повторяй в JSON.',
      hasRag
        ? 'Используй file_search только для общих рубрик ЕГЭ, типичных ошибок, task bank и диагностических критериев. Индивидуальные ответы ученика не являются RAG-знанием.'
        : 'Если материалы в RAG не загружены, опирайся на ответы ученика и общие безопасные учебные критерии.',
      'Верни только валидный JSON без Markdown и без текста вокруг.',
      'Формат JSON: {"knowledgeState":{"overallLevel":{"value":"...","confidence":"low|medium|high","evidence":["..."]},"topicSignals":[{"topic":"...","status":"strong|unstable|gap","confidence":"low|medium|high","evidence":["..."]}],"misconceptions":[...],"priorityTopics":[...],"nextDiagnosticQuestions":[...]}}.',
      'Каждый существенный вывод должен иметь confidence и короткие evidence из ответов ученика или диагностических решений.',
    ].join(' ');
  }

  private getPsychopedagogicalInstructions(hasRag: boolean): string {
    return [
      'Ты психолого-педагогический профайлер для AI-репетитора по математике ЕГЭ. Это не медицинская и не клиническая оценка.',
      'Цель: выделить только учебно полезные сигналы для объяснений, темпа, обратной связи, подсказок и мотивации.',
      'Не ставь психологические или медицинские диагнозы. Не сохраняй семейные, медицинские, травматические, интимные, политические, религиозные или иные чувствительные личные факты.',
      'Если ученик написал чувствительные подробности, не пересказывай их. Замени вывод на безопасный учебный сигнал, например темп, формат подсказки или стиль обратной связи.',
      'Запрещено манипулировать учеником, стыдить, давить или делать выводы о личности вне учебного контекста.',
      hasRag
        ? 'Используй file_search только как общую педагогическую базу: стратегии анкеты, безопасная обратная связь, объяснительные методики и возрастная коммуникация.'
        : 'Если педагогические материалы в RAG не загружены, опирайся на ответы ученика и безопасные педагогические принципы.',
      'Верни только валидный JSON без Markdown и без текста вокруг.',
      'Формат JSON: {"learningPreferences":{...},"psychologicalProfile":{"confidenceWithMath":{"value":"...","confidence":"low|medium|high","evidence":["..."]},"mathEmotion":{...},"motivationType":{...},"autonomyPreference":{...},"feedbackStyle":{...},"focusPattern":{...},"mistakeReaction":{...},"tutorTone":{...}}}.',
      'Каждый вывод psychologicalProfile должен быть нейтральным, проверяемым и сформулированным как гипотеза для обучения, не как диагноз.',
    ].join(' ');
  }

  private getTeachingStrategyInstructions(hasRag: boolean): string {
    return [
      'Ты методист AI-репетитора по математике ЕГЭ. Собери итоговую стратегию обучения из ответов ученика, математической диагностики и психолого-педагогического профиля.',
      'Стратегия должна быть практичной: как объяснять, как давать подсказки, когда проверять понимание, какие примеры выбирать, когда использовать визуализацию.',
      'Не добавляй диагнозы, чувствительные личные сведения или непроверенные психологические утверждения. Не пересказывай сырой текст ученика.',
      hasRag
        ? 'Используй file_search только для общих методик объяснения, ЕГЭ-рубрик, task strategy и безопасных учебных практик.'
        : 'Если методические материалы в RAG не загружены, опирайся на безопасные педагогические принципы.',
      'Верни только валидный JSON без Markdown и без текста вокруг.',
      'Формат JSON: {"explanationStrategy":{"pacing":"...","structure":"...","visualSupport":"...","hintPolicy":"...","answerLength":"...","checkpointFrequency":"...","practiceMode":"...","analogyPolicy":"...","avoid":[...],"profileUpdateSignals":[...]},"aiSummary":"короткое русское резюме для будущего prompt"}.',
    ].join(' ');
  }

  private getLatestMeetingConversationId(userId: string): string | undefined {
    const activeSession = this.db.get<{ conversation_id: string }>(
      `SELECT session.conversation_id
       FROM lesson_sessions AS session
       WHERE session.user_id = ?
         AND session.lesson_type = 'meeting'
         AND session.status NOT IN ('hard_limit_reached', 'goal_reached', 'finished')
         AND EXISTS (
           SELECT 1
           FROM tutor_turns AS turn
           WHERE turn.user_id = session.user_id
             AND turn.conversation_id = session.conversation_id
             AND turn.lesson_type = 'meeting'
         )
       ORDER BY session.updated_at DESC
       LIMIT 1`,
      [userId],
    );
    if (activeSession?.conversation_id) {
      return activeSession.conversation_id;
    }

    const session = this.db.get<{ conversation_id: string }>(
      `SELECT session.conversation_id
       FROM lesson_sessions AS session
       WHERE session.user_id = ?
         AND session.lesson_type = 'meeting'
         AND EXISTS (
           SELECT 1
           FROM tutor_turns AS turn
           WHERE turn.user_id = session.user_id
             AND turn.conversation_id = session.conversation_id
             AND turn.lesson_type = 'meeting'
         )
       ORDER BY session.updated_at DESC
       LIMIT 1`,
      [userId],
    );
    if (session?.conversation_id) {
      return session.conversation_id;
    }

    return this.db.get<{ conversation_id: string }>(
      `SELECT conversation_id
       FROM tutor_turns
       WHERE user_id = ?
         AND lesson_type = 'meeting'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId],
    )?.conversation_id;
  }

  private finishMeetingLessonAfterProfileCreationAt(
    userId: string,
    conversationId: string,
    now: string,
  ): void {
    this.db.run(
      `UPDATE lesson_sessions
       SET status = 'finished',
           goal_status = 'reached',
           finish_reason = ?,
           finished_at = ?,
           updated_at = ?
       WHERE user_id = ?
         AND conversation_id = ?
         AND lesson_type = 'meeting'
         AND status NOT IN ('hard_limit_reached', 'goal_reached', 'finished')`,
      ['profile_created_from_meeting', now, now, userId, conversationId],
    );
  }

  private getMeetingConversationTurns(
    userId: string,
    conversationId: string,
  ): OnboardingConversationTurn[] {
    return this.db.all<OnboardingConversationTurn>(
      `SELECT id, prompt, answer_json, lesson_type, created_at
       FROM tutor_turns
       WHERE user_id = ?
         AND conversation_id = ?
         AND lesson_type = 'meeting'
       ORDER BY created_at ASC
       LIMIT 16`,
      [userId, conversationId],
    );
  }

  private formatMeetingTranscript(turns: OnboardingConversationTurn[]): string {
    return turns
      .map((turn, index) => {
        const answer = this.parseJsonObject(turn.answer_json) ?? {};
        return [
          `Turn ${index + 1} (${turn.created_at})`,
          `Student: ${this.sanitizeTeachingString(turn.prompt, 1_200) ?? ''}`,
          `Tutor: ${this.extractAnswerText(answer)}`,
        ].join('\n');
      })
      .join('\n\n');
  }

  private hashMeetingTranscript(turns: OnboardingConversationTurn[]): string {
    const stableTurns = turns.map((turn) => ({
      id: turn.id,
      prompt: turn.prompt,
      answer_json: turn.answer_json,
      lesson_type: turn.lesson_type,
      created_at: turn.created_at,
    }));
    return createHash('sha256')
      .update(JSON.stringify(stableTurns))
      .digest('hex');
  }

  private claimProfileCreationRun(
    userId: string,
    conversationId: string,
    transcriptHash: string,
  ): ProfileCreationClaim {
    return this.db.transaction(() =>
      this.claimProfileCreationRunLocked(userId, conversationId, transcriptHash),
    );
  }

  private claimProfileCreationRunLocked(
    userId: string,
    conversationId: string,
    transcriptHash: string,
  ): ProfileCreationClaim {
    const now = new Date().toISOString();
    const active = this.getActiveProfileCreationRunForConversation(
      userId,
      conversationId,
    );
    if (active) {
      if (active.transcript_hash !== transcriptHash) {
        if (!this.isProfileCreationRunStale(active, now)) {
          throw new ConflictException('Profile creation is already in progress');
        }
        this.markProfileCreationRunSuperseded(
          active,
          now,
          'Stale profile creation run superseded by newer meeting transcript',
        );
      } else if (this.isProfileCreationRunStale(active, now)) {
        return this.reclaimProfileCreationRun(active, now, 'running');
      } else {
        throw new ConflictException('Profile creation is already in progress');
      }
    }

    const existing = this.getProfileCreationRunByTranscript(
      userId,
      conversationId,
      transcriptHash,
    );
    if (existing) {
      if (existing.status === 'completed') {
        return {
          runId: existing.id,
          status: 'completed',
          transcriptHash,
        };
      }
      if (existing.status === 'running') {
        if (this.isProfileCreationRunStale(existing, now)) {
          return this.reclaimProfileCreationRun(existing, now, 'running');
        }
        throw new ConflictException('Profile creation is already in progress');
      }

      return this.reclaimProfileCreationRun(existing, now, 'failed');
    }

    const runId = randomUUID();
    const inserted = this.db.run(
      `INSERT OR IGNORE INTO student_profile_creation_runs (
         id, user_id, conversation_id, transcript_hash, status, attempts,
         error_message, started_at, completed_at, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, 'running', 1, NULL, ?, NULL, ?, ?)`,
      [runId, userId, conversationId, transcriptHash, now, now, now],
    );
    if (inserted.changes > 0) {
      return {
        runId,
        status: 'claimed',
        transcriptHash,
        claimedStartedAt: now,
      };
    }

    throw new ConflictException('Profile creation claim could not be acquired');
  }

  private getActiveProfileCreationRunForConversation(
    userId: string,
    conversationId: string,
  ): ProfileCreationRunRecord | undefined {
    return this.db.get<ProfileCreationRunRecord>(
      `SELECT id, user_id, conversation_id, transcript_hash, status, attempts,
              error_message, started_at, completed_at, created_at, updated_at
       FROM student_profile_creation_runs
       WHERE user_id = ?
         AND conversation_id = ?
         AND status = 'running'
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId, conversationId],
    );
  }

  private getRunningProfileCreationConversationId(userId: string): string | undefined {
    return this.db.get<{ conversation_id: string }>(
      `SELECT conversation_id
       FROM student_profile_creation_runs
       WHERE user_id = ?
         AND status = 'running'
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId],
    )?.conversation_id;
  }

  private getProfileCreationRunByTranscript(
    userId: string,
    conversationId: string,
    transcriptHash: string,
  ): ProfileCreationRunRecord | undefined {
    return this.db.get<ProfileCreationRunRecord>(
      `SELECT id, user_id, conversation_id, transcript_hash, status, attempts,
              error_message, started_at, completed_at, created_at, updated_at
       FROM student_profile_creation_runs
       WHERE user_id = ?
         AND conversation_id = ?
         AND transcript_hash = ?
       LIMIT 1`,
      [userId, conversationId, transcriptHash],
    );
  }

  private reclaimProfileCreationRun(
    existing: ProfileCreationRunRecord,
    now: string,
    expectedStatus: 'running' | 'failed',
  ): ProfileCreationClaim {
    const reclaimed = this.db.run(
      `UPDATE student_profile_creation_runs
       SET status = 'running',
           attempts = attempts + 1,
           error_message = NULL,
           started_at = ?,
           completed_at = NULL,
           updated_at = ?
       WHERE id = ?
         AND status = ?
         AND started_at = ?
         AND updated_at = ?`,
      [now, now, existing.id, expectedStatus, existing.started_at, existing.updated_at],
    );
    if (reclaimed.changes === 1) {
      return {
        runId: existing.id,
        status: 'claimed',
        transcriptHash: existing.transcript_hash,
        claimedStartedAt: now,
      };
    }

    const current = this.db.get<ProfileCreationRunRecord>(
      `SELECT id, user_id, conversation_id, transcript_hash, status, attempts,
              error_message, started_at, completed_at, created_at, updated_at
       FROM student_profile_creation_runs
       WHERE id = ?
       LIMIT 1`,
      [existing.id],
    );
    if (current?.status === 'completed') {
      return {
        runId: current.id,
        status: 'completed',
        transcriptHash: current.transcript_hash,
      };
    }
    throw new ConflictException('Profile creation is already in progress');
  }

  private markProfileCreationRunSuperseded(
    existing: ProfileCreationRunRecord,
    now: string,
    errorMessage: string,
  ): void {
    const result = this.db.run(
      `UPDATE student_profile_creation_runs
       SET status = 'failed',
           error_message = ?,
           completed_at = ?,
           updated_at = ?
       WHERE id = ?
         AND status = 'running'
         AND started_at = ?
         AND updated_at = ?`,
      [
        this.cleanString(errorMessage, 600) ?? 'Profile creation run superseded',
        now,
        now,
        existing.id,
        existing.started_at,
        existing.updated_at,
      ],
    );
    if (result.changes !== 1) {
      throw new ConflictException('Profile creation is already in progress');
    }
  }

  private isProfileCreationRunStale(record: ProfileCreationRunRecord, now: string): boolean {
    const timeoutMs = this.getProfileCreationRunningTimeoutMs();
    const leaseAtMs = Date.parse(record.updated_at);
    const nowMs = Date.parse(now);
    if (!Number.isFinite(leaseAtMs) || !Number.isFinite(nowMs)) {
      return true;
    }
    return nowMs - leaseAtMs > timeoutMs;
  }

  private getProfileCreationRunningTimeoutMs(): number {
    const configuredTimeoutMs =
      this.configService.get<number>('app.profileCreationRunningTimeoutMs') ?? 900_000;
    return Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0
      ? configuredTimeoutMs
      : 900_000;
  }

  private getProfileCreationHeartbeatIntervalMs(): number {
    const timeoutMs = this.getProfileCreationRunningTimeoutMs();
    return Math.max(1_000, Math.min(60_000, Math.floor(timeoutMs / 3)));
  }

  private async runWithProfileCreationHeartbeat<T>(
    heartbeat: (() => void) | undefined,
    operation: (abortSignal?: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (!heartbeat) {
      return operation();
    }

    heartbeat();
    const controller = new AbortController();
    let intervalError: unknown;
    const interval = setInterval(() => {
      try {
        heartbeat();
      } catch (error) {
        intervalError ??= error;
        controller.abort(error);
      }
    }, this.getProfileCreationHeartbeatIntervalMs());
    const unref = (interval as { unref?: () => void }).unref;
    if (typeof unref === 'function') {
      unref.call(interval);
    }

    try {
      const result = await operation(controller.signal);
      if (intervalError) {
        throw intervalError;
      }
      heartbeat();
      return result;
    } catch (error) {
      if (intervalError) {
        throw intervalError;
      }
      throw error;
    } finally {
      clearInterval(interval);
    }
  }

  private heartbeatProfileCreationRun(
    runId: string,
    claimedStartedAt?: string,
  ): void {
    const now = new Date().toISOString();
    const result = claimedStartedAt
      ? this.db.run(
          `UPDATE student_profile_creation_runs
           SET updated_at = ?
           WHERE id = ?
             AND status = 'running'
             AND started_at = ?`,
          [now, runId, claimedStartedAt],
        )
      : this.db.run(
          `UPDATE student_profile_creation_runs
           SET updated_at = ?
           WHERE id = ?
             AND status = 'running'`,
          [now, runId],
        );
    if (result.changes !== 1) {
      throw new ConflictException('Profile creation claim is no longer active');
    }
  }

  private finalizeConversationOnboarding(options: {
    user: AuthSession;
    answers: StudentOnboardingAnswers;
    profile: GeneratedProfile;
    conversationId: string;
    runId: string;
    claimedStartedAt?: string;
  }): StudentProfileStatus {
    const now = new Date().toISOString();
    this.db.transaction(() => {
      this.upsertStudentProfile(options.user.id, options.answers, options.profile, now);
      this.finishMeetingLessonAfterProfileCreationAt(
        options.user.id,
        options.conversationId,
        now,
      );
      this.markProfileCreationRunCompletedAt(
        options.runId,
        now,
        options.claimedStartedAt,
      );
    });
    return this.getStatus(options.user);
  }

  private reconcileExistingConversationProfile(userId: string, conversationId: string): void {
    const now = new Date().toISOString();
    this.db.transaction(() => {
      this.finishMeetingLessonAfterProfileCreationAt(userId, conversationId, now);
      this.db.run(
        `UPDATE student_profile_creation_runs
         SET status = 'completed',
             error_message = NULL,
             completed_at = COALESCE(completed_at, ?),
             updated_at = ?
         WHERE user_id = ?
           AND conversation_id = ?
           AND status = 'running'`,
        [now, now, userId, conversationId],
      );
    });
  }

  private upsertStudentProfile(
    userId: string,
    answers: StudentOnboardingAnswers,
    profile: GeneratedProfile,
    now: string,
  ): void {
    const createdAt = this.getProfileCreatedAt(userId) ?? now;
    this.db.run(
      `INSERT INTO student_profiles (
         user_id,
         onboarding_completed_at,
         onboarding_answers_json,
         knowledge_state_json,
         learning_preferences_json,
         psychological_profile_json,
         explanation_strategy_json,
         ai_summary,
         created_at,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         onboarding_completed_at = excluded.onboarding_completed_at,
         onboarding_answers_json = excluded.onboarding_answers_json,
         knowledge_state_json = excluded.knowledge_state_json,
         learning_preferences_json = excluded.learning_preferences_json,
         psychological_profile_json = excluded.psychological_profile_json,
         explanation_strategy_json = excluded.explanation_strategy_json,
         ai_summary = excluded.ai_summary,
         updated_at = excluded.updated_at`,
      [
        userId,
        now,
        JSON.stringify(answers),
        JSON.stringify(profile.knowledgeState),
        JSON.stringify(profile.learningPreferences),
        JSON.stringify(profile.psychologicalProfile),
        JSON.stringify(profile.explanationStrategy),
        profile.aiSummary,
        createdAt,
        now,
      ],
    );
  }

  private getProfileCreatedAt(userId: string): string | undefined {
    return this.db.get<{ created_at: string }>(
      `SELECT created_at
       FROM student_profiles
       WHERE user_id = ?`,
      [userId],
    )?.created_at;
  }

  private markProfileCreationRunCompletedAt(
    runId: string,
    now: string,
    claimedStartedAt?: string,
  ): void {
    const result = claimedStartedAt
      ? this.db.run(
          `UPDATE student_profile_creation_runs
           SET status = 'completed',
               error_message = NULL,
               completed_at = ?,
               updated_at = ?
           WHERE id = ?
             AND status = 'running'
             AND started_at = ?`,
          [now, now, runId, claimedStartedAt],
        )
      : this.db.run(
          `UPDATE student_profile_creation_runs
           SET status = 'completed',
               error_message = NULL,
               completed_at = ?,
               updated_at = ?
           WHERE id = ?
             AND status = 'running'`,
          [now, now, runId],
        );
    if (result.changes !== 1) {
      throw new ConflictException('Profile creation claim is no longer active');
    }
  }

  private markProfileCreationRunInconsistent(
    runId: string,
    errorMessage: string,
  ): void {
    const now = new Date().toISOString();
    const result = this.db.run(
      `UPDATE student_profile_creation_runs
       SET status = 'failed',
           error_message = ?,
           completed_at = ?,
           updated_at = ?
       WHERE id = ?
         AND status = 'completed'`,
      [
        this.cleanString(errorMessage, 600) ?? 'Profile creation state is inconsistent',
        now,
        now,
        runId,
      ],
    );
    if (result.changes !== 1) {
      throw new ConflictException('Profile creation claim is no longer recoverable');
    }
  }

  private markProfileCreationRunFailed(
    runId: string,
    errorMessage: string,
    claimedStartedAt?: string,
  ): void {
    const now = new Date().toISOString();
    const sanitizedError = this.cleanString(errorMessage, 600) ?? 'Profile creation failed';
    if (claimedStartedAt) {
      this.db.run(
        `UPDATE student_profile_creation_runs
         SET status = 'failed',
             error_message = ?,
             completed_at = ?,
             updated_at = ?
         WHERE id = ?
           AND status = 'running'
           AND started_at = ?`,
        [sanitizedError, now, now, runId, claimedStartedAt],
      );
      return;
    }
    this.db.run(
      `UPDATE student_profile_creation_runs
       SET status = 'failed',
           error_message = ?,
           completed_at = ?,
           updated_at = ?
       WHERE id = ?
         AND status = 'running'`,
      [sanitizedError, now, now, runId],
    );
  }

  private extractAnswerText(answer: Record<string, unknown>): string {
    const direct = this.sanitizeTeachingString(
      this.pickString(answer, ['answer', 'text', 'summary']),
      1_500,
    );
    if (direct) {
      return direct;
    }
    const blocks = answer.blocks;
    if (!Array.isArray(blocks)) {
      return '';
    }
    const texts = blocks
      .map((block) => {
        if (!block || typeof block !== 'object') {
          return undefined;
        }
        const item = block as Record<string, unknown>;
        return this.sanitizeTeachingString(
          this.pickString(item, ['text', 'explanation', 'prompt', 'caption']),
          600,
        );
      })
      .filter((item): item is string => Boolean(item));
    return texts.slice(0, 5).join('\n');
  }

  private emptyMeetingReadiness(): StudentMeetingReadiness {
    return {
      canCreateProfile: false,
      score: 0,
      tutorTurnCount: 0,
      meaningfulStudentTurnCount: 0,
      presentSignals: [],
      missingSignals: [...REQUIRED_MEETING_SIGNALS],
      requiredSignals: [...REQUIRED_MEETING_SIGNALS],
    };
  }

  private buildMeetingReadiness(
    userId: string,
    conversationId: string,
    turns: OnboardingConversationTurn[],
  ): StudentMeetingReadiness {
    const lessonSession = this.getMeetingLessonSession(userId, conversationId);
    const meaningfulPrompts = turns
      .map((turn) => this.sanitizeTeachingString(turn.prompt, 1_000) ?? '')
      .filter((prompt) => this.isMeaningfulMeetingPrompt(prompt));
    const combined = meaningfulPrompts.join('\n').toLowerCase();
    const presentSignals = REQUIRED_MEETING_SIGNALS.filter((signal) =>
      this.hasMeetingSignal(signal, combined),
    );
    const missingSignals = REQUIRED_MEETING_SIGNALS.filter(
      (signal) => !presentSignals.includes(signal),
    );
    const meaningfulStudentTurnCount = meaningfulPrompts.length;
    const turnScore = Math.min(30, Math.round((meaningfulStudentTurnCount / 3) * 30));
    const signalScore = Math.round((presentSignals.length / REQUIRED_MEETING_SIGNALS.length) * 70);
    const score = Math.min(100, turnScore + signalScore);

    return {
      conversationId,
      lessonSessionId: lessonSession?.id,
      canCreateProfile:
        meaningfulStudentTurnCount >= 3 &&
        turns.length >= 4 &&
        missingSignals.length === 0,
      score,
      tutorTurnCount: turns.length,
      meaningfulStudentTurnCount,
      presentSignals,
      missingSignals,
      requiredSignals: [...REQUIRED_MEETING_SIGNALS],
    };
  }

  private getMeetingLessonSession(
    userId: string,
    conversationId: string,
  ): { id: string; status: string } | undefined {
    return this.db.get<{ id: string; status: string }>(
      `SELECT id, status
       FROM lesson_sessions
       WHERE user_id = ?
         AND conversation_id = ?
         AND lesson_type = 'meeting'
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId, conversationId],
    );
  }

  private isMeaningfulMeetingPrompt(prompt: string): boolean {
    const normalized = prompt.trim().toLowerCase();
    if (normalized.length < 8) {
      return false;
    }
    return !(
      normalized.includes('начни первую голосовую встречу') ||
      normalized.includes('начинаем первую встречу') ||
      normalized.includes('start the first voice meeting') ||
      normalized.includes('starting the first meeting')
    );
  }

  private hasMeetingSignal(signal: StudentMeetingSignal, text: string): boolean {
    switch (signal) {
      case 'preparation_goal':
        return /егэ|экзам|балл|поступ|цель|подготов|университет|ege|exam|score|goal|university|prepare/i.test(text);
      case 'self_assessment':
        return /уров|увер|тревож|средн|низк|высок|сложн|легко|не понимаю|плохо|нормально|confidence|level|hard|easy|anxious|medium|low|high/i.test(text);
      case 'weak_topic':
        return /производн|функц|уравнен|геометр|тригоном|логариф|стереометр|вероятност|параметр|пробел|застрева|сложн|weak|stuck|derivative|function|equation|geometry/i.test(text);
      case 'explanation_preference':
        return /пример|правил|схем|граф|визу|медлен|быстр|подсказ|практик|коротк|пошаг|example|rule|visual|graph|slow|hint|practice|step/i.test(text);
      case 'diagnostic_or_contentful_reply':
        return /[0-9]\s*[xх]|[xх]\s*=|=|задач|реш|ответ|пример|производн|функц|уравнен|граф|корн|derivative|equation|solve|answer|task/i.test(text);
      default:
        return false;
    }
  }

  private getMissingOnboardingAnswerSignals(
    answers: StudentOnboardingAnswers,
  ): StudentMeetingSignal[] {
    const missing: StudentMeetingSignal[] = [];
    if (!answers.exam && !answers.motivation && !answers.targetScore) {
      missing.push('preparation_goal');
    }
    if (!answers.currentLevel && !answers.confidence && !answers.mathFeeling) {
      missing.push('self_assessment');
    }
    if (answers.weakTopics.length === 0) {
      missing.push('weak_topic');
    }
    if (
      !answers.explanationStyle &&
      !answers.pacing &&
      !answers.hintPreference &&
      !answers.practicePreference &&
      !answers.feedbackStyle &&
      !answers.visualPreference
    ) {
      missing.push('explanation_preference');
    }
    if (answers.diagnosticAnswers.length === 0 && !answers.freeform) {
      missing.push('diagnostic_or_contentful_reply');
    }
    return missing;
  }

  private normalizeAnswers(raw: StudentOnboardingAnswers): StudentOnboardingAnswers {
    const targetScore =
      typeof raw.targetScore === 'number' && Number.isFinite(raw.targetScore)
        ? Math.min(100, Math.max(0, Math.round(raw.targetScore)))
        : undefined;

    return {
      exam: this.cleanString(raw.exam, 40),
      grade: this.cleanString(raw.grade, 20),
      examYear: this.cleanString(raw.examYear, 20),
      targetScore,
      currentLevel: this.cleanString(raw.currentLevel, 60),
      confidence: this.cleanString(raw.confidence, 60),
      mathFeeling: this.cleanString(raw.mathFeeling, 80),
      motivation: this.cleanString(raw.motivation, 120),
      weakTopics: this.cleanStringArray(raw.weakTopics, 12, 80),
      explanationStyle: this.cleanString(raw.explanationStyle, 80),
      pacing: this.cleanString(raw.pacing, 60),
      visualPreference: Boolean(raw.visualPreference),
      hintPreference: this.cleanString(raw.hintPreference, 80),
      practicePreference: this.cleanString(raw.practicePreference, 80),
      feedbackStyle: this.cleanString(raw.feedbackStyle, 80),
      analogyInterests: this.cleanStringArray(raw.analogyInterests, 8, 60),
      diagnosticAnswers: this.cleanDiagnosticAnswers(raw.diagnosticAnswers),
      freeform: this.cleanString(raw.freeform, 800),
    };
  }

  private toTeachingOnlyAnswers(answers: StudentOnboardingAnswers): StudentOnboardingAnswers {
    return {
      exam: answers.exam,
      grade: answers.grade,
      examYear: answers.examYear,
      targetScore: answers.targetScore,
      currentLevel: answers.currentLevel,
      confidence: answers.confidence,
      mathFeeling: answers.mathFeeling,
      motivation: this.sanitizeTeachingString(answers.motivation, 120),
      weakTopics: answers.weakTopics,
      explanationStyle: answers.explanationStyle,
      pacing: answers.pacing,
      visualPreference: answers.visualPreference,
      hintPreference: answers.hintPreference,
      practicePreference: answers.practicePreference,
      feedbackStyle: answers.feedbackStyle,
      analogyInterests: answers.analogyInterests,
      diagnosticAnswers: answers.diagnosticAnswers
        .map((item): DiagnosticAnswer | undefined => {
          const prompt = this.sanitizeTeachingString(item.prompt, 300);
          const answer = this.sanitizeTeachingString(item.answer, 800);
          if (!prompt && !answer) {
            return undefined;
          }
          return {
            prompt: prompt ?? '',
            answer: answer ?? '',
          };
        })
        .filter((item): item is DiagnosticAnswer => Boolean(item)),
      freeform: this.sanitizeTeachingString(answers.freeform, 300),
    };
  }

  private cleanDiagnosticAnswers(value: DiagnosticAnswer[] | undefined): DiagnosticAnswer[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .slice(0, 5)
      .map((item): DiagnosticAnswer => ({
        prompt: this.cleanString(item?.prompt, 300) ?? '',
        answer: this.cleanString(item?.answer, 800) ?? '',
      }))
      .filter((item) => Boolean(item.prompt || item.answer));
  }

  private cleanStringArray(value: string[] | undefined, maxItems: number, maxLength: number): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((item) => this.cleanString(item, maxLength))
      .filter((item): item is string => Boolean(item))
      .slice(0, maxItems);
  }

  private cleanString(value: unknown, maxLength: number): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const normalized = value.trim().replace(/\s+/g, ' ');
    return normalized ? normalized.slice(0, maxLength) : undefined;
  }

  private sanitizeTeachingObject(value: Record<string, unknown>): Record<string, unknown> {
    const sanitized = this.sanitizeTeachingValue(value, 0);
    return sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)
      ? (sanitized as Record<string, unknown>)
      : {};
  }

  private sanitizeTeachingValue(value: unknown, depth: number): unknown {
    if (value === null || value === undefined || depth > 5) {
      return undefined;
    }
    if (typeof value === 'string') {
      return this.sanitizeTeachingString(value, 500);
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (Array.isArray(value)) {
      const sanitizedItems = value
        .slice(0, 20)
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

  private sanitizeTeachingString(value: string | undefined, maxLength: number): string | undefined {
    const cleaned = this.cleanString(value, maxLength);
    if (!cleaned || this.sensitiveProfileValuePattern.test(cleaned)) {
      return undefined;
    }
    return cleaned;
  }

  private toDto(record: StudentProfileRecord): StudentProfileDto {
    return {
      userId: record.user_id,
      onboardingCompletedAt: record.onboarding_completed_at,
      onboardingAnswers: this.parseJson(record.onboarding_answers_json, {
        weakTopics: [],
        analogyInterests: [],
        diagnosticAnswers: [],
      }),
      knowledgeState: this.parseJson(record.knowledge_state_json, {}),
      learningPreferences: this.parseJson(record.learning_preferences_json, {}),
      psychologicalProfile: this.parseJson(record.psychological_profile_json, {}),
      explanationStrategy: this.parseJson(record.explanation_strategy_json, {}),
      recentSessionSummaries: this.getRecentSessionSummaries(record.user_id),
      skillProgress: this.getRecentSkillProgress(record.user_id),
      aiSummary: record.ai_summary,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  private getRecentSessionSummaries(userId: string): StudentSessionSummaryDto[] {
    const rows = this.db.all<{
      id: string;
      conversation_id: string | null;
      lesson_type: StudentSessionSummaryDto['lessonType'];
      summary_json: string;
      evidence_levels_json: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, conversation_id, lesson_type, summary_json,
              evidence_levels_json, created_at, updated_at
       FROM student_session_summaries
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [userId],
    );

    return rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      lessonType: row.lesson_type,
      summary: this.parseJson(row.summary_json, {}),
      evidenceLevels: this.parseJson(row.evidence_levels_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  private getRecentSkillProgress(userId: string): StudentSkillProgressDto[] {
    const rows = this.db.all<{
      id: string;
      conversation_id: string | null;
      lesson_type: StudentSkillProgressDto['lessonType'];
      topic: string;
      skill: string;
      direction: StudentSkillProgressDto['direction'];
      confidence: StudentSkillProgressDto['confidence'];
      support_needed: StudentSkillProgressDto['supportNeeded'];
      independence: StudentSkillProgressDto['independence'];
      evidence_json: string;
      created_at: string;
    }>(
      `SELECT id, conversation_id, lesson_type, topic, skill, direction,
              confidence, support_needed, independence, evidence_json, created_at
       FROM student_skill_progress
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 12`,
      [userId],
    );

    return rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      lessonType: row.lesson_type,
      topic: row.topic,
      skill: row.skill,
      direction: row.direction,
      confidence: row.confidence,
      supportNeeded: row.support_needed,
      independence: row.independence,
      evidence: this.parseJson(row.evidence_json, {}),
      createdAt: row.created_at,
    }));
  }

  private parseJson<T>(value: string, fallback: T): T {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
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
}
