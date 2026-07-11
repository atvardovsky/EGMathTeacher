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
    aiSummary: 'Лучше объяснять через короткий пример, затем правило и проверку понимания.',
    createdAt: '2026-07-11T10:10:00.000Z',
    updatedAt: '2026-07-11T10:10:00.000Z',
  },
};

const transparentPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/axmXrQAAAAASUVORK5CYII=';

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

  await page.route('**/auth/me', (route) => fulfillJson(route, { user: studentUser }));
  await page.route('**/auth/logout', (route) => fulfillJson(route, {}));
  await page.route('**/student-profile/me', async (route) => {
    if (route.request().method() === 'PUT') {
      profileStatus = completedProfileStatus;
    }
    return fulfillJson(route, profileStatus);
  });
  await page.route('**/tutor/message', async (route) =>
    fulfillJson(route, {
      conversationId: 'conv-e2e',
      answer: 'Производная показывает скорость изменения. Начнем с простого примера.',
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
    }),
  );
  await page.route('**/tutor/image', (route) =>
    fulfillJson(route, { dataUrl: transparentPng, mimeType: 'image/png' }),
  );
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

  await page.getByPlaceholder('Например: объясни задание 12 с производной').fill('Объясни производную');
  await page.getByRole('button', { name: 'Спросить' }).click();

  await expect(page.getByText('Производная показывает скорость изменения.')).toBeVisible();
  await expect(page.getByText('Мини-задача')).toBeVisible();
  await expect(page.getByText('ege-derivatives.pdf')).toBeVisible();

  await page.getByRole('button', { name: 'Показать схему' }).click();
  await expect(page.getByAltText('Математическая схема')).toBeVisible();
});
