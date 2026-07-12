import { BadRequestException, Injectable } from '@nestjs/common';
import { AiModelService } from '../ai-model/ai-model.service';
import { AiOperationKey } from '../ai-model/ai-model.types';
import { AuthSession } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import {
  DiagnosticAnswer,
  StudentOnboardingAnswers,
  StudentProfileDto,
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
  instructions: string;
  inputText: string;
  vectorStoreIds: string[];
  useRag: boolean;
  failureMessage: string;
}

@Injectable()
export class StudentProfileService {
  private readonly sensitiveProfileKeyPattern =
    /diagnos|clinical|medical|health|illness|family|parent|mother|father|address|phone|email|relig|politic|trauma|abuse|диагноз|клиник|медицин|здоров|болез|семь|родител|мам|пап|адрес|телефон|почт|религи|полит|травм|насили/i;

  private readonly sensitiveProfileValuePattern =
    /adhd|autism|bipolar|depression|self-harm|suicide|medical record|my mother|my father|my parents|family problem|сдвг|аутизм|биполяр|депресс|суицид|самоповреж|медицин|моя мама|мой папа|родители|проблемы в семье|насили/i;

  constructor(
    private readonly db: DatabaseService,
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

  async completeOnboarding(
    context: StudentProfileRequestContext,
  ): Promise<StudentProfileStatus> {
    const answers = this.toTeachingOnlyAnswers(this.normalizeAnswers(context.answers));
    const profile = await this.generateProfile(context.user, answers);
    const now = new Date().toISOString();
    const existing = this.getProfile(context.user.id);
    const createdAt = existing?.createdAt ?? now;

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
        context.user.id,
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

    return this.getStatus(context.user);
  }

  private async generateProfile(
    user: AuthSession,
    answers: StudentOnboardingAnswers,
  ): Promise<GeneratedProfile> {
    const vectorStoreIds = this.knowledgeService.getActiveVectorStoreIds();

    const knowledgeParsed = await this.runProfileSpecialist({
      operation: 'onboardingKnowledgeDiagnosis',
      specialist: 'math-knowledge-diagnostician',
      userId: user.id,
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
    const knowledgeState = this.sanitizeTeachingObject(
      this.pickObject(knowledgeParsed, ['knowledgeState', 'knowledge_state']),
    );
    if (Object.keys(knowledgeState).length === 0) {
      throw new BadRequestException('Student knowledge state is missing');
    }

    const psychopedagogicalParsed = await this.runProfileSpecialist({
      operation: 'onboardingPsychopedagogicalProfile',
      specialist: 'psychopedagogical-profiler',
      userId: user.id,
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
    const learningPreferences = this.sanitizeTeachingObject(
      this.pickObject(psychopedagogicalParsed, ['learningPreferences', 'learning_preferences']),
    );
    const psychologicalProfile = this.sanitizeTeachingObject(
      this.pickObject(psychopedagogicalParsed, ['psychologicalProfile', 'psychological_profile']),
    );
    if (Object.keys(learningPreferences).length === 0 || Object.keys(psychologicalProfile).length === 0) {
      throw new BadRequestException('Student learning profile is missing');
    }

    const strategyParsed = await this.runProfileSpecialist({
      operation: 'onboardingStrategyPlan',
      specialist: 'teaching-strategy-planner',
      userId: user.id,
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
    const response = await this.aiModel.createOperationResponse(
      request.operation,
      this.buildProfileRequest(request),
    );
    const text = this.extractOutputText(response);
    const parsed = this.parseJsonObject(text);
    if (!parsed) {
      throw new BadRequestException(request.failureMessage);
    }
    return parsed;
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
