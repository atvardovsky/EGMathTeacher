import { ConfigService } from '@nestjs/config';
import { TutorService } from '../src/tutor/tutor.service';
import { AuthSession } from '../src/auth/auth.types';

describe('TutorService', () => {
  const user: AuthSession = {
    id: 'user-1',
    name: 'Student',
    role: 'student',
    createdAt: new Date().toISOString(),
    iat: 1,
    exp: 9_999_999_999,
  };

  function createService(overrides: Partial<{ response: Record<string, unknown> }> = {}) {
    const db = {
      run: jest.fn(),
    };
    const lifecycle = {
      lessonSessionId: 'lesson-1',
      conversationId: 'conv-1',
      lessonType: 'tutor',
      status: 'active',
      goalStatus: 'in_progress',
      goalStatusEvidence: 'none',
      lessonGoal: 'Дать понятный разбор вопроса и проверить понимание.',
      successCriteria: ['объяснен главный шаг'],
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
        direction: 'unknown',
        summary: 'Пока недостаточно данных.',
        recommendedAdjustment: 'Собирай сигналы понимания.',
      },
    } as const;
    const usageSnapshot = {
      currency: 'USD' as const,
      lesson: {
        estimatedCostUsd: 0.002,
        inputTokens: 900,
        cachedInputTokens: 0,
        outputTokens: 300,
        totalTokens: 1200,
        imageCount: 0,
        pricingConfigured: true,
      },
      today: {
        estimatedCostUsd: 0.002,
        inputTokens: 900,
        cachedInputTokens: 0,
        outputTokens: 300,
        totalTokens: 1200,
        imageCount: 0,
        pricingConfigured: true,
      },
    };
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          'ai.openai.responsesModel': 'gpt-test',
          'ai.openai.imageModel': 'gpt-image-test',
          'ai.openai.imageSize': '1024x1024',
          'ai.openai.imageQuality': 'low',
        };
        return values[key];
      }),
    } as unknown as ConfigService;
    const knowledge = {
      getActiveVectorStoreIds: jest.fn(() => ['vs_test']),
    };
    const aiModel = {
      createOperationResponse: jest.fn(async () =>
        overrides.response ?? {
          output: [
            {
              type: 'message',
              content: [
                {
                  type: 'output_text',
                  text: JSON.stringify({
                    answer: 'Решаем через дискриминант.',
                    blocks: [
                      { type: 'text', text: 'Решаем через дискриминант.' },
                      { type: 'example', title: 'Пример', explanation: 'D = b^2 - 4ac.' },
                      {
                        type: 'task',
                        title: 'Квадратное уравнение',
                        prompt: 'Решите x^2 - 5x + 6 = 0',
                      },
                      {
                        type: 'image',
                        status: 'suggested',
                        prompt: 'Схема параболы',
                        caption: 'Парабола и корни уравнения',
                        altText: 'Схема параболы с двумя корнями',
                        priority: 'important',
                      },
                    ],
                    tasks: [{ title: 'Квадратное уравнение', prompt: 'Решите x^2 - 5x + 6 = 0' }],
                    examples: [{ title: 'Пример', explanation: 'D = b^2 - 4ac.' }],
                    needsImage: true,
                    imagePrompt: 'Схема параболы',
                  }),
                  annotations: [
                    {
                      type: 'file_citation',
                      file_id: 'file_1',
                      filename: 'ege.pdf',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ),
      generateOperationImage: jest.fn(async () => ({
        data: [{ b64_json: 'abc123', revised_prompt: 'diagram' }],
      })),
    };
    const studentProfile = {
      getTutorContext: jest.fn(() => 'Профиль ученика: нужен спокойный темп и примеры.'),
    };
    const backgroundAi = {
      enqueueTutorTurnWork: jest.fn(),
    };
    const lessonService = {
      beginTurn: jest.fn(() => lifecycle),
      completeTurn: jest.fn(({ lifecycle: inputLifecycle, goalStatus }) => ({
        ...inputLifecycle,
        goalStatus,
        status: goalStatus === 'reached' ? 'goal_reached' : inputLifecycle.status,
        shouldStop: goalStatus === 'reached' || inputLifecycle.shouldStop,
      })),
    };
    const usageService = {
      getLessonUsageSnapshot: jest.fn(() => usageSnapshot),
    };

    return {
      service: new TutorService(
        db as any,
        config,
        knowledge as any,
        aiModel as any,
        studentProfile as any,
        backgroundAi as any,
        lessonService as any,
        usageService as any,
      ),
      db,
      aiModel,
      studentProfile,
      backgroundAi,
      lessonService,
      usageService,
      lifecycle,
    };
  }

  it('returns structured tutor output with citations', async () => {
    const { service, db, aiModel, backgroundAi } = createService();

    const result = await service.answerMessage({
      user,
      message: 'Объясни квадратное уравнение',
      conversationId: 'conv-1',
      source: 'text',
    });

    expect(result.answer).toContain('дискриминант');
    expect(result.lessonType).toBe('tutor');
    expect(result.lessonLifecycle.lessonSessionId).toBe('lesson-1');
    expect(result.usage?.lesson.estimatedCostUsd).toBe(0.002);
    expect(result.tasks).toHaveLength(1);
    expect(result.examples).toHaveLength(1);
    expect(result.blocks.map((block) => block.type)).toEqual(['text', 'example', 'task', 'image']);
    expect(result.blocks[3]).toEqual(
      expect.objectContaining({
        id: 'image-1',
        type: 'image',
        prompt: 'Схема параболы',
        caption: 'Парабола и корни уравнения',
        altText: 'Схема параболы с двумя корнями',
        priority: 'important',
        status: 'suggested',
      }),
    );
    expect(result.needsImage).toBe(true);
    expect(result.citations).toEqual([{ fileId: 'file_1', filename: 'ege.pdf', quote: undefined }]);
    expect(db.run).toHaveBeenCalled();
    expect(aiModel.createOperationResponse).toHaveBeenCalledWith(
      'tutorAnswerWithRag',
      expect.objectContaining({
        tools: [expect.objectContaining({ type: 'file_search', vector_store_ids: ['vs_test'] })],
        usageContext: expect.objectContaining({
          userId: user.id,
          conversationId: 'conv-1',
          lessonSessionId: 'lesson-1',
        }),
      }),
    );
    expect(backgroundAi.enqueueTutorTurnWork).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        conversationId: 'conv-1',
        lessonType: 'tutor',
        source: 'text',
        prompt: 'Объясни квадратное уравнение',
        answer: expect.objectContaining({
          tasksCount: 1,
          examplesCount: 1,
          citationsCount: 1,
          needsImage: true,
          goalStatus: 'in_progress',
          shouldStop: false,
        }),
      }),
    );
  });

  it('builds response blocks from legacy tutor output', async () => {
    const { service } = createService({
      response: {
        output_text: JSON.stringify({
          answer: 'Сначала построим график.',
          tasks: [{ title: 'График', prompt: 'Найдите вершину параболы' }],
          examples: [{ title: 'Мини-пример', explanation: 'Для y=x^2 вершина в (0;0).' }],
          needsImage: true,
          imagePrompt: 'Координатная плоскость и парабола',
        }),
      },
    });

    const result = await service.answerMessage({
      user,
      message: 'Покажи график',
      conversationId: 'conv-legacy',
      source: 'text',
    });

    expect(result.lessonType).toBe('visual_explanation');
    expect(result.blocks.map((block) => block.type)).toEqual(['text', 'task', 'example', 'image']);
    expect(result.blocks[3]).toEqual(
      expect.objectContaining({
        id: 'image-1',
        type: 'image',
        prompt: 'Координатная плоскость и парабола',
      }),
    );
  });

  it('adds stored student profile context to tutor prompts', async () => {
    const { service, aiModel, studentProfile } = createService();

    await service.answerMessage({
      user,
      message: 'Объясни производную',
      conversationId: 'conv-profile',
      source: 'text',
      lessonType: 'concept',
    });

    expect(studentProfile.getTutorContext).toHaveBeenCalledWith(user.id);
    expect(JSON.stringify((aiModel.createOperationResponse as jest.Mock).mock.calls[0][1])).toContain(
      'нужен спокойный темп',
    );
    expect(JSON.stringify((aiModel.createOperationResponse as jest.Mock).mock.calls[0][1])).toContain(
      'Состояние занятия',
    );
  });

  it('generates an image data URL', async () => {
    const { service, aiModel } = createService();

    const result = await service.generateImage({
      prompt: 'Парабола y=x^2',
      context: 'Квадратичная функция',
      user,
      conversationId: 'conv-image',
      lessonSessionId: 'lesson-1',
      lessonType: 'visual_explanation',
    });

    expect(result.dataUrl).toBe('data:image/png;base64,abc123');
    expect(aiModel.generateOperationImage).toHaveBeenCalledWith(
      'tutorImage',
      expect.objectContaining({
        prompt: expect.stringContaining('Парабола y=x^2'),
        usageContext: expect.objectContaining({
          userId: user.id,
          lessonSessionId: 'lesson-1',
        }),
      }),
    );
  });

  it('returns a local stop response when the hard learning limit is reached', async () => {
    const { service, aiModel, backgroundAi, lessonService } = createService();
    (lessonService.beginTurn as jest.Mock).mockReturnValueOnce({
      lessonSessionId: 'lesson-hard',
      conversationId: 'conv-hard',
      lessonType: 'tutor',
      status: 'hard_limit_reached',
      goalStatus: 'stopped_by_limit',
      goalStatusEvidence: 'learning_limit',
      lessonGoal: 'Дать понятный разбор вопроса и проверить понимание.',
      successCriteria: ['объяснен главный шаг'],
      finishReason: 'daily_learning_limit_reached',
      turnCount: 9,
      activeLearningSeconds: 7200,
      dayActiveLearningSeconds: 7200,
      dailyLimit: {
        status: 'hard_limit',
        softLimitSeconds: 5400,
        hardLimitSeconds: 7200,
        usedSeconds: 7200,
        remainingSeconds: 0,
      },
      continuousLimit: {
        status: 'ok',
        softLimitSeconds: 2700,
        hardLimitSeconds: 3600,
        usedSeconds: 1200,
        remainingSeconds: 2400,
      },
      shouldSuggestBreak: true,
      shouldStop: true,
      strategySignal: {
        direction: 'stable',
        summary: 'Сигналы стабильны.',
        recommendedAdjustment: 'Остановиться на сегодня.',
      },
    });

    const result = await service.answerMessage({
      user,
      message: 'Еще одна задача',
      conversationId: 'conv-hard',
      source: 'text',
    });

    expect(result.lessonLifecycle.shouldStop).toBe(true);
    expect(result.answer).toContain('дневной лимит');
    expect(aiModel.createOperationResponse).not.toHaveBeenCalled();
    expect(backgroundAi.enqueueTutorTurnWork).not.toHaveBeenCalled();
  });
});
