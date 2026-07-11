import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { AiModelService } from '../ai-model/ai-model.service';
import { AuthSession } from '../auth/auth.types';
import { BackgroundAiService } from '../background-ai/background-ai.service';
import { DatabaseService } from '../database/database.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { StudentProfileService } from '../student-profile/student-profile.service';
import { TutorAnswer, TutorCitation, TutorExample, TutorTask } from './tutor.types';

interface AnswerMessageOptions {
  user: AuthSession;
  message?: string;
  conversationId?: string;
  source: 'text' | 'voice';
}

interface GenerateImageOptions {
  prompt?: string;
  context?: string;
}

@Injectable()
export class TutorService {
  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
    private readonly knowledgeService: KnowledgeService,
    private readonly aiModel: AiModelService,
    private readonly studentProfileService: StudentProfileService,
    private readonly backgroundAiService: BackgroundAiService,
  ) {}

  async answerMessage(options: AnswerMessageOptions): Promise<TutorAnswer> {
    const message = this.normalizeMessage(options.message);
    const conversationId = options.conversationId?.trim() || `conv_${randomUUID()}`;
    const vectorStoreIds = this.knowledgeService.getActiveVectorStoreIds();
    const studentProfileContext = this.studentProfileService.getTutorContext(options.user.id);
    const response = await this.aiModel.createResponse(
      this.buildTutorRequest(
        message,
        options.user,
        vectorStoreIds,
        options.source,
        studentProfileContext,
      ),
    );
    const text = this.extractOutputText(response);
    const answer = this.parseTutorAnswer(text, conversationId);
    answer.citations = this.extractCitations(response);
    this.persistTutorTurn(options.user.id, conversationId, message, answer);
    this.enqueueBackgroundWork(options.user, conversationId, message, options.source, answer);
    return answer;
  }

  async generateImage(options: GenerateImageOptions): Promise<{
    imageBase64: string;
    dataUrl: string;
    mimeType: string;
    revisedPrompt?: string;
  }> {
    const prompt = this.normalizeImagePrompt(options.prompt, options.context);
    const model = this.configService.get<string>('ai.openai.imageModel') ?? 'gpt-image-2';
    const response = await this.aiModel.generateImage({
      model,
      prompt,
      size: process.env.OPENAI_IMAGE_SIZE ?? '1024x1024',
      quality: process.env.OPENAI_IMAGE_QUALITY ?? 'low',
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
    };
  }

  private buildTutorRequest(
    message: string,
    user: AuthSession,
    vectorStoreIds: string[],
    source: 'text' | 'voice',
    studentProfileContext: string | undefined,
  ): Record<string, unknown> {
    const model = this.configService.get<string>('ai.openai.responsesModel') ?? 'gpt-5.5';
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
      model,
      instructions: this.getTutorInstructions(vectorStoreIds.length > 0),
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                `Имя ученика: ${user.name}`,
                `Источник запроса: ${source === 'voice' ? 'голос' : 'текст'}`,
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
      'Если ученик просит задачу, верни 1-3 задачи в поле tasks.',
      'Если ученик просит пример или объяснение понятия, верни 1-3 примера в поле examples.',
      'Если рисунок, график, схема или координатная плоскость сильно помогут, поставь needsImage=true и напиши конкретный imagePrompt.',
      hasRag
        ? 'Используй file_search для материалов ЕГЭ, если вопрос связан с программой, типами заданий или правилами.'
        : 'Если материалы ЕГЭ еще не загружены, честно опирайся на общие знания и не выдумывай ссылки.',
      'Верни только валидный JSON без Markdown и без пояснений вокруг него.',
      'Формат JSON: {"answer":"...","tasks":[{"title":"...","prompt":"...","difficulty":"..."}],"examples":[{"title":"...","explanation":"..."}],"needsImage":false,"imagePrompt":""}',
    ].join(' ');
  }

  private parseTutorAnswer(text: string, conversationId: string): TutorAnswer {
    const parsed = this.parseJsonObject(text);
    if (!parsed) {
      return {
        conversationId,
        answer: text || 'Не удалось разобрать ответ модели.',
        tasks: [],
        examples: [],
        needsImage: this.looksVisual(text),
        imagePrompt: this.looksVisual(text)
          ? `Образовательная математическая схема для объяснения: ${text.slice(0, 500)}`
          : undefined,
        citations: [],
      };
    }

    const answer = this.pickString(parsed, ['answer']) ?? text;
    const imagePrompt = this.pickString(parsed, ['imagePrompt', 'image_prompt']);
    return {
      conversationId,
      answer,
      tasks: this.normalizeTasks(parsed.tasks),
      examples: this.normalizeExamples(parsed.examples),
      needsImage: Boolean(parsed.needsImage ?? parsed.needs_image),
      imagePrompt: imagePrompt || undefined,
      citations: [],
    };
  }

  private persistTutorTurn(
    userId: string,
    conversationId: string,
    prompt: string,
    answer: TutorAnswer,
  ): void {
    this.db.run(
      `INSERT INTO tutor_turns (id, user_id, conversation_id, prompt, answer_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [randomUUID(), userId, conversationId, prompt, JSON.stringify(answer), new Date().toISOString()],
    );
  }

  private enqueueBackgroundWork(
    user: AuthSession,
    conversationId: string,
    prompt: string,
    source: 'text' | 'voice',
    answer: TutorAnswer,
  ): void {
    try {
      this.backgroundAiService.enqueueTutorTurnWork({
        userId: user.id,
        userName: user.name,
        conversationId,
        source,
        prompt,
        answer: {
          answer: answer.answer,
          tasksCount: answer.tasks.length,
          examplesCount: answer.examples.length,
          citationsCount: answer.citations.length,
          needsImage: answer.needsImage,
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
}
