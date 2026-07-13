import { expect, test, type Page, type Route } from '@playwright/test';

const studentUser = {
  id: 'student-e2e',
  name: 'Маша',
  role: 'student',
  createdAt: '2026-07-11T10:00:00.000Z',
};

const completedProfileStatus = {
  onboardingRequired: false,
  profile: {
    userId: studentUser.id,
    onboardingCompletedAt: '2026-07-11T10:10:00.000Z',
    onboardingAnswers: {
      targetScore: 82,
      currentLevel: 'средне',
      mathFeeling: 'тревожно',
      weakTopics: ['производная'],
      explanationStyle: 'сначала пример',
      pacing: 'медленно',
      visualPreference: true,
      practicePreference: 'после каждой темы',
      analogyInterests: ['техника'],
      diagnosticAnswers: [],
    },
    knowledgeState: {
      overallLevel: { value: 'medium', confidence: 'medium' },
    },
    learningPreferences: {
      explanationStyle: 'example_first',
      visualSupport: true,
    },
    psychologicalProfile: {
      confidenceWithMath: {
        value: 'low',
        confidence: 'medium',
        evidence: ['просит спокойный темп'],
      },
    },
    explanationStrategy: {
      pacing: 'slow',
      structure: 'example_then_rule',
    },
    recentSessionSummaries: [
      {
        id: 'session-summary-1',
        conversationId: 'conv-e2e',
        lessonType: 'tutor',
        summary: { summary: 'Разбирали производную через смысл скорости.' },
        evidenceLevels: { L2: 'сводка сессии', L4: ['стабильный прогресс'] },
        createdAt: '2026-07-11T10:20:00.000Z',
        updatedAt: '2026-07-11T10:20:00.000Z',
      },
    ],
    skillProgress: [
      {
        id: 'skill-progress-1',
        conversationId: 'conv-e2e',
        lessonType: 'tutor',
        topic: 'производная',
        skill: 'смысл производной',
        direction: 'progress',
        confidence: 'medium',
        supportNeeded: 'step_by_step',
        independence: 'medium',
        evidence: { evidence: ['связала производную со скоростью'] },
        createdAt: '2026-07-11T10:20:00.000Z',
      },
    ],
    aiSummary: 'Лучше объяснять через короткий пример, затем правило и проверку понимания.',
    createdAt: '2026-07-11T10:10:00.000Z',
    updatedAt: '2026-07-11T10:10:00.000Z',
  },
};

const transparentPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/axmXrQAAAAASUVORK5CYII=';

const lessonLifecycle = {
  lessonSessionId: 'lesson-e2e',
  conversationId: 'conv-e2e',
  lessonType: 'tutor',
  status: 'active',
  goalStatus: 'in_progress',
  goalStatusEvidence: 'none',
  lessonGoal: 'Дать понятный разбор вопроса и проверить понимание.',
  successCriteria: ['объяснен главный шаг', 'есть мини-задача'],
  turnCount: 1,
  activeLearningSeconds: 120,
  dayActiveLearningSeconds: 120,
  dailyLimit: {
    status: 'ok',
    softLimitSeconds: 5400,
    hardLimitSeconds: 7200,
    usedSeconds: 120,
    remainingSeconds: 7080,
  },
  continuousLimit: {
    status: 'ok',
    softLimitSeconds: 2700,
    hardLimitSeconds: 3600,
    usedSeconds: 120,
    remainingSeconds: 3480,
  },
  shouldSuggestBreak: false,
  shouldStop: false,
  strategySignal: {
    direction: 'progress',
    summary: 'Есть недавний прогресс.',
    recommendedAdjustment: 'Дать чуть больше самостоятельности.',
  },
};

const usageSummary = {
  currency: 'USD',
  today: {
    estimatedCostUsd: 0.003,
    inputTokens: 1200,
    cachedInputTokens: 0,
    outputTokens: 400,
    totalTokens: 1600,
    imageCount: 0,
    pricingConfigured: true,
  },
  currentLesson: {
    lessonSessionId: 'lesson-e2e',
    conversationId: 'conv-e2e',
    lessonType: 'tutor',
    status: 'active',
    goalStatus: 'in_progress',
    total: {
      estimatedCostUsd: 0.003,
      inputTokens: 1200,
      cachedInputTokens: 0,
      outputTokens: 400,
      totalTokens: 1600,
      imageCount: 0,
      pricingConfigured: true,
    },
    items: [
      {
        id: 'usage-1',
        correlationId: 'turn-e2e',
        lessonSessionId: 'lesson-e2e',
        conversationId: 'conv-e2e',
        lessonType: 'tutor',
        operationKey: 'tutorAnswerWithRag',
        operation: 'tutor.answer_with_rag',
        assistantRole: 'tutor',
        provider: 'openai',
        model: 'gpt-test',
        responseFormat: 'json',
        estimatedCostUsd: 0.003,
        inputTokens: 1200,
        cachedInputTokens: 0,
        outputTokens: 400,
        totalTokens: 1600,
        imageCount: 0,
        pricingSource: 'env_default',
        createdAt: '2026-07-11T10:20:00.000Z',
      },
    ],
    decisions: [
      {
        id: 'decision-1',
        correlationId: 'turn-e2e',
        toolName: 'request_student_attempt',
        accepted: true,
        evidenceLevel: 'agent_interpreted',
        verifierResult: 'cannot_verify',
        latencyMs: 18,
        fallbackUsed: false,
        lessonOutcome: 'in_progress',
        createdAt: '2026-07-11T10:20:00.000Z',
      },
    ],
    verifiedOutcomes: 0,
    costPerVerifiedOutcomeUsd: null,
  },
  recentLessons: [],
  backgroundJobs: [
    {
      id: 'job-1',
      type: 'learning_window_analysis',
      status: 'failed',
      conversationId: 'conv-e2e',
      lessonSessionId: 'lesson-e2e',
      attempts: 2,
      errorMessage: 'OpenAI request failed with status 400',
      createdAt: '2026-07-11T10:20:00.000Z',
      updatedAt: '2026-07-11T10:21:00.000Z',
    },
    {
      id: 'job-2',
      type: 'session_summary',
      status: 'succeeded',
      conversationId: 'conv-e2e',
      lessonSessionId: 'lesson-e2e',
      attempts: 1,
      resultPreview: 'Ученик разобрал смысл производной и готов к короткой практике.',
      createdAt: '2026-07-11T10:22:00.000Z',
      updatedAt: '2026-07-11T10:23:00.000Z',
    },
  ],
};

const historyAnswer = {
  conversationId: 'conv-history',
  lessonType: 'practice',
  lessonLifecycle: {
    ...lessonLifecycle,
    conversationId: 'conv-history',
    lessonSessionId: 'lesson-history',
    lessonType: 'practice',
    lessonGoal: 'Продолжить практику линейных уравнений.',
    turnCount: 2,
  },
  answer: 'В прошлый раз мы остановились на линейном уравнении и проверке ответа.',
  blocks: [
    {
      id: 'text-1',
      type: 'text',
      text: 'В прошлый раз мы остановились на линейном уравнении и проверке ответа.',
    },
  ],
  tasks: [],
  examples: [],
  needsImage: false,
  citations: [],
};

const lessonHistory = {
  lessons: [
    {
      lessonSessionId: 'lesson-history',
      conversationId: 'conv-history',
      lessonType: 'practice',
      status: 'active',
      goalStatus: 'in_progress',
      lessonGoal: 'Продолжить практику линейных уравнений.',
      successCriteria: ['есть самостоятельная попытка'],
      turnCount: 2,
      activeLearningSeconds: 360,
      startedAt: '2026-07-12T10:00:00.000Z',
      lastActivityAt: '2026-07-12T10:10:00.000Z',
      updatedAt: '2026-07-12T10:10:00.000Z',
      summary: {
        summary: 'Решали линейное уравнение, следующий шаг - еще одна самостоятельная попытка.',
      },
      evidenceLevels: { L2: 'сводка занятия' },
      turns: [
        {
          id: 'turn-history-1',
          prompt: 'Я решил x = 6, что дальше?',
          lessonType: 'practice',
          source: 'text',
          answer: historyAnswer,
          createdAt: '2026-07-12T10:10:00.000Z',
        },
      ],
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('egmathteacher.locale', 'ru');
    class MockSpeechSynthesisUtterance extends EventTarget {
      text: string;
      lang = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: SpeechSynthesisVoice | null = null;
      onboundary: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => unknown) | null =
        null;
      onend: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => unknown) | null = null;
      onerror: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisErrorEvent) => unknown) | null =
        null;
      onmark: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => unknown) | null =
        null;
      onpause: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => unknown) | null =
        null;
      onresume: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => unknown) | null =
        null;
      onstart: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => unknown) | null =
        null;

      constructor(text: string) {
        super();
        this.text = text;
      }
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: MockSpeechSynthesisUtterance,
      configurable: true,
    });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speaking: false,
        pending: false,
        paused: false,
        speak(utterance: SpeechSynthesisUtterance) {
          (window as Window & { __spokenText?: string }).__spokenText = utterance.text;
          window.setTimeout(() => utterance.onend?.({} as SpeechSynthesisEvent), 0);
        },
        cancel() {
          (window as Window & { __speechCanceled?: boolean }).__speechCanceled = true;
        },
        pause() {},
        resume() {},
        getVoices() {
          return [];
        },
        onvoiceschanged: null,
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return true;
        },
      } satisfies SpeechSynthesis,
      configurable: true,
    });
    class MockSpeechRecognition extends EventTarget {
      continuous = false;
      interimResults = false;
      lang = '';
      onend: (() => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onresult: ((event: Event) => void) | null = null;

      start() {
        const state = window as Window & {
          __recognitionStarts?: number;
          __recognitionLanguage?: string;
          __lastRecognition?: MockSpeechRecognition;
        };
        state.__recognitionStarts = (state.__recognitionStarts ?? 0) + 1;
        state.__recognitionLanguage = this.lang;
        state.__lastRecognition = this;
      }

      stop() {
        this.onend?.();
      }
    }
    Object.defineProperty(window, 'SpeechRecognition', {
      value: MockSpeechRecognition,
      configurable: true,
    });
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      value: MockSpeechRecognition,
      configurable: true,
    });
  });
});

function fulfillJson(route: Route, json: unknown) {
  return route.fulfill({ status: 200, json });
}

async function mockStudentSession(
  page: Page,
  options: { needsOnboarding: boolean; lessonHistory?: unknown },
) {
  let profileStatus = options.needsOnboarding
    ? { onboardingRequired: true, profile: null }
    : completedProfileStatus;
  const tutorRequests: Array<Record<string, unknown>> = [];

  await page.route('**/auth/me', (route) => fulfillJson(route, { user: studentUser }));
  await page.route('**/auth/logout', (route) => fulfillJson(route, {}));
  await page.route('**/student-profile/me', async (route) => {
    if (route.request().method() === 'PUT') {
      profileStatus = completedProfileStatus;
    }
    return fulfillJson(route, profileStatus);
  });
  await page.route('**/tutor/lessons**', (route) =>
    fulfillJson(route, options.lessonHistory ?? { lessons: [] }),
  );
  await page.route('**/usage/me/summary**', (route) => fulfillJson(route, usageSummary));
  await page.route('**/tutor/message', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    tutorRequests.push(body);
    const requestLessonType = typeof body.lessonType === 'string' ? body.lessonType : 'tutor';
    const requestConversationId =
      typeof body.conversationId === 'string' ? body.conversationId : undefined;
    const responseConversationId =
      requestConversationId ?? (requestLessonType === 'practice' ? 'conv-practice' : 'conv-e2e');

    return fulfillJson(route, {
      conversationId: responseConversationId,
      lessonType: requestLessonType,
      lessonLifecycle: {
        ...lessonLifecycle,
        conversationId: responseConversationId,
        lessonSessionId: requestLessonType === 'practice' ? 'lesson-practice' : 'lesson-e2e',
        lessonType: requestLessonType,
      },
      usage: {
        currency: 'USD',
        lesson: usageSummary.currentLesson.total,
        today: usageSummary.today,
      },
      answer: 'Производная показывает скорость изменения. Начнем с простого примера.',
      blocks: [
        {
          id: 'text-1',
          type: 'text',
          text: 'Производная показывает скорость изменения. Начнем с простого примера.',
        },
        {
          id: 'example-1',
          type: 'example',
          title: 'Пример',
          explanation: 'Если f(x)=x^2, то f’(x)=2x.',
        },
        {
          id: 'task-1',
          type: 'task',
          title: 'Мини-задача',
          prompt: 'Найдите производную f(x)=x^2 в точке x=3.',
          difficulty: 'easy',
        },
        {
          id: 'image-1',
          type: 'image',
          status: 'suggested',
          prompt: 'Схема касательной к графику функции',
          caption: 'Касательная показывает скорость изменения в точке',
          altText: 'Схема графика функции с касательной в точке',
          priority: 'important',
        },
      ],
      tasks: [
        {
          title: 'Мини-задача',
          prompt: 'Найдите производную f(x)=x^2 в точке x=3.',
          difficulty: 'easy',
        },
      ],
      examples: [
        {
          title: 'Пример',
          explanation: 'Если f(x)=x^2, то f’(x)=2x.',
        },
      ],
      needsImage: true,
      imagePrompt: 'Схема касательной к графику функции',
      citations: [{ fileId: 'file-1', filename: 'ege-derivatives.pdf' }],
    });
  });
  await page.route('**/tutor/image', (route) =>
    fulfillJson(route, { dataUrl: transparentPng, mimeType: 'image/png', usage: usageSummary }),
  );

  return { tutorRequests };
}

test('auth screen is usable and localized', async ({ page }) => {
  await page.route('**/auth/me', (route) => fulfillJson(route, { user: null }));

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'ЕГЭ Tutor' })).toBeVisible();
  await expect(page.getByLabel('Имя')).toBeVisible();

  await page.getByText('EN').first().click();

  await expect(page.getByRole('heading', { name: 'EGE Tutor' })).toBeVisible();
  await expect(page.getByLabel('Name')).toBeVisible();
});

test('student completes first meeting, asks tutor, and renders a diagram', async ({ page }) => {
  const { tutorRequests } = await mockStudentSession(page, { needsOnboarding: true });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Давай познакомимся' })).toBeVisible();
  await page.getByLabel('Зачем нужен результат').fill('Хочу закрыть пробелы перед ЕГЭ');
  await page.getByRole('button', { name: 'Дальше' }).click();
  await expect(page.getByText('Как сейчас с математикой?')).toBeVisible();
  await page.getByRole('button', { name: 'Дальше' }).click();
  await expect(page.getByText('Где чаще застреваешь?')).toBeVisible();
  await page.getByRole('button', { name: 'Дальше' }).click();
  await expect(page.getByText('Пара коротких заданий нужна')).toBeVisible();
  await page.getByPlaceholder('Можно ответить как получается').first().fill('x = 6');
  await page.getByRole('button', { name: 'Настроить репетитора' }).click();

  await expect(page.getByRole('heading', { name: 'ЕГЭ математика' })).toBeVisible();
  await expect(page.getByText('профиль объяснений активен')).toBeVisible();
  await expect(page.getByText('Расходы занятия')).toBeVisible();
  await expect(page.getByLabel('Голосовой диалог')).toBeVisible();
  await expect(page.getByText('Сохраненных занятий пока нет')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Начать первое занятие' })).toBeVisible();
  await expect(page.getByText('Первая встреча')).toBeVisible();
  await expect(page.getByText('Проверка уровня')).toBeVisible();
  await expect(page.getByText('Практика: уравнения')).toBeVisible();

  await page.getByRole('button', { name: 'Начать первое занятие' }).click();

  await expect(page.getByText('Производная показывает скорость изменения.')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as Window & { __spokenText?: string }).__spokenText))
    .toContain('Производная показывает скорость изменения');
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { __recognitionStarts?: number }).__recognitionStarts ?? 0),
    )
    .toBe(1);
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { __recognitionLanguage?: string }).__recognitionLanguage),
    )
    .toBe('ru-RU');
  await expect(
    page.getByText('Слушаю тебя. Если будет длинная пауза, браузер может выключить микрофон.'),
  ).toBeVisible();
  await page.evaluate(() => {
    const state = window as Window & {
      __lastRecognition?: { onerror: ((event: Event) => void) | null };
    };
    const event = new Event('error') as Event & { error: string };
    Object.defineProperty(event, 'error', { value: 'no-speech' });
    state.__lastRecognition?.onerror?.(event);
  });
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { __recognitionStarts?: number }).__recognitionStarts ?? 0),
    )
    .toBe(2);
  await page.evaluate(() => {
    const state = window as Window & {
      __lastRecognition?: { onerror: ((event: Event) => void) | null };
    };
    const event = new Event('error') as Event & { error: string };
    Object.defineProperty(event, 'error', { value: 'no-speech' });
    state.__lastRecognition?.onerror?.(event);
  });
  await expect(page.getByText('Микрофон остановился из-за паузы или тишины.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Озвучить' })).toBeVisible();
  await expect.poll(() => tutorRequests.length).toBe(1);
  expect(tutorRequests[0]).toMatchObject({ lessonType: 'meeting' });
  await expect(page.getByText('$0.0030').first()).toBeVisible();
  await expect(
    page.locator('.usage-bar').getByRole('button', { name: 'Обновить' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Детали' }).click();
  await expect(page.getByText('Фоновые задачи')).toBeVisible();
  await expect(page.getByText('learning_window_analysis')).toBeVisible();
  await expect(page.getByText('OpenAI request failed with status 400')).toBeVisible();
  await expect(
    page.getByText('Ученик разобрал смысл производной и готов к короткой практике.'),
  ).toBeVisible();
  await expect(page.getByText('Мини-задача')).toBeVisible();
  await expect(page.getByText('Касательная показывает скорость изменения в точке')).toBeVisible();
  await expect(page.getByText('ege-derivatives.pdf')).toBeVisible();

  await page.getByRole('button', { name: 'Создать схему' }).click();
  await expect(page.getByAltText('Схема графика функции с касательной в точке')).toBeVisible();
});

test('student sees saved lessons and continues the previous discussion', async ({ page }) => {
  const { tutorRequests } = await mockStudentSession(page, {
    needsOnboarding: false,
    lessonHistory,
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'ЕГЭ математика' })).toBeVisible();
  await expect(page.getByText('Продолжить с прошлого занятия')).toBeVisible();
  await expect(page.getByText('Продолжить практику линейных уравнений.')).toBeVisible();
  await expect(page.getByText('Я решил x = 6, что дальше?')).toHaveCount(2);
  await expect(
    page.getByText('В прошлый раз мы остановились на линейном уравнении').first(),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'К открытому занятию' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'К открытому занятию' }).first().click();

  await expect(page.getByText('Сохраненное занятие открыто.')).toBeVisible();
  await expect(page.getByPlaceholder('Например: объясни задание 12 с производной')).toBeFocused();

  await page.getByLabel('Голосовой диалог').uncheck();
  await page
    .getByPlaceholder('Например: объясни задание 12 с производной')
    .fill('Продолжим с места, где остановились');
  await page.getByRole('button', { name: 'Спросить' }).click();

  await expect.poll(() => tutorRequests.length).toBe(1);
  expect(tutorRequests[0]).toMatchObject({
    conversationId: 'conv-history',
    lessonType: 'practice',
  });
});

test('changing tutor lesson mode starts a fresh conversation request', async ({ page }) => {
  const { tutorRequests } = await mockStudentSession(page, { needsOnboarding: false });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ЕГЭ математика' })).toBeVisible();

  await page.getByLabel('Голосовой диалог').uncheck();
  await page.getByPlaceholder('Например: объясни задание 12 с производной').fill('Объясни производную');
  await page.getByRole('button', { name: 'Спросить' }).click();
  await expect(page.getByText('Производная показывает скорость изменения.')).toBeVisible();

  await page.locator('label').filter({ hasText: /^Практика$/ }).click();
  await page.getByPlaceholder('Например: объясни задание 12 с производной').fill('Дай похожую задачу');
  await page.getByRole('button', { name: 'Спросить' }).click();

  await expect.poll(() => tutorRequests.length).toBe(2);
  expect(tutorRequests[0]).toMatchObject({ lessonType: 'tutor' });
  expect(tutorRequests[1]).toMatchObject({ lessonType: 'practice' });
  expect(tutorRequests[1]).not.toHaveProperty('conversationId');
});
