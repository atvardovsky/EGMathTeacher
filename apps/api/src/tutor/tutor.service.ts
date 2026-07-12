import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { AiModelService } from '../ai-model/ai-model.service';
import { AuthSession } from '../auth/auth.types';
import { BackgroundAiService } from '../background-ai/background-ai.service';
import { DatabaseService } from '../database/database.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { LessonService } from '../lesson/lesson.service';
import type { LessonGoalStatus, LessonLifecycleDto } from '../lesson/lesson.types';
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
  TutorResponseBlock,
  TutorTask,
  TutorUsageSnapshot,
} from './tutor.types';

interface AnswerMessageOptions {
  user: AuthSession;
  message?: string;
  conversationId?: string;
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
}

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
    private readonly usageService: UsageService,
  ) {}

  async answerMessage(options: AnswerMessageOptions): Promise<TutorAnswer> {
    const message = this.normalizeMessage(options.message);
    const conversationId = options.conversationId?.trim() || `conv_${randomUUID()}`;
    const lessonType = this.normalizeLessonType(options.lessonType) ?? this.inferLessonType(message);
    const lifecycle = this.lessonService.beginTurn({
      userId: options.user.id,
      conversationId,
      lessonType,
    });
    if (lifecycle.shouldStop) {
      const answer = this.buildLimitStopAnswer(conversationId, lessonType, lifecycle);
      this.persistTutorTurn(options.user.id, conversationId, lessonType, message, answer);
      answer.usage = this.usageService.getLessonUsageSnapshot(
        options.user.id,
        lifecycle.lessonSessionId,
      );
      return answer;
    }

    const vectorStoreIds = this.knowledgeService.getActiveVectorStoreIds();
    const studentProfileContext = this.studentProfileService.getTutorContext(options.user.id);
    const response = await this.aiModel.createOperationResponse(
      vectorStoreIds.length > 0 ? 'tutorAnswerWithRag' : 'tutorAnswer',
      this.buildTutorRequest(
        message,
        options.user,
        vectorStoreIds,
        options.source,
        studentProfileContext,
        lessonType,
        lifecycle,
        {
          userId: options.user.id,
          conversationId,
          lessonSessionId: lifecycle.lessonSessionId,
          lessonType,
        },
      ),
    );
    const text = this.extractOutputText(response);
    const answer = this.parseTutorAnswer(text, conversationId, lessonType, lifecycle);
    answer.citations = this.extractCitations(response);
    answer.lessonLifecycle = this.lessonService.completeTurn({
      userId: options.user.id,
      lifecycle: answer.lessonLifecycle,
      goalStatus: answer.lessonLifecycle.goalStatus,
      finishReason: answer.lessonLifecycle.finishReason,
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
    this.persistTutorTurn(options.user.id, conversationId, lessonType, message, answer);
    this.enqueueBackgroundWork(options.user, conversationId, lessonType, message, options.source, answer);
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

    return {
      imageBase64,
      dataUrl: `data:image/png;base64,${imageBase64}`,
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
    lessonType: LessonType,
    lifecycle: LessonLifecycleDto,
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
                this.getLessonLifecyclePrompt(lifecycle),
                studentProfileContext ? studentProfileContext : 'Профиль ученика еще не создан.',
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
      'Учитывай состояние lessonLifecycle: цель, критерии успеха, лимиты времени, рекомендацию перерыва и сигнал прогресса/регресса.',
      'Если lessonLifecycle показывает soft_limit, мягко заверши текущий шаг и не начинай длинную новую тему.',
      'Если цель занятия достигнута, выставь lessonLifecycle.goalStatus="reached", дай короткое резюме и не открывай новую большую тему.',
      'Если прогресс сменился регрессом, поменяй стратегию: меньше шаг, другой пример, визуальная опора или короткая проверка базы.',
      'Планируй ответ как ordered blocks: text, example, task, image. Текст должен работать даже если картинка не будет создана.',
      'Если ученик просит задачу, верни 1-3 task blocks и продублируй их в поле tasks.',
      'Если ученик просит пример или объяснение понятия, верни 1-3 example blocks и продублируй их в поле examples.',
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
    conversationId: string,
    lessonType: LessonType,
    lifecycle: LessonLifecycleDto,
  ): TutorAnswer {
    const parsed = this.parseJsonObject(text);
    if (!parsed) {
      const needsImage = this.looksVisual(text);
      const imagePrompt = needsImage
        ? `Образовательная математическая схема для объяснения: ${text.slice(0, 500)}`
        : undefined;
      const answer = text || 'Не удалось разобрать ответ модели.';
      return {
        conversationId,
        lessonType,
        lessonLifecycle: lifecycle,
        answer,
        blocks: this.buildResponseBlocks(answer, [], [], imagePrompt, needsImage),
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
    const imagePrompt = this.pickString(parsed, ['imagePrompt', 'image_prompt']);
    const initialTasks = this.normalizeTasks(parsed.tasks);
    const initialExamples = this.normalizeExamples(parsed.examples);
    const initialNeedsImage = Boolean(parsed.needsImage ?? parsed.needs_image);
    const blocks = this.completeResponseBlocks(
      answer,
      initialTasks,
      initialExamples,
      parsedBlocks,
      imagePrompt,
      initialNeedsImage,
    );
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
  ): void {
    this.db.run(
      `INSERT INTO tutor_turns (
         id, user_id, conversation_id, lesson_type, prompt, answer_json, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        userId,
        conversationId,
        lessonType,
        prompt,
        JSON.stringify(answer),
        new Date().toISOString(),
      ],
    );
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

  private getLessonLifecyclePrompt(lifecycle: LessonLifecycleDto): string {
    return [
      'Состояние занятия:',
      `lessonSessionId: ${lifecycle.lessonSessionId}`,
      `Статус: ${lifecycle.status}`,
      `Статус цели: ${lifecycle.goalStatus}`,
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
}
