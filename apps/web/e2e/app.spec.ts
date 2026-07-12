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
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('egmathteacher.locale', 'ru');
  });
});

function fulfillJson(route: Route, json: unknown) {
  return route.fulfill({ status: 200, json });
}

async function mockStudentSession(page: Page, options: { needsOnboarding: boolean }) {
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
  await mockStudentSession(page, { needsOnboarding: true });

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

  await page.getByPlaceholder('Например: объясни задание 12 с производной').fill('Объясни производную');
  await page.getByRole('button', { name: 'Спросить' }).click();

  await expect(page.getByText('Производная показывает скорость изменения.')).toBeVisible();
  await expect(page.getByText('$0.0030').first()).toBeVisible();
  await expect(page.getByText('Мини-задача')).toBeVisible();
  await expect(page.getByText('Касательная показывает скорость изменения в точке')).toBeVisible();
  await expect(page.getByText('ege-derivatives.pdf')).toBeVisible();

  await page.getByRole('button', { name: 'Показать схему' }).click();
  await expect(page.getByAltText('Схема графика функции с касательной в точке')).toBeVisible();
});

test('changing tutor lesson mode starts a fresh conversation request', async ({ page }) => {
  const { tutorRequests } = await mockStudentSession(page, { needsOnboarding: false });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ЕГЭ математика' })).toBeVisible();

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
