import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { AiModelService } from '../ai-model/ai-model.service';
import { AuthSession } from '../auth/auth.types';
import { BackgroundAiService } from '../background-ai/background-ai.service';
import { DatabaseService } from '../database/database.service';
import { CurriculumService } from '../lesson/curriculum.service';
import { LessonDecisionService } from '../lesson/lesson-decision.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { LessonService } from '../lesson/lesson.service';
import { MathVerifierService } from '../lesson/math-verifier.service';
import type {
  CurriculumContext,
  LessonDecisionResult,
  LessonVerifierEvidence,
  LessonGoalStatus,
  LessonLifecycleDto,
  LessonSessionRecord,
} from '../lesson/lesson.types';
import { StudentProfileService } from '../student-profile/student-profile.service';
import { UsageService } from '../usage/usage.service';
import type {
  LessonType,
  LessonTypeConfig,
  TutorAnswer,
  TutorCitation,
  TutorExample,
  TutorImageBlock,
  TutorImagePriority,
  TutorImageStatus,
  TutorLessonHistory,
  TutorLessonHistoryItem,
  TutorLessonHistoryTurn,
  TutorResponseBlock,
  TutorTask,
  TutorUsageSnapshot,
} from './tutor.types';

interface AnswerMessageOptions {
  user: AuthSession;
  message?: string;
  conversationId?: string;
  requestId?: string;
  source: 'text' | 'voice';
  lessonType?: LessonType;
}

interface GenerateImageOptions {
  user: AuthSession;
  prompt?: string;
  context?: string;
  conversationId?: string;
  lessonSessionId?: string;
  lessonType?: LessonType;
  turnId?: string;
  blockId?: string;
}

interface LessonHistoryOptions {
  user: AuthSession;
  limit?: string;
  turnLimit?: string;
  scope?: string;
}

interface FinishLessonOptions {
  user: AuthSession;
  lessonSessionId: string;
}

type LessonHistoryScope = 'all' | 'active' | 'history';

const TERMINAL_LESSON_STATUSES = ['hard_limit_reached', 'goal_reached', 'finished'] as const;

const LESSON_TYPE_CONFIGS: Record<LessonType, LessonTypeConfig> = {
  meeting: {
    type: 'meeting',
    title: 'Первая встреча',
    description: 'Сбор учебного контекста, мотивации, уровня и предпочтений объяснения.',
    goal: 'понять ученика и выбрать безопасную стратегию объяснений',
    responseBlocks: ['text'],
    usesRag: true,
    usesStudentProfile: false,
    updatesStudentProfile: true,
    backgroundAnalysis: false,
  },
  tutor: {
    type: 'tutor',
    title: 'Репетитор',
    description: 'Ответ на вопрос или разбор задачи ученика.',
    goal: 'дать понятное пошаговое объяснение и проверить понимание',
    responseBlocks: ['text', 'example', 'task', 'image'],
    usesRag: true,
    usesStudentProfile: true,
    updatesStudentProfile: true,
    backgroundAnalysis: true,
  },
  concept: {
    type: 'concept',
    title: 'Тема',
    description: 'Объяснение понятия с нуля или с текущего уровня ученика.',
    goal: 'разложить тему на короткие смысловые шаги',
    responseBlocks: ['text', 'example', 'image', 'task'],
    usesRag: true,
    usesStudentProfile: true,
    updatesStudentProfile: true,
    backgroundAnalysis: true,
  },
  practice: {
    type: 'practice',
    title: 'Практика',
    description: 'Тренировка навыка через задания, подсказки и проверку.',
    goal: 'дать задания подходящей сложности и собрать сигналы самостоятельности',
    responseBlocks: ['text', 'task', 'example'],
    usesRag: true,
    usesStudentProfile: true,
    updatesStudentProfile: true,
    backgroundAnalysis: true,
  },
  diagnostic: {
    type: 'diagnostic',
    title: 'Проверка уровня',
    description: 'Мягкая диагностика без школьно-тестового фрейма.',
    goal: 'понять текущий уровень и пробелы без оценки ученика',
    responseBlocks: ['text', 'task'],
    usesRag: true,
    usesStudentProfile: true,
    updatesStudentProfile: true,
    backgroundAnalysis: true,
  },
  exam_strategy: {
    type: 'exam_strategy',
    title: 'Стратегия ЕГЭ',
    description: 'Разбор типа задания, ловушек, времени и формата ответа.',
    goal: 'подготовить ученика к экзаменационному способу решения',
    responseBlocks: ['text', 'example', 'task'],
    usesRag: true,
    usesStudentProfile: true,
    updatesStudentProfile: true,
    backgroundAnalysis: true,
  },
  mistake_review: {
    type: 'mistake_review',
    title: 'Разбор ошибки',
    description: 'Анализ решения ученика и повторяющихся паттернов ошибок.',
    goal: 'найти причину ошибки и предложить корректирующий шаг',
    responseBlocks: ['text', 'example', 'task'],
    usesRag: true,
    usesStudentProfile: true,
    updatesStudentProfile: true,
    backgroundAnalysis: true,
  },
  visual_explanation: {
    type: 'visual_explanation',
    title: 'Визуальное объяснение',
    description: 'Объяснение через схему, график или координатную плоскость.',
    goal: 'связать текстовое объяснение с полезной визуальной опорой',
    responseBlocks: ['text', 'image', 'example', 'task'],
    usesRag: true,
    usesStudentProfile: true,
    updatesStudentProfile: true,
    backgroundAnalysis: true,
  },
  reflection: {
    type: 'reflection',
    title: 'Рефлексия',
    description: 'Периодическая проверка темпа, уверенности и стратегии.',
    goal: 'понять, что помогает ученику, и скорректировать обучение',
    responseBlocks: ['text'],
    usesRag: false,
    usesStudentProfile: true,
    updatesStudentProfile: true,
    backgroundAnalysis: true,
  },
};

@Injectable()
export class TutorService {
  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
    private readonly knowledgeService: KnowledgeService,
    private readonly aiModel: AiModelService,
    private readonly studentProfileService: StudentProfileService,
    private readonly backgroundAiService: BackgroundAiService,
    private readonly lessonService: LessonService,
    private readonly lessonDecisionService: LessonDecisionService,
    private readonly usageService: UsageService,
    private readonly curriculumService: CurriculumService,
    private readonly mathVerifierService: MathVerifierService,
  ) {}

  getLessonHistory(options: LessonHistoryOptions): TutorLessonHistory {
    const limit = this.normalizePositiveInteger(options.limit, 8, 1, 12);
    const turnLimit = this.normalizePositiveInteger(options.turnLimit, 4, 1, 8);
    const scope = this.normalizeLessonHistoryScope(options.scope);
    const sessionFilters = ['user_id = ?'];
    const sessionParams: unknown[] = [options.user.id];
    if (scope === 'active') {
      sessionFilters.push(`status NOT IN (${TERMINAL_LESSON_STATUSES.map(() => '?').join(', ')})`);
      sessionParams.push(...TERMINAL_LESSON_STATUSES);
    } else if (scope === 'history') {
      sessionFilters.push(`status IN (${TERMINAL_LESSON_STATUSES.map(() => '?').join(', ')})`);
      sessionParams.push(...TERMINAL_LESSON_STATUSES);
    }
    const rows = this.db.all<{
      id: string;
      conversation_id: string;
      lesson_type: LessonType;
      status: TutorLessonHistoryItem['status'];
      goal_status: TutorLessonHistoryItem['goalStatus'];
      goal_text: string;
      success_criteria_json: string;
      finish_reason: string | null;
      active_learning_seconds: number;
      turn_count: number;
      started_at: string;
      last_activity_at: string;
      updated_at: string;
    }>(
      `SELECT id, conversation_id, lesson_type, status, goal_status, goal_text,
              success_criteria_json, finish_reason, active_learning_seconds,
              turn_count, started_at, last_activity_at, updated_at
       FROM lesson_sessions
       WHERE ${sessionFilters.join(' AND ')}
       ORDER BY updated_at DESC
       LIMIT ?`,
      [...sessionParams, limit],
    );

    const sessionLessons = rows.map((row) =>
      this.buildLessonHistoryItem(options.user.id, row, turnLimit),
    );
    const legacyLessons = this.getLegacyConversationHistory(
      options.user.id,
      new Set(sessionLessons.map((lesson) => lesson.conversationId)),
      limit,
      turnLimit,
      scope,
    );

    return {
      lessons: [...sessionLessons, ...legacyLessons]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, limit),
    };
  }

  finishLesson(options: FinishLessonOptions): TutorLessonHistoryItem {
    const lessonSessionId = options.lessonSessionId.trim();
    if (!lessonSessionId) {
      throw new BadRequestException('lessonSessionId is required');
    }
    const row = this.lessonService.finishSession({
      userId: options.user.id,
      lessonSessionId,
      reason: 'student_finished_lesson',
    });
    if (!row) {
      throw new NotFoundException('Lesson session not found');
    }
    this.enqueueLessonClosureReview(options.user, row, row.finish_reason ?? 'student_finished_lesson');
    return this.buildLessonHistoryItem(options.user.id, row, 6);
  }

  async answerMessage(options: AnswerMessageOptions): Promise<TutorAnswer> {
    const message = this.normalizeMessage(options.message);
    const requestId = this.normalizeRequestId(options.requestId);
    const cachedAnswer = requestId ? this.getCachedTutorTurn(options.user.id, requestId) : undefined;
    if (cachedAnswer) {
      cachedAnswer.usage = this.usageService.getLessonUsageSnapshot(
        options.user.id,
        cachedAnswer.lessonLifecycle.lessonSessionId,
      );
      return cachedAnswer;
    }
    const conversationId = options.conversationId?.trim() || `conv_${randomUUID()}`;
    const lessonType = this.normalizeLessonType(options.lessonType) ?? this.inferLessonType(message);
    const curriculum = this.curriculumService.resolve(message);
    const topicHint = curriculum.topicId;
    const correlationId = `turn_${randomUUID()}`;
    const closureCandidates = this.getLessonSessionsClosedByNewBoundary(
      options.user.id,
      conversationId,
      lessonType,
    );
    let lifecycle: LessonLifecycleDto;
    try {
      lifecycle = this.lessonService.beginTurn({
        userId: options.user.id,
        conversationId,
        lessonType,
        topicHint,
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        this.enqueueLessonClosureReviews(options.user, closureCandidates, conversationId, lessonType);
      }
      throw error;
    }
    this.enqueueLessonClosureReviews(options.user, closureCandidates, conversationId, lessonType);
    if (lifecycle.shouldStop) {
      const answer = this.buildLimitStopAnswer(conversationId, lessonType, lifecycle);
      this.persistTutorTurn(options.user.id, conversationId, lessonType, message, answer, requestId);
      this.enqueueTerminalLessonReview(options.user, answer.lessonLifecycle);
      answer.usage = this.usageService.getLessonUsageSnapshot(
        options.user.id,
        lifecycle.lessonSessionId,
      );
      return answer;
    }

    const verifierEvidence = this.mathVerifierService.verifyPendingTaskAttempt({
      userId: options.user.id,
      lessonSessionId: lifecycle.lessonSessionId,
      conversationId,
      message,
    });
    const vectorStoreIds = this.knowledgeService.getActiveVectorStoreIds();
    const studentProfileContext = this.studentProfileService.getTutorContext(options.user.id);
    const continuityContext = this.getTutorContinuityContext(options.user.id, conversationId);
    const decisionResult = await this.lessonDecisionService.decide({
      userId: options.user.id,
      userName: options.user.name,
      conversationId,
      lessonType,
      lifecycle,
      studentMessage: message,
      source: options.source,
      studentProfileContext,
      topicHint,
      curriculum,
      verifierEvidence,
      usageContext: {
        userId: options.user.id,
        conversationId,
        lessonSessionId: lifecycle.lessonSessionId,
        lessonType,
        correlationId,
      },
    });
    const response = await this.aiModel.createOperationResponse(
      vectorStoreIds.length > 0 ? 'tutorAnswerWithRag' : 'tutorAnswer',
      this.buildTutorRequest(
        message,
        options.user,
        vectorStoreIds,
        options.source,
        studentProfileContext,
        continuityContext,
        lessonType,
        lifecycle,
        decisionResult,
        curriculum,
        verifierEvidence,
        {
          userId: options.user.id,
          conversationId,
          lessonSessionId: lifecycle.lessonSessionId,
          lessonType,
          correlationId,
        },
      ),
    );
    const text = this.extractOutputText(response);
    const answer = this.parseTutorAnswer(text, message, conversationId, lessonType, lifecycle);
    answer.citations = this.extractCitations(response);
    answer.debug = this.buildTutorDebug(curriculum, decisionResult, verifierEvidence);
    this.mathVerifierService.ensureBackendTask({
      userId: options.user.id,
      lessonSessionId: lifecycle.lessonSessionId,
      conversationId,
      lessonType,
      curriculum,
      answer,
    });
    answer.lessonLifecycle = this.lessonService.completeTurn({
      userId: options.user.id,
      studentMessage: message,
      lifecycle: answer.lessonLifecycle,
      goalStatus: answer.lessonLifecycle.goalStatus,
      finishReason: answer.lessonLifecycle.finishReason,
      decisionPolicy: decisionResult.policy,
      answerShape: {
        tasksCount: answer.tasks.length,
        examplesCount: answer.examples.length,
        imageBlocksCount: this.imageBlocksFromBlocks(answer.blocks).length,
      },
    });
    answer.usage = this.usageService.getLessonUsageSnapshot(
      options.user.id,
      answer.lessonLifecycle.lessonSessionId,
    );
    answer.debug = this.buildTutorDebug(curriculum, decisionResult, verifierEvidence);
    this.persistTutorTurn(options.user.id, conversationId, lessonType, message, answer, requestId);
    this.enqueueBackgroundWork(options.user, conversationId, lessonType, message, options.source, answer);
    this.enqueueTerminalLessonReview(options.user, answer.lessonLifecycle);
    return answer;
  }

  async generateImage(options: GenerateImageOptions): Promise<{
    imageBase64: string;
    dataUrl: string;
    mimeType: string;
    revisedPrompt?: string;
    usage?: TutorUsageSnapshot;
  }> {
    const prompt = this.normalizeImagePrompt(options.prompt, options.context);
    const response = await this.aiModel.generateOperationImage('tutorImage', {
      prompt,
      size: this.configService.get<string>('ai.openai.imageSize') ?? '1024x1024',
      quality: this.configService.get<string>('ai.openai.imageQuality') ?? 'low',
      usageContext: {
        userId: options.user.id,
        conversationId: options.conversationId,
        lessonSessionId: options.lessonSessionId,
        lessonType: options.lessonType,
      },
    });
    const data = Array.isArray(response.data) ? (response.data[0] as Record<string, unknown>) : undefined;
    const imageBase64 = this.pickString(data, ['b64_json']);
    if (!imageBase64) {
      throw new BadRequestException('OpenAI did not return image data');
    }
    const dataUrl = `data:image/png;base64,${imageBase64}`;
    this.persistGeneratedImage({
      userId: options.user.id,
      turnId: options.turnId,
      blockId: options.blockId,
      conversationId: options.conversationId,
      prompt,
      dataUrl,
    });

    return {
      imageBase64,
      dataUrl,
      mimeType: 'image/png',
      revisedPrompt: this.pickString(data, ['revised_prompt']),
      usage: options.lessonSessionId
        ? this.usageService.getLessonUsageSnapshot(options.user.id, options.lessonSessionId)
        : undefined,
    };
  }

  private buildTutorRequest(
    message: string,
    user: AuthSession,
    vectorStoreIds: string[],
    source: 'text' | 'voice',
    studentProfileContext: string | undefined,
    continuityContext: string | undefined,
    lessonType: LessonType,
    lifecycle: LessonLifecycleDto,
    decisionResult: LessonDecisionResult,
    curriculum: CurriculumContext,
    verifierEvidence: LessonVerifierEvidence,
    usageContext: Record<string, unknown>,
  ): Record<string, unknown> {
    const tools =
      vectorStoreIds.length > 0
        ? [
            {
              type: 'file_search',
              vector_store_ids: vectorStoreIds,
              max_num_results: 6,
            },
          ]
        : undefined;

    return {
      instructions: this.getTutorInstructions(vectorStoreIds.length > 0),
      usageContext,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                `Имя ученика: ${user.name}`,
                `Источник запроса: ${source === 'voice' ? 'голос' : 'текст'}`,
                this.getLessonTypePrompt(lessonType),
                this.getCurriculumPrompt(curriculum),
                this.getLessonLifecyclePrompt(lifecycle),
                this.getVerifierPrompt(verifierEvidence),
                this.getLessonDecisionPrompt(decisionResult),
                studentProfileContext ? studentProfileContext : 'Профиль ученика еще не создан.',
                continuityContext ?? 'Предыдущий учебный контекст не найден.',
                `Запрос ученика: ${message}`,
              ].join('\n'),
            },
          ],
        },
      ],
      tools,
      include: vectorStoreIds.length > 0 ? ['file_search_call.results'] : undefined,
    };
  }

  private getTutorInstructions(hasRag: boolean): string {
    return [
      'Ты AI-репетитор по математике для подготовки к ЕГЭ на русском языке.',
      'Объясняй пошагово, проверяй понимание, не давай только финальный ответ.',
      'Если в запросе есть профиль ученика из базы данных, адаптируй тон, темп, примеры, подсказки и визуальную поддержку под него.',
      'Психолого-педагогический профиль используй только как учебную стратегию. Не ставь диагнозы, не обсуждай чувствительные личные выводы и не манипулируй учеником.',
      'Учитывай тип занятия из запроса. Тип занятия управляет целью ответа, набором блоков, уровнем диагностики и тем, какие учебные сигналы важно собрать.',
      'Учитывай curriculum IDs и backend verifier evidence. Если verifier уже проверил попытку, опирайся на этот результат, а не на собственную оценку.',
      'Учитывай состояние lessonLifecycle: цель, критерии успеха, лимиты времени, рекомендацию перерыва и сигнал прогресса/регресса.',
      'Учитывай Lesson Decision и backend policy: следуй accepted actions, если proposal был rejected, мягко выполни requiredAction.',
      'Если lessonLifecycle показывает soft_limit, мягко заверши текущий шаг и не начинай длинную новую тему.',
      'Не завершай урок самостоятельно. lessonLifecycle.goalStatus="reached" можно ставить только если backend policy already accepted propose_goal_completion.',
      'Если прогресс сменился регрессом, поменяй стратегию: меньше шаг, другой пример, визуальная опора или короткая проверка базы.',
      'Планируй ответ как ordered blocks: text, example, task, image. Текст должен работать даже если картинка не будет создана.',
      'Если ученик просит задачу, верни 1-3 task blocks и продублируй их в поле tasks.',
      'Если ученик просит пример или объяснение понятия, верни 1-3 example blocks и продублируй их в поле examples.',
      'Если ученик прямо просит рисунок, схему, график, изображение или визуальное объяснение, image block обязателен.',
      'Если рисунок, график, схема или координатная плоскость сильно помогут, добавь image block со status="suggested", prompt, caption, altText и priority="optional|important|required"; также поставь needsImage=true и imagePrompt.',
      hasRag
        ? 'Используй file_search для материалов ЕГЭ, если вопрос связан с программой, типами заданий или правилами.'
        : 'Если материалы ЕГЭ еще не загружены, честно опирайся на общие знания и не выдумывай ссылки.',
      'Верни только валидный JSON без Markdown и без пояснений вокруг него.',
      'Формат JSON: {"answer":"...","lessonLifecycle":{"goalStatus":"in_progress|reached|blocked","goalProgress":"...","finishReason":""},"blocks":[{"type":"text","text":"..."},{"type":"example","title":"...","explanation":"..."},{"type":"task","title":"...","prompt":"...","difficulty":"..."},{"type":"image","status":"suggested","prompt":"...","caption":"...","altText":"...","priority":"optional"}],"tasks":[{"title":"...","prompt":"...","difficulty":"..."}],"examples":[{"title":"...","explanation":"..."}],"needsImage":false,"imagePrompt":""}',
    ].join(' ');
  }

  private parseTutorAnswer(
    text: string,
    studentMessage: string,
    conversationId: string,
    lessonType: LessonType,
    lifecycle: LessonLifecycleDto,
  ): TutorAnswer {
    const parsed = this.parseJsonObject(text);
    const requestedImagePrompt = this.buildRequestedImagePrompt(studentMessage, text);
    if (!parsed) {
      const needsImage = Boolean(requestedImagePrompt || this.looksVisual(text));
      const imagePrompt = requestedImagePrompt ?? (needsImage
        ? `Образовательная математическая схема для объяснения: ${text.slice(0, 500)}`
        : undefined);
      const answer = text || 'Не удалось разобрать ответ модели.';
      const blocks = this.buildResponseBlocks(answer, [], [], imagePrompt, needsImage);
      return {
        conversationId,
        lessonType,
        lessonLifecycle: lifecycle,
        answer,
        blocks: requestedImagePrompt ? this.markImageBlocksRequired(blocks) : blocks,
        tasks: [],
        examples: [],
        needsImage,
        imagePrompt,
        citations: [],
      };
    }

    const parsedBlocks = this.normalizeBlocks(parsed.blocks);
    const answer = this.pickString(parsed, ['answer']) ?? text;
    const lessonLifecycle = this.mergeModelLifecycle(lifecycle, parsed);
    const imagePrompt =
      this.pickString(parsed, ['imagePrompt', 'image_prompt']) ??
      this.buildRequestedImagePrompt(studentMessage, answer);
    const initialTasks = this.normalizeTasks(parsed.tasks);
    const initialExamples = this.normalizeExamples(parsed.examples);
    const initialNeedsImage = Boolean(
      parsed.needsImage ?? parsed.needs_image ?? requestedImagePrompt,
    );
    const normalizedBlocks = this.completeResponseBlocks(
      answer,
      initialTasks,
      initialExamples,
      parsedBlocks,
      imagePrompt,
      initialNeedsImage,
    );
    const blocks = requestedImagePrompt
      ? this.markImageBlocksRequired(normalizedBlocks)
      : normalizedBlocks;
    const tasks = initialTasks.length > 0 ? initialTasks : this.tasksFromBlocks(blocks);
    const examples =
      initialExamples.length > 0 ? initialExamples : this.examplesFromBlocks(blocks);
    const imageBlocks = this.imageBlocksFromBlocks(blocks);
    const primaryImagePrompt = imagePrompt ?? imageBlocks[0]?.prompt;

    return {
      conversationId,
      lessonType,
      lessonLifecycle,
      answer,
      blocks,
      tasks,
      examples,
      needsImage: Boolean(initialNeedsImage || primaryImagePrompt || imageBlocks.length > 0),
      imagePrompt: primaryImagePrompt || undefined,
      citations: [],
    };
  }

  private persistTutorTurn(
    userId: string,
    conversationId: string,
    lessonType: LessonType,
    prompt: string,
    answer: TutorAnswer,
    requestId?: string,
  ): string {
    const turnId = randomUUID();
    answer.turnId = turnId;
    this.db.run(
      `INSERT INTO tutor_turns (
         id, user_id, conversation_id, request_id, lesson_type, prompt, answer_json, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        turnId,
        userId,
        conversationId,
        requestId ?? null,
        lessonType,
        prompt,
        JSON.stringify(answer),
        new Date().toISOString(),
      ],
    );
    return turnId;
  }

  private getCachedTutorTurn(userId: string, requestId: string): TutorAnswer | undefined {
    const row = this.db.get<{ answer_json: string }>(
      `SELECT answer_json
       FROM tutor_turns
       WHERE user_id = ?
         AND request_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, requestId],
    );
    if (!row) {
      return undefined;
    }
    const parsed = this.parseJsonObject(row.answer_json);
    return parsed ? (parsed as unknown as TutorAnswer) : undefined;
  }

  private buildLessonHistoryItem(
    userId: string,
    row: Pick<
      LessonSessionRecord,
      | 'id'
      | 'conversation_id'
      | 'lesson_type'
      | 'status'
      | 'goal_status'
      | 'goal_text'
      | 'success_criteria_json'
      | 'finish_reason'
      | 'active_learning_seconds'
      | 'turn_count'
      | 'started_at'
      | 'last_activity_at'
      | 'updated_at'
    >,
    turnLimit: number,
  ): TutorLessonHistoryItem {
    const summary = this.getSessionSummary(userId, row.conversation_id);
    return {
      lessonSessionId: row.id,
      conversationId: row.conversation_id,
      lessonType: this.normalizeLessonType(row.lesson_type) ?? 'tutor',
      status: row.status,
      goalStatus: row.goal_status,
      lessonGoal: row.goal_text,
      successCriteria: this.parseStringArray(row.success_criteria_json),
      finishReason: row.finish_reason ?? undefined,
      turnCount: row.turn_count,
      activeLearningSeconds: row.active_learning_seconds,
      startedAt: row.started_at,
      lastActivityAt: row.last_activity_at,
      updatedAt: row.updated_at,
      summary: summary?.summary,
      evidenceLevels: summary?.evidenceLevels,
      turns: this.getLessonHistoryTurns(userId, row.conversation_id, turnLimit),
    };
  }

  private getLessonHistoryTurns(
    userId: string,
    conversationId: string,
    limit: number,
  ): TutorLessonHistoryTurn[] {
    const rows = this.db.all<{
      id: string;
      prompt: string;
      answer_json: string;
      lesson_type: LessonType;
      created_at: string;
    }>(
      `SELECT id, prompt, answer_json, lesson_type, created_at
       FROM tutor_turns
       WHERE user_id = ?
         AND conversation_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, conversationId, limit],
    );

    return rows
      .map((row): TutorLessonHistoryTurn | undefined => {
        const parsed = this.parseJsonObject(row.answer_json);
        if (!parsed) {
          return undefined;
        }
        const lessonType =
          this.normalizeLessonType(row.lesson_type) ??
          this.normalizeLessonType(parsed.lessonType) ??
          'tutor';
        return {
          id: row.id,
          prompt: row.prompt,
          lessonType,
          source: 'text',
          answer: {
            ...(parsed as unknown as TutorAnswer),
            lessonType,
          },
          createdAt: row.created_at,
        };
      })
      .filter((turn): turn is TutorLessonHistoryTurn => Boolean(turn));
  }

  private getSessionSummary(
    userId: string,
    conversationId: string,
  ): { summary: Record<string, unknown>; evidenceLevels: Record<string, unknown> } | undefined {
    const row = this.db.get<{
      summary_json: string;
      evidence_levels_json: string;
    }>(
      `SELECT summary_json, evidence_levels_json
       FROM student_session_summaries
       WHERE user_id = ?
         AND conversation_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, conversationId],
    );
    if (!row) {
      return undefined;
    }
    return {
      summary: this.parseJsonObject(row.summary_json) ?? {},
      evidenceLevels: this.parseJsonObject(row.evidence_levels_json) ?? {},
    };
  }

  private getLegacyConversationHistory(
    userId: string,
    knownConversationIds: Set<string>,
    limit: number,
    turnLimit: number,
    scope: LessonHistoryScope,
  ): TutorLessonHistoryItem[] {
    if (scope === 'active') {
      return [];
    }
    const rows = this.db.all<{
      conversation_id: string;
      lesson_type: LessonType;
      prompt: string;
      answer_json: string;
      turn_count: number;
      started_at: string;
      updated_at: string;
    }>(
      `SELECT latest.conversation_id,
              latest.lesson_type,
              latest.prompt,
              latest.answer_json,
              stats.turn_count,
              stats.started_at,
              stats.updated_at
       FROM tutor_turns latest
       JOIN (
         SELECT conversation_id,
                MIN(created_at) AS started_at,
                MAX(created_at) AS updated_at,
                COUNT(*) AS turn_count
         FROM tutor_turns
         WHERE user_id = ?
         GROUP BY conversation_id
       ) stats
         ON stats.conversation_id = latest.conversation_id
        AND stats.updated_at = latest.created_at
       WHERE latest.user_id = ?
         AND NOT EXISTS (
           SELECT 1
           FROM lesson_sessions sessions
           WHERE sessions.user_id = latest.user_id
             AND sessions.conversation_id = latest.conversation_id
         )
       ORDER BY stats.updated_at DESC
       LIMIT ?`,
      [userId, userId, limit],
    );

    return rows
      .filter((row) => !knownConversationIds.has(row.conversation_id))
      .map((row): TutorLessonHistoryItem => {
        const parsed = this.parseJsonObject(row.answer_json);
        const summary = this.getSessionSummary(userId, row.conversation_id);
        const lessonType =
          this.normalizeLessonType(row.lesson_type) ??
          this.normalizeLessonType(parsed?.lessonType) ??
          this.normalizeLessonType(this.pickObject(parsed ?? {}, ['lessonLifecycle'])?.lessonType) ??
          'tutor';
        const lifecycle = this.pickObject(parsed ?? {}, ['lessonLifecycle']);
        const lessonSessionId =
          this.pickString(lifecycle, ['lessonSessionId', 'lesson_session_id']) ??
          `legacy_${row.conversation_id}`;
        const goalStatus =
          this.normalizeGoalStatus(this.pickString(lifecycle, ['goalStatus', 'goal_status'])) ??
          'in_progress';
        const status =
          this.normalizeSessionStatus(this.pickString(lifecycle, ['status'])) ?? 'active';
        const goal =
          this.pickString(lifecycle, ['lessonGoal', 'goalText', 'goal_text']) ??
          this.pickString(parsed ?? {}, ['answer'])?.slice(0, 120) ??
          'Продолжить сохраненное обсуждение.';
        const activeLearningSeconds = this.pickNumber(lifecycle, [
          'activeLearningSeconds',
          'active_learning_seconds',
        ]);

        return {
          lessonSessionId,
          conversationId: row.conversation_id,
          lessonType,
          status: status === 'active' ? 'finished' : status,
          goalStatus,
          lessonGoal: goal,
          successCriteria:
            this.pickStringArray(lifecycle, ['successCriteria', 'success_criteria']) ?? [],
          activeLearningSeconds:
            activeLearningSeconds ?? Math.max(0, Number(row.turn_count) || 0) * 30,
          turnCount: Number(row.turn_count) || 0,
          startedAt: row.started_at,
          lastActivityAt: row.updated_at,
          updatedAt: row.updated_at,
          summary: summary?.summary,
          evidenceLevels: summary?.evidenceLevels,
          turns: this.getLessonHistoryTurns(userId, row.conversation_id, turnLimit),
        };
      });
  }

  private normalizeLessonHistoryScope(scope: string | undefined): LessonHistoryScope {
    if (scope === 'active' || scope === 'history' || scope === 'all') {
      return scope;
    }
    return 'all';
  }

  private getTutorContinuityContext(userId: string, conversationId: string): string | undefined {
    const turns = this.getRecentTutorTurnsForPrompt(userId, conversationId, 4);
    const summaries = this.getRecentSessionSummariesForPrompt(userId, 3);
    if (turns.length === 0 && summaries.length === 0) {
      return undefined;
    }
    return [
      'Контекст продолжения из SQLite. Используй его, чтобы продолжить занятие с места предыдущего обсуждения, не начинать заново и не повторять длинно уже пройденное.',
      turns.length > 0 ? `Последние ходы текущего диалога: ${JSON.stringify(turns)}` : undefined,
      summaries.length > 0 ? `Недавние сводки занятий: ${JSON.stringify(summaries)}` : undefined,
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, 5_000);
  }

  private getRecentTutorTurnsForPrompt(
    userId: string,
    conversationId: string,
    limit: number,
  ): Array<Record<string, unknown>> {
    const rows = this.db.all<{
      prompt: string;
      answer_json: string;
      lesson_type: LessonType;
      created_at: string;
    }>(
      `SELECT prompt, answer_json, lesson_type, created_at
       FROM tutor_turns
       WHERE user_id = ?
         AND conversation_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, conversationId, limit],
    );

    return rows.reverse().map((row) => {
      const answer = this.parseJsonObject(row.answer_json) ?? {};
      return {
        lessonType: row.lesson_type,
        prompt: row.prompt.slice(0, 700),
        answer: (this.pickString(answer, ['answer']) ?? '').slice(0, 900),
        goalStatus: this.pickString(this.pickObject(answer, ['lessonLifecycle']), [
          'goalStatus',
          'goal_status',
        ]),
        createdAt: row.created_at,
      };
    });
  }

  private getRecentSessionSummariesForPrompt(
    userId: string,
    limit: number,
  ): Array<Record<string, unknown>> {
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

    return rows.map((row) => ({
      conversationId: row.conversation_id,
      lessonType: row.lesson_type,
      summary: this.parseJsonObject(row.summary_json) ?? {},
      evidenceLevels: this.parseJsonObject(row.evidence_levels_json) ?? {},
      createdAt: row.created_at,
    }));
  }

  private enqueueBackgroundWork(
    user: AuthSession,
    conversationId: string,
    lessonType: LessonType,
    prompt: string,
    source: 'text' | 'voice',
    answer: TutorAnswer,
  ): void {
    try {
      this.backgroundAiService.enqueueTutorTurnWork({
        userId: user.id,
        userName: user.name,
        conversationId,
        lessonSessionId: answer.lessonLifecycle.lessonSessionId,
        lessonType,
        source,
        prompt,
        answer: {
          answer: answer.answer,
          tasksCount: answer.tasks.length,
          examplesCount: answer.examples.length,
          citationsCount: answer.citations.length,
          needsImage: answer.needsImage,
          goalStatus: answer.lessonLifecycle.goalStatus,
          shouldStop: answer.lessonLifecycle.shouldStop,
        },
      });
    } catch {
      // Background adaptation must never block the immediate tutor answer path.
    }
  }

  private getLessonSessionsClosedByNewBoundary(
    userId: string,
    conversationId: string,
    lessonType: LessonType,
  ): LessonSessionRecord[] {
    return this.db.all<LessonSessionRecord>(
      `SELECT id, user_id, conversation_id, lesson_type, status, goal_status, goal_text,
              success_criteria_json, finish_reason, active_learning_seconds, turn_count,
              started_at, last_activity_at, finished_at, created_at, updated_at
       FROM lesson_sessions
       WHERE user_id = ?
         AND status NOT IN (${TERMINAL_LESSON_STATUSES.map(() => '?').join(', ')})
         AND (
           conversation_id != ?
           OR (conversation_id = ? AND lesson_type != ?)
         )
       ORDER BY updated_at DESC`,
      [
        userId,
        ...TERMINAL_LESSON_STATUSES,
        conversationId,
        conversationId,
        lessonType,
      ],
    );
  }

  private enqueueLessonClosureReviews(
    user: AuthSession,
    sessions: LessonSessionRecord[],
    nextConversationId: string,
    nextLessonType: LessonType,
  ): void {
    for (const session of sessions) {
      const finishReason =
        session.conversation_id === nextConversationId
          ? `lesson_type_changed_to_${nextLessonType}`
          : 'superseded_by_new_lesson_session';
      this.enqueueLessonClosureReview(user, session, finishReason);
    }
  }

  private enqueueTerminalLessonReview(
    user: AuthSession,
    lifecycle: LessonLifecycleDto,
  ): void {
    if (!this.isTerminalLessonStatus(lifecycle.status)) {
      return;
    }

    this.enqueueLessonClosureReview(
      user,
      {
        id: lifecycle.lessonSessionId,
        user_id: user.id,
        conversation_id: lifecycle.conversationId,
        lesson_type: lifecycle.lessonType,
        status: lifecycle.status,
        goal_status: lifecycle.goalStatus,
        goal_text: lifecycle.lessonGoal,
        success_criteria_json: JSON.stringify(lifecycle.successCriteria),
        finish_reason: lifecycle.finishReason ?? null,
        active_learning_seconds: lifecycle.activeLearningSeconds,
        turn_count: lifecycle.turnCount,
        started_at: '',
        last_activity_at: '',
        finished_at: null,
        created_at: '',
        updated_at: '',
      },
      lifecycle.finishReason,
    );
  }

  private isTerminalLessonStatus(status: string): boolean {
    return (TERMINAL_LESSON_STATUSES as readonly string[]).includes(status);
  }

  private enqueueLessonClosureReview(
    user: AuthSession,
    session: LessonSessionRecord,
    finishReason?: string,
  ): void {
    try {
      this.backgroundAiService.enqueueLessonClosureReview({
        userId: user.id,
        conversationId: session.conversation_id,
        lessonSessionId: session.id,
        lessonType: session.lesson_type,
        finishReason: finishReason ?? session.finish_reason ?? undefined,
      });
    } catch {
      // Background adaptation must never block lesson lifecycle operations.
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

  private extractCitations(response: Record<string, unknown>): TutorCitation[] {
    const citations = new Map<string, TutorCitation>();
    const output = response.output;
    if (!Array.isArray(output)) {
      return [];
    }

    for (const item of output) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const itemRecord = item as Record<string, unknown>;
      this.collectFileSearchResults(itemRecord, citations);
      const content = itemRecord.content;
      if (!Array.isArray(content)) {
        continue;
      }
      for (const part of content) {
        if (!part || typeof part !== 'object') {
          continue;
        }
        const annotations = (part as Record<string, unknown>).annotations;
        if (!Array.isArray(annotations)) {
          continue;
        }
        for (const annotation of annotations) {
          if (!annotation || typeof annotation !== 'object') {
            continue;
          }
          const record = annotation as Record<string, unknown>;
          const fileId = this.pickString(record, ['file_id', 'fileId']);
          if (!fileId) {
            continue;
          }
          citations.set(fileId, {
            fileId,
            filename: this.pickString(record, ['filename']),
            quote: this.pickString(record, ['quote', 'text']),
          });
        }
      }
    }

    return Array.from(citations.values());
  }

  private collectFileSearchResults(
    item: Record<string, unknown>,
    citations: Map<string, TutorCitation>,
  ): void {
    const results = item.results ?? item.search_results;
    if (!Array.isArray(results)) {
      return;
    }
    for (const result of results) {
      if (!result || typeof result !== 'object') {
        continue;
      }
      const record = result as Record<string, unknown>;
      const fileId = this.pickString(record, ['file_id', 'fileId']);
      if (!fileId || citations.has(fileId)) {
        continue;
      }
      citations.set(fileId, {
        fileId,
        filename: this.pickString(record, ['filename']),
        quote: this.pickString(record, ['text', 'quote']),
      });
    }
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

  private normalizeTasks(value: unknown): TutorTask[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((item): TutorTask | undefined => {
        if (!item || typeof item !== 'object') {
          return undefined;
        }
        const record = item as Record<string, unknown>;
        const prompt = this.pickString(record, ['prompt', 'text', 'task']);
        if (!prompt) {
          return undefined;
        }
        return {
          title: this.pickString(record, ['title']) ?? 'Задача',
          prompt,
          difficulty: this.pickString(record, ['difficulty']),
          hintLadder: this.pickStringArray(record, ['hintLadder', 'hint_ladder']),
        };
      })
      .filter((task): task is TutorTask => Boolean(task));
  }

  private normalizeExamples(value: unknown): TutorExample[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((item): TutorExample | undefined => {
        if (!item || typeof item !== 'object') {
          return undefined;
        }
        const record = item as Record<string, unknown>;
        const explanation = this.pickString(record, ['explanation', 'text']);
        if (!explanation) {
          return undefined;
        }
        return {
          title: this.pickString(record, ['title']) ?? 'Пример',
          explanation,
        };
      })
      .filter((example): example is TutorExample => Boolean(example));
  }

  private normalizeBlocks(value: unknown): TutorResponseBlock[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item): TutorResponseBlock | undefined => {
        if (!item || typeof item !== 'object') {
          return undefined;
        }
        const record = item as Record<string, unknown>;
        const type = this.pickString(record, ['type'])?.toLowerCase();

        if (type === 'text') {
          const blockText = this.pickString(record, ['text', 'content', 'answer']);
          return blockText ? { id: '', type: 'text', text: blockText } : undefined;
        }

        if (type === 'task') {
          const prompt = this.pickString(record, ['prompt', 'text', 'task']);
          if (!prompt) {
            return undefined;
          }
          return {
            id: '',
            type: 'task',
            title: this.pickString(record, ['title']) ?? 'Задача',
            prompt,
            difficulty: this.pickString(record, ['difficulty']),
            hintLadder: this.pickStringArray(record, ['hintLadder', 'hint_ladder']),
          };
        }

        if (type === 'example') {
          const explanation = this.pickString(record, ['explanation', 'text', 'content']);
          if (!explanation) {
            return undefined;
          }
          return {
            id: '',
            type: 'example',
            title: this.pickString(record, ['title']) ?? 'Пример',
            explanation,
          };
        }

        if (type === 'image') {
          const prompt = this.pickString(record, ['prompt', 'imagePrompt', 'image_prompt']);
          if (!prompt) {
            return undefined;
          }
          return this.createImageBlock(
            prompt,
            this.pickString(record, ['caption', 'title']),
            this.pickString(record, ['altText', 'alt_text', 'alt']),
            this.normalizeImagePriority(this.pickString(record, ['priority'])),
            this.normalizeImageStatus(this.pickString(record, ['status'])),
            this.pickString(record, ['url', 'dataUrl', 'data_url']),
          );
        }

        return undefined;
      })
      .filter((block): block is TutorResponseBlock => Boolean(block));
  }

  private completeResponseBlocks(
    answer: string,
    tasks: TutorTask[],
    examples: TutorExample[],
    parsedBlocks: TutorResponseBlock[],
    imagePrompt: string | undefined,
    needsImage: boolean,
  ): TutorResponseBlock[] {
    const blocks = parsedBlocks.length > 0 ? [...parsedBlocks] : [];

    if (blocks.length === 0) {
      return this.buildResponseBlocks(answer, tasks, examples, imagePrompt, needsImage);
    }

    if (!this.hasBlockType(blocks, 'text') && answer) {
      blocks.unshift({ id: '', type: 'text', text: answer });
    }

    if (!this.hasBlockType(blocks, 'task')) {
      blocks.push(...tasks.map((task) => this.taskToBlock(task)));
    }

    if (!this.hasBlockType(blocks, 'example')) {
      blocks.push(...examples.map((example) => this.exampleToBlock(example)));
    }

    const hasImageBlock = this.hasBlockType(blocks, 'image');
    if (!hasImageBlock && (needsImage || imagePrompt) && imagePrompt) {
      blocks.push(this.createImageBlock(imagePrompt));
    }

    return this.assignBlockIds(blocks);
  }

  private buildResponseBlocks(
    answer: string,
    tasks: TutorTask[],
    examples: TutorExample[],
    imagePrompt: string | undefined,
    needsImage: boolean,
  ): TutorResponseBlock[] {
    const blocks: TutorResponseBlock[] = [];
    if (answer.trim()) {
      blocks.push({ id: '', type: 'text', text: answer });
    }
    blocks.push(...tasks.map((task) => this.taskToBlock(task)));
    blocks.push(...examples.map((example) => this.exampleToBlock(example)));
    if ((needsImage || imagePrompt) && imagePrompt) {
      blocks.push(this.createImageBlock(imagePrompt));
    }
    return this.assignBlockIds(blocks);
  }

  private taskToBlock(task: TutorTask): TutorResponseBlock {
    return {
      id: '',
      type: 'task',
      title: task.title,
      prompt: task.prompt,
      difficulty: task.difficulty,
      hintLadder: task.hintLadder,
    };
  }

  private exampleToBlock(example: TutorExample): TutorResponseBlock {
    return {
      id: '',
      type: 'example',
      title: example.title,
      explanation: example.explanation,
    };
  }

  private createImageBlock(
    prompt: string,
    caption = 'Визуальная опора к разбору',
    altText?: string,
    priority: TutorImagePriority = 'optional',
    status: TutorImageStatus = 'suggested',
    url?: string,
  ): TutorImageBlock {
    return {
      id: '',
      type: 'image',
      status,
      prompt,
      caption,
      altText: altText ?? caption,
      priority,
      url,
    };
  }

  private markImageBlocksRequired(blocks: TutorResponseBlock[]): TutorResponseBlock[] {
    return blocks.map((block) =>
      block.type === 'image'
        ? {
            ...block,
            priority: 'required',
          }
        : block,
    );
  }

  private persistGeneratedImage(options: {
    userId: string;
    turnId?: string;
    blockId?: string;
    conversationId?: string;
    prompt: string;
    dataUrl: string;
  }): void {
    const row = this.findTutorTurnForImage(options);
    if (!row) {
      return;
    }
    const parsed = this.parseJsonObject(row.answer_json);
    if (!parsed) {
      return;
    }
    const blocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
    const updatedBlocks = this.attachImageUrlToBlocks(
      blocks,
      options.blockId,
      options.prompt,
      options.dataUrl,
    );
    if (!updatedBlocks.changed) {
      return;
    }
    parsed.blocks = updatedBlocks.blocks;
    parsed.needsImage = true;
    this.db.run(
      `UPDATE tutor_turns
       SET answer_json = ?
       WHERE id = ?
         AND user_id = ?`,
      [JSON.stringify(parsed), row.id, options.userId],
    );
  }

  private findTutorTurnForImage(options: {
    userId: string;
    turnId?: string;
    conversationId?: string;
  }): { id: string; answer_json: string } | undefined {
    if (options.turnId) {
      const row = this.db.get<{ id: string; answer_json: string }>(
        `SELECT id, answer_json
         FROM tutor_turns
         WHERE id = ?
           AND user_id = ?
         LIMIT 1`,
        [options.turnId, options.userId],
      );
      if (row) {
        return row;
      }
    }

    if (!options.conversationId) {
      return undefined;
    }
    return this.db.get<{ id: string; answer_json: string }>(
      `SELECT id, answer_json
       FROM tutor_turns
       WHERE user_id = ?
         AND conversation_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [options.userId, options.conversationId],
    );
  }

  private attachImageUrlToBlocks(
    rawBlocks: unknown[],
    blockId: string | undefined,
    prompt: string,
    dataUrl: string,
  ): { blocks: unknown[]; changed: boolean } {
    let changed = false;
    const blocks = rawBlocks.map((block) => {
      if (!block || typeof block !== 'object') {
        return block;
      }
      const record = block as Record<string, unknown>;
      if (record.type !== 'image') {
        return block;
      }
      const id = this.pickString(record, ['id']);
      const blockPrompt = this.pickString(record, ['prompt', 'imagePrompt', 'image_prompt']);
      const matches =
        (blockId && id === blockId) ||
        (!blockId && blockPrompt && this.sameImagePrompt(blockPrompt, prompt));
      if (!matches || this.pickString(record, ['url', 'dataUrl', 'data_url'])) {
        return block;
      }
      changed = true;
      return {
        ...record,
        status: 'ready',
        url: dataUrl,
      };
    });
    return { blocks, changed };
  }

  private sameImagePrompt(left: string, right: string): boolean {
    return left.trim().replace(/\s+/g, ' ') === right.trim().replace(/\s+/g, ' ');
  }

  private assignBlockIds(blocks: TutorResponseBlock[]): TutorResponseBlock[] {
    const counters: Partial<Record<TutorResponseBlock['type'], number>> = {};
    return blocks.map((block) => {
      counters[block.type] = (counters[block.type] ?? 0) + 1;
      return {
        ...block,
        id: `${block.type}-${counters[block.type]}`,
      };
    });
  }

  private hasBlockType(
    blocks: TutorResponseBlock[],
    type: TutorResponseBlock['type'],
  ): boolean {
    return blocks.some((block) => block.type === type);
  }

  private tasksFromBlocks(blocks: TutorResponseBlock[]): TutorTask[] {
    return blocks
      .filter((block): block is Extract<TutorResponseBlock, { type: 'task' }> => block.type === 'task')
      .map((block) => ({
        title: block.title,
        prompt: block.prompt,
        difficulty: block.difficulty,
        hintLadder: block.hintLadder,
      }));
  }

  private examplesFromBlocks(blocks: TutorResponseBlock[]): TutorExample[] {
    return blocks
      .filter(
        (block): block is Extract<TutorResponseBlock, { type: 'example' }> =>
          block.type === 'example',
      )
      .map((block) => ({
        title: block.title,
        explanation: block.explanation,
      }));
  }

  private imageBlocksFromBlocks(blocks: TutorResponseBlock[]): TutorImageBlock[] {
    return blocks.filter(
      (block): block is TutorImageBlock => block.type === 'image',
    );
  }

  private normalizeImageStatus(status: string | undefined): TutorImageStatus {
    return status === 'queued' || status === 'ready' || status === 'failed'
      ? status
      : 'suggested';
  }

  private normalizeImagePriority(priority: string | undefined): TutorImagePriority {
    return priority === 'important' || priority === 'required' ? priority : 'optional';
  }

  private normalizeLessonType(value: unknown): LessonType | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const normalized = value.trim();
    return this.isLessonType(normalized) ? normalized : undefined;
  }

  private inferLessonType(message: string): LessonType {
    const normalized = message.toLowerCase();
    if (/проверь|проверить|ошиб|решени|не сошлось|check|mistake|error|solution/.test(normalized)) {
      return 'mistake_review';
    }
    if (/диагност|уровень|проверь уровень|что я знаю|diagnostic|level check/.test(normalized)) {
      return 'diagnostic';
    }
    if (/практик|похож.{0,20}задач|дай задач|тренир|practice|similar task|train/.test(normalized)) {
      return 'practice';
    }
    if (/стратег|егэ|балл|время|ловуш|экзамен|exam|strategy|score|time/.test(normalized)) {
      return 'exam_strategy';
    }
    if (/график|рисунок|схем|координат|визуал|покажи|diagram|graph|visual/.test(normalized)) {
      return 'visual_explanation';
    }
    if (/объясни тему|что такое|понятие|с нуля|explain.*topic|what is/.test(normalized)) {
      return 'concept';
    }
    if (/как идет|как получается|темп|сложно ли|reflection|reflect/.test(normalized)) {
      return 'reflection';
    }
    return 'tutor';
  }

  private inferTopicHint(message: string): string | undefined {
    const normalized = message.toLowerCase();
    const topicHints: Array<[RegExp, string]> = [
      [/производн|derivative/, 'производ'],
      [/квадратн|дискриминант|парабол|quadratic|discriminant|parabola/, 'квадрат'],
      [/логарифм|logarithm|log\b/, 'логарифм'],
      [/тригонометр|синус|косинус|тангенс|trigonometry|sine|cosine/, 'тригонометр'],
      [/геометр|треугольник|окружност|площад|объем|geometry|triangle|circle|area|volume/, 'геометр'],
      [/вероятност|probability/, 'вероятност'],
      [/параметр|parameter/, 'параметр'],
      [/интеграл|integral/, 'интеграл'],
      [/функци|график|function|graph/, 'функц'],
      [/уравнен|неравенств|equation|inequality/, 'уравнен'],
    ];
    return topicHints.find(([pattern]) => pattern.test(normalized))?.[1];
  }

  private isLessonType(value: string): value is LessonType {
    return Object.prototype.hasOwnProperty.call(LESSON_TYPE_CONFIGS, value);
  }

  private getLessonTypePrompt(lessonType: LessonType): string {
    const config = LESSON_TYPE_CONFIGS[lessonType];
    return [
      `Тип занятия: ${config.type}`,
      `Название: ${config.title}`,
      `Описание: ${config.description}`,
      `Цель: ${config.goal}`,
      `Предпочтительные блоки ответа: ${config.responseBlocks.join(', ')}`,
      `Использует профиль ученика: ${config.usesStudentProfile ? 'да' : 'нет'}`,
      `Ожидает фонового анализа: ${config.backgroundAnalysis ? 'да' : 'нет'}`,
    ].join('\n');
  }

  private getCurriculumPrompt(curriculum: CurriculumContext): string {
    return [
      'Curriculum context:',
      `topic_id: ${curriculum.topicId}`,
      `topic_title: ${curriculum.topicTitle}`,
      `skill_id: ${curriculum.skillId}`,
      `skill_title: ${curriculum.skillTitle}`,
      `task_type_id: ${curriculum.taskTypeId}`,
      `verifier_kind: ${curriculum.verifierKind}`,
      `confidence: ${curriculum.confidence}`,
      curriculum.resolutionReason ? `resolution: ${curriculum.resolutionReason}` : '',
      curriculum.candidates?.length
        ? `candidates: ${curriculum.candidates
            .map(
              (candidate) =>
                `${candidate.skillId}/${candidate.taskTypeId} score=${candidate.score}`,
            )
            .join('; ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private getVerifierPrompt(evidence: LessonVerifierEvidence): string {
    return [
      'Backend verifier evidence:',
      `attemptSubmitted: ${evidence.attemptSubmitted ? 'yes' : 'no'}`,
      `result: ${evidence.result}`,
      `masteryUpdateAllowed: ${evidence.masteryUpdateAllowed ? 'yes' : 'no'}`,
      evidence.masteryPolicyReason ? `masteryPolicy: ${evidence.masteryPolicyReason}` : '',
      evidence.masteryEvidenceLevel ? `masteryEvidenceLevel: ${evidence.masteryEvidenceLevel}` : '',
      evidence.verifiedSuccessCount !== undefined
        ? `verifiedSuccessCount: ${evidence.verifiedSuccessCount}`
        : '',
      evidence.independentSuccessCount !== undefined
        ? `independentSuccessCount: ${evidence.independentSuccessCount}`
        : '',
      evidence.requiredSuccessCount !== undefined
        ? `requiredSuccessCount: ${evidence.requiredSuccessCount}`
        : '',
      evidence.currentLessonVerifiedSuccessCount !== undefined
        ? `currentLessonVerifiedSuccessCount: ${evidence.currentLessonVerifiedSuccessCount}`
        : '',
      evidence.currentLessonIndependentSuccessCount !== undefined
        ? `currentLessonIndependentSuccessCount: ${evidence.currentLessonIndependentSuccessCount}`
        : '',
      evidence.cumulativeVerifiedSuccessCount !== undefined
        ? `cumulativeVerifiedSuccessCount: ${evidence.cumulativeVerifiedSuccessCount}`
        : '',
      evidence.cumulativeIndependentSuccessCount !== undefined
        ? `cumulativeIndependentSuccessCount: ${evidence.cumulativeIndependentSuccessCount}`
        : '',
      evidence.nextHint ? `nextHint: ${evidence.nextHint}` : '',
      evidence.nextHintRoute ? `nextHintRoute: ${evidence.nextHintRoute}` : '',
      evidence.misconceptionId ? `misconceptionId: ${evidence.misconceptionId}` : '',
      evidence.sourceTaskId ? `sourceTaskId: ${evidence.sourceTaskId}` : '',
      evidence.taskId ? `taskId: ${evidence.taskId}` : '',
      evidence.attemptId ? `attemptId: ${evidence.attemptId}` : '',
      evidence.errorCode ? `errorCode: ${evidence.errorCode}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private getLessonLifecyclePrompt(lifecycle: LessonLifecycleDto): string {
    return [
      'Состояние занятия:',
      `lessonSessionId: ${lifecycle.lessonSessionId}`,
      `Статус: ${lifecycle.status}`,
      `Статус цели: ${lifecycle.goalStatus}`,
      `Evidence статуса цели: ${lifecycle.goalStatusEvidence}`,
      `Уровень evidence: ${lifecycle.goalEvidenceLevel}`,
      `Цель занятия: ${lifecycle.lessonGoal}`,
      `Критерии успеха: ${lifecycle.successCriteria.join('; ')}`,
      `Активное время занятия: ${Math.round(lifecycle.activeLearningSeconds / 60)} мин`,
      `Активное время сегодня: ${Math.round(lifecycle.dayActiveLearningSeconds / 60)} мин`,
      `Лимит дня: ${lifecycle.dailyLimit.status}`,
      `Лимит текущего занятия: ${lifecycle.continuousLimit.status}`,
      `Нужен перерыв: ${lifecycle.shouldSuggestBreak ? 'да' : 'нет'}`,
      `Сигнал стратегии: ${lifecycle.strategySignal.direction}; ${lifecycle.strategySignal.summary}; ${lifecycle.strategySignal.recommendedAdjustment}`,
    ].join('\n');
  }

  private getLessonDecisionPrompt(decisionResult: LessonDecisionResult): string {
    return [
      'Lesson Decision:',
      JSON.stringify({
        actions: decisionResult.decision.actions,
        evidenceLevel: decisionResult.decision.evidenceLevel,
        confidence: decisionResult.decision.confidence,
        reason: decisionResult.decision.reason,
        acceptedActions: decisionResult.policy.acceptedActions,
        rejectedActions: decisionResult.policy.rejectedActions,
        goalCompletion: decisionResult.policy.goalCompletion,
        recommendedNextAction: decisionResult.policy.recommendedNextAction,
        verifierResult: decisionResult.policy.verifierResult,
      }),
    ].join('\n');
  }

  private mergeModelLifecycle(
    lifecycle: LessonLifecycleDto,
    parsed: Record<string, unknown>,
  ): LessonLifecycleDto {
    const modelLifecycle = this.pickObject(parsed, ['lessonLifecycle', 'lesson_lifecycle']);
    const goalStatus = this.normalizeGoalStatus(
      this.pickString(modelLifecycle, ['goalStatus', 'goal_status']) ??
        this.pickString(parsed, ['goalStatus', 'goal_status']),
    );
    const finishReason =
      this.pickString(modelLifecycle, ['finishReason', 'finish_reason']) ??
      this.pickString(parsed, ['finishReason', 'finish_reason']);
    return {
      ...lifecycle,
      goalStatus: goalStatus ?? lifecycle.goalStatus,
      finishReason: finishReason ?? lifecycle.finishReason,
    };
  }

  private buildLimitStopAnswer(
    conversationId: string,
    lessonType: LessonType,
    lifecycle: LessonLifecycleDto,
  ): TutorAnswer {
    const answer =
      lifecycle.finishReason === 'daily_learning_limit_reached'
        ? 'На сегодня лучше остановиться: дневной лимит активного обучения достигнут. Коротко сохрани, где остановились, и вернись после отдыха.'
        : 'Сейчас лучше сделать перерыв: лимит текущего занятия достигнут. Я не буду начинать новый разбор, чтобы не перегружать тебя.';
    return {
      conversationId,
      lessonType,
      lessonLifecycle: lifecycle,
      answer,
      blocks: [{ id: 'text-1', type: 'text', text: answer }],
      tasks: [],
      examples: [],
      needsImage: false,
      citations: [],
    };
  }

  private normalizeMessage(message: string | undefined): string {
    const normalized = message?.trim();
    if (!normalized) {
      throw new BadRequestException('Message is required');
    }
    if (normalized.length > 8_000) {
      throw new BadRequestException('Message is too long');
    }
    return normalized;
  }

  private normalizeRequestId(requestId: string | undefined): string | undefined {
    const normalized = requestId?.trim();
    if (!normalized) {
      return undefined;
    }
    if (!/^[a-zA-Z0-9._:-]{8,120}$/.test(normalized)) {
      throw new BadRequestException('requestId must be 8-120 safe identifier characters');
    }
    return normalized;
  }

  private normalizePositiveInteger(
    value: string | undefined,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const parsed = Number.parseInt(value ?? '', 10);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, parsed));
  }

  private parseStringArray(value: string): string[] {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : [];
    } catch {
      return [];
    }
  }

  private buildTutorDebug(
    curriculum: CurriculumContext,
    decisionResult: LessonDecisionResult,
    verifierEvidence: LessonVerifierEvidence,
  ): TutorAnswer['debug'] {
    return {
      curriculum: {
        topicId: curriculum.topicId,
        topicTitle: curriculum.topicTitle,
        skillId: curriculum.skillId,
        skillTitle: curriculum.skillTitle,
        taskTypeId: curriculum.taskTypeId,
        taskTypeTitle: curriculum.taskTypeTitle,
      },
      decision: {
        acceptedActions: decisionResult.debug.acceptedActions,
        rejectedActions: decisionResult.debug.rejectedActions.map((result) => ({
          toolName: result.toolName,
          reason: result.reason,
          requiredAction: result.requiredAction,
        })),
        evidenceLevel: decisionResult.debug.evidenceLevel,
        verifierResult: decisionResult.debug.verifierResult,
        recommendedNextAction: decisionResult.debug.recommendedNextAction,
        goalCompletionAccepted: decisionResult.debug.goalCompletionAccepted,
        goalCompletionReason: decisionResult.debug.goalCompletionReason,
        latencyMs: decisionResult.debug.latencyMs,
        fallbackUsed: decisionResult.debug.fallbackUsed,
      },
      verifier: {
        attemptSubmitted: verifierEvidence.attemptSubmitted,
        taskId: verifierEvidence.taskId,
        attemptId: verifierEvidence.attemptId,
        sourceTaskId: verifierEvidence.sourceTaskId,
        result: verifierEvidence.result,
        errorCode: verifierEvidence.errorCode,
        confidence: verifierEvidence.confidence,
        masteryUpdateAllowed: verifierEvidence.masteryUpdateAllowed,
        masteryPolicyReason: verifierEvidence.masteryPolicyReason,
        masteryEvidenceLevel: verifierEvidence.masteryEvidenceLevel,
        currentLessonVerifiedSuccessCount: verifierEvidence.currentLessonVerifiedSuccessCount,
        currentLessonIndependentSuccessCount: verifierEvidence.currentLessonIndependentSuccessCount,
        cumulativeVerifiedSuccessCount: verifierEvidence.cumulativeVerifiedSuccessCount,
        cumulativeIndependentSuccessCount: verifierEvidence.cumulativeIndependentSuccessCount,
        verifiedSuccessCount: verifierEvidence.verifiedSuccessCount,
        independentSuccessCount: verifierEvidence.independentSuccessCount,
        requiredSuccessCount: verifierEvidence.requiredSuccessCount,
        nextHint: verifierEvidence.nextHint,
        nextHintRoute: verifierEvidence.nextHintRoute,
        misconceptionId: verifierEvidence.misconceptionId,
      },
    };
  }

  private normalizeImagePrompt(prompt: string | undefined, context: string | undefined): string {
    const normalized = prompt?.trim();
    if (!normalized) {
      throw new BadRequestException('Image prompt is required');
    }
    const contextLine = context?.trim() ? `Контекст объяснения: ${context.trim()}` : '';
    return [
      'Создай чистую образовательную иллюстрацию для школьника, готовящегося к ЕГЭ по математике.',
      'Без лишнего текста. Если нужны обозначения, используй простые математические метки.',
      normalized,
      contextLine,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildRequestedImagePrompt(message: string, context: string): string | undefined {
    const request = message.trim();
    if (!this.explicitlyRequestsImage(request)) {
      return undefined;
    }
    const trimmedContext = context.trim();
    return [
      `Запрос ученика на визуальное объяснение: ${request.slice(0, 500)}`,
      trimmedContext ? `Контекст ответа: ${trimmedContext.slice(0, 500)}` : undefined,
      'Сделай понятную образовательную схему для ученика 14-16 лет: крупные элементы, простые подписи, без лишнего текста.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private explicitlyRequestsImage(text: string): boolean {
    return (
      /нарис|рисунк|картин|изображ|схем|график|визуал|чертеж|diagram|graph|image|picture|draw|plot|visual/i.test(
        text,
      ) ||
      /покажи.{0,40}(схем|график|рис|картин|изображ|координат|парабол|чертеж)/i.test(text)
    );
  }

  private looksVisual(text: string): boolean {
    return /график|рисунок|схем|координат|геометр|окружност|парабол|треугольник|вектор/i.test(text);
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

  private pickStringArray(
    source: Record<string, unknown> | undefined,
    keys: string[],
  ): string[] | undefined {
    if (!source) {
      return undefined;
    }
    for (const key of keys) {
      const value = source[key];
      if (!Array.isArray(value)) {
        continue;
      }
      const strings = value
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0);
      if (strings.length > 0) {
        return strings;
      }
    }
    return undefined;
  }

  private pickNumber(
    source: Record<string, unknown> | undefined,
    keys: string[],
  ): number | undefined {
    if (!source) {
      return undefined;
    }
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
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

  private normalizeGoalStatus(status: string | undefined): LessonGoalStatus | undefined {
    return status === 'in_progress' ||
      status === 'reached' ||
      status === 'blocked' ||
      status === 'stopped_by_limit'
      ? status
      : undefined;
  }

  private normalizeSessionStatus(
    status: string | undefined,
  ): TutorLessonHistoryItem['status'] | undefined {
    return status === 'active' ||
      status === 'soft_limit_reached' ||
      status === 'hard_limit_reached' ||
      status === 'goal_reached' ||
      status === 'finished'
      ? status
      : undefined;
  }
}
