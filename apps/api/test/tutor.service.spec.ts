import { ConfigService } from '@nestjs/config';
import { TutorService } from '../src/tutor/tutor.service';
import { AuthSession } from '../src/auth/auth.types';
import { LessonBoundaryRejectedException } from '../src/lesson/lesson.service';

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
      get: jest.fn(),
      run: jest.fn(),
      all: jest.fn((_sql: string, _params?: unknown[]) => [] as Record<string, unknown>[]),
    };
    const lifecycle = {
      lessonSessionId: 'lesson-1',
      conversationId: 'conv-1',
      lessonType: 'tutor',
      status: 'active',
      goalStatus: 'in_progress',
      goalStatusEvidence: 'none',
      goalEvidenceLevel: 'none',
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
      enqueueLessonClosureReview: jest.fn(),
    };
    const lessonService = {
      beginTurnWithTransitions: jest.fn(() => ({
        lifecycle,
        closedSessions: [],
      })),
      completeTurn: jest.fn(({ lifecycle: inputLifecycle, goalStatus }) => ({
        ...inputLifecycle,
        goalStatus,
        status: goalStatus === 'reached' ? 'goal_reached' : inputLifecycle.status,
        shouldStop: goalStatus === 'reached' || inputLifecycle.shouldStop,
      })),
      finishSessionWithTransition: jest.fn(() => ({
        transitioned: true,
        session: {
          id: 'lesson-finished',
          user_id: user.id,
          conversation_id: 'conv-finished',
          lesson_type: 'practice',
          status: 'finished',
          goal_status: 'in_progress',
          goal_text: 'Продолжить практику.',
          success_criteria_json: JSON.stringify(['самостоятельная попытка']),
          finish_reason: 'student_finished_lesson',
          active_learning_seconds: 360,
          turn_count: 2,
          started_at: '2026-07-12T10:00:00.000Z',
          last_activity_at: '2026-07-12T10:10:00.000Z',
          finished_at: '2026-07-12T10:12:00.000Z',
          created_at: '2026-07-12T10:00:00.000Z',
          updated_at: '2026-07-12T10:12:00.000Z',
        },
      })),
    };
    const lessonDecision = {
      decide: jest.fn(async () => ({
        decision: {
          id: 'decision-1',
          actions: [
            {
              name: 'request_student_attempt',
              reason: 'Need an independent attempt.',
              expectedEvidence: 'attempt_submitted',
              confidence: 'medium',
            },
          ],
          evidenceLevel: 'agent_interpreted',
          confidence: 'medium',
          reason: 'Continue lesson and request a short attempt.',
          verifierResult: 'cannot_verify',
        },
        policy: {
          decisionId: 'decision-1',
          evidenceLevel: 'agent_interpreted',
          actionResults: [
            {
              toolName: 'request_student_attempt',
              accepted: true,
              reason: 'Teaching action is allowed.',
              evidenceLevel: 'agent_interpreted',
            },
          ],
          acceptedActions: ['request_student_attempt'],
          rejectedActions: [],
          goalCompletion: {
            proposed: false,
            accepted: false,
            reason: 'No goal-completion action was proposed.',
            evidenceLevel: 'agent_interpreted',
          },
          shouldSuggestBreak: false,
          goalBlocked: false,
          recommendedNextAction: 'request_student_attempt',
          verifierResult: 'cannot_verify',
        },
        debug: {
          decisionId: 'decision-1',
          acceptedActions: ['request_student_attempt'],
          rejectedActions: [],
          evidenceLevel: 'agent_interpreted',
          verifierResult: 'cannot_verify',
          recommendedNextAction: 'request_student_attempt',
          goalCompletionAccepted: false,
          goalCompletionReason: 'No goal-completion action was proposed.',
          latencyMs: 12,
          fallbackUsed: false,
        },
      })),
    };
    const usageService = {
      getLessonUsageSnapshot: jest.fn(() => usageSnapshot),
    };
    const curriculum = {
      resolve: jest.fn(() => ({
        topicId: 'algebra.quadratic_equations',
        topicTitle: 'Квадратные уравнения',
        skillId: 'algebra.quadratic.discriminant',
        skillTitle: 'Дискриминант',
        taskTypeId: 'ege.base.quadratic_roots',
        taskTypeTitle: 'ЕГЭ: корни квадратного уравнения',
        verifierKind: 'unsupported',
        confidence: 'high',
      })),
    };
    const mathVerifier = {
      verifyPendingTaskAttempt: jest.fn(() => ({
        attemptSubmitted: false,
        result: 'none',
        confidence: 'unknown',
        masteryUpdateAllowed: false,
      })),
      ensureBackendTask: jest.fn(),
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
        lessonDecision as any,
        usageService as any,
        curriculum as any,
        mathVerifier as any,
      ),
      db,
      aiModel,
      studentProfile,
      backgroundAi,
      lessonService,
      lessonDecision,
      usageService,
      curriculum,
      mathVerifier,
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
    expect(JSON.stringify((aiModel.createOperationResponse as jest.Mock).mock.calls[0][1])).toContain(
      'Lesson Decision',
    );
    expect(JSON.stringify((aiModel.createOperationResponse as jest.Mock).mock.calls[0][1])).toContain(
      'Curriculum context',
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

  it('adds an image block when the student explicitly asks for a visual', async () => {
    const { service } = createService({
      response: {
        output_text: JSON.stringify({
          answer: 'Покажу идею через короткое объяснение.',
          blocks: [{ type: 'text', text: 'Покажу идею через короткое объяснение.' }],
          tasks: [],
          examples: [],
          needsImage: false,
        }),
      },
    });

    const result = await service.answerMessage({
      user,
      message: 'Нарисуй схему параболы с корнями',
      conversationId: 'conv-explicit-image',
      source: 'text',
    });

    const imageBlock = result.blocks.find((block) => block.type === 'image');
    expect(result.lessonType).toBe('visual_explanation');
    expect(result.needsImage).toBe(true);
    expect(result.imagePrompt).toContain('Нарисуй схему параболы с корнями');
    expect(imageBlock).toEqual(
      expect.objectContaining({
        id: 'image-1',
        type: 'image',
        priority: 'required',
        prompt: expect.stringContaining('Нарисуй схему параболы с корнями'),
      }),
    );
  });

  it('adds a context-generated image block for task answers without requiring a prompt', async () => {
    const { service } = createService({
      response: {
        output_text: JSON.stringify({
          answer: 'Давай закрепим короткой задачей.',
          blocks: [{ type: 'text', text: 'Давай закрепим короткой задачей.' }],
          tasks: [
            {
              title: 'Линейное уравнение',
              prompt: 'Реши 2x + 3 = 15',
              difficulty: 'foundation',
            },
          ],
          examples: [],
          needsImage: false,
        }),
      },
    });

    const result = await service.answerMessage({
      user,
      message: 'Дай задачу по линейным уравнениям',
      conversationId: 'conv-task-visual',
      source: 'text',
      lessonType: 'practice',
    });

    const imageBlock = result.blocks.find((block) => block.type === 'image');
    expect(result.needsImage).toBe(true);
    expect(result.imagePrompt).toBeUndefined();
    expect(imageBlock).toEqual(
      expect.objectContaining({
        id: 'image-1',
        type: 'image',
        priority: 'required',
        caption: 'Схема к задаче: Линейное уравнение',
      }),
    );
    expect(imageBlock && 'prompt' in imageBlock ? imageBlock.prompt : undefined).toBeUndefined();
  });

  it('persists generated image URLs into the stored tutor turn block', async () => {
    const { service, db } = createService();
    db.get.mockReturnValue({
      id: 'turn-1',
      prompt: 'Покажи схему пересечения графика с Ox',
      answer_json: JSON.stringify({
        conversationId: 'conv-image',
        lessonType: 'visual_explanation',
        answer: 'Покажу схему.',
        blocks: [
          {
            id: 'image-1',
            type: 'image',
            status: 'suggested',
            prompt: 'Схема пересечения графика с Ox',
            caption: 'График и Ox',
            altText: 'График пересекает ось Ox',
            priority: 'required',
          },
        ],
        tasks: [],
        examples: [],
        needsImage: true,
        citations: [],
      }),
    });

    const result = await service.generateImage({
      user,
      prompt: 'Схема пересечения графика с Ox',
      conversationId: 'conv-image',
      lessonSessionId: 'lesson-1',
      lessonType: 'visual_explanation',
      turnId: 'turn-1',
      blockId: 'image-1',
    });

    expect(result.dataUrl).toBe('data:image/png;base64,abc123');
    const updateCall = db.run.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE tutor_turns'),
    );
    expect(updateCall).toBeDefined();
    const savedAnswer = JSON.parse(String(updateCall?.[1][0]));
    expect(savedAnswer.blocks[0]).toEqual(
      expect.objectContaining({
        id: 'image-1',
        status: 'ready',
        url: 'data:image/png;base64,abc123',
      }),
    );
  });

  it('generates an image from stored answer and task context when prompt is omitted', async () => {
    const { service, aiModel, db } = createService();
    db.get.mockReturnValue({
      id: 'turn-1',
      prompt: 'Дай задачу по линейным уравнениям',
      answer_json: JSON.stringify({
        conversationId: 'conv-image-context',
        lessonType: 'practice',
        answer: 'Реши уравнение и проверь подстановкой.',
        blocks: [
          {
            id: 'task-1',
            type: 'task',
            title: 'Линейное уравнение',
            prompt: 'Реши 2x + 3 = 15',
            difficulty: 'foundation',
          },
          {
            id: 'image-1',
            type: 'image',
            status: 'suggested',
            caption: 'Схема к задаче: Линейное уравнение',
            altText: 'Визуальная схема для условия: Реши 2x + 3 = 15',
            priority: 'required',
          },
        ],
        tasks: [
          {
            title: 'Линейное уравнение',
            prompt: 'Реши 2x + 3 = 15',
            difficulty: 'foundation',
          },
        ],
        examples: [],
        needsImage: true,
        citations: [],
      }),
    });

    const result = await service.generateImage({
      user,
      context: 'Нужно показать перенос 3 и деление на 2.',
      conversationId: 'conv-image-context',
      lessonSessionId: 'lesson-1',
      lessonType: 'practice',
      turnId: 'turn-1',
      blockId: 'image-1',
    });

    expect(result.dataUrl).toBe('data:image/png;base64,abc123');
    expect(aiModel.generateOperationImage).toHaveBeenCalledWith(
      'tutorImage',
      expect.objectContaining({
        prompt: expect.stringContaining('Реши 2x + 3 = 15'),
      }),
    );
    expect(String((aiModel.generateOperationImage as jest.Mock).mock.calls[0][1].prompt)).toContain(
      'Сгенерируй визуальную опору по контексту урока',
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

  it('adds recent conversation context to tutor prompts when continuing', async () => {
    const { service, aiModel, db } = createService();
    db.all.mockImplementation((sql: string) => {
      if (sql.includes('FROM tutor_turns')) {
        return [
          {
            prompt: 'Я остановился на x = 6',
            answer_json: JSON.stringify({
              answer: 'Да, это верный шаг. Следующий шаг - проверить подстановкой.',
              lessonLifecycle: { goalStatus: 'in_progress' },
            }),
            lesson_type: 'practice',
            created_at: '2026-07-12T10:00:00.000Z',
          },
        ];
      }
      if (sql.includes('FROM student_session_summaries')) {
        return [
          {
            conversation_id: 'conv-profile',
            lesson_type: 'practice',
            summary_json: JSON.stringify({ summary: 'Практика линейных уравнений.' }),
            evidence_levels_json: JSON.stringify({ L2: 'summary' }),
            created_at: '2026-07-12T10:05:00.000Z',
          },
        ];
      }
      return [];
    });

    await service.answerMessage({
      user,
      message: 'Продолжим',
      conversationId: 'conv-profile',
      source: 'text',
      lessonType: 'practice',
    });

    const requestText = JSON.stringify((aiModel.createOperationResponse as jest.Mock).mock.calls[0][1]);
    expect(requestText).toContain('Контекст продолжения из SQLite');
    expect(requestText).toContain('Я остановился на x = 6');
    expect(requestText).toContain('Практика линейных уравнений');
  });

  it('returns recent lesson history with stored tutor turns', () => {
    const { service, db } = createService();
    db.all
      .mockReturnValueOnce([
        {
          id: 'lesson-history',
          conversation_id: 'conv-history',
          lesson_type: 'practice',
          status: 'active',
          goal_status: 'in_progress',
          goal_text: 'Продолжить практику.',
          success_criteria_json: JSON.stringify(['самостоятельная попытка']),
          finish_reason: null,
          active_learning_seconds: 360,
          turn_count: 2,
          started_at: '2026-07-12T10:00:00.000Z',
          last_activity_at: '2026-07-12T10:10:00.000Z',
          updated_at: '2026-07-12T10:10:00.000Z',
        },
      ])
      .mockReturnValueOnce([
        {
          id: 'turn-history',
          prompt: 'Я решил x = 6',
          answer_json: JSON.stringify({
            conversationId: 'conv-history',
            lessonType: 'practice',
            lessonLifecycle: {
              lessonSessionId: 'lesson-history',
              conversationId: 'conv-history',
              lessonType: 'practice',
              status: 'active',
              goalStatus: 'in_progress',
              goalStatusEvidence: 'none',
              goalEvidenceLevel: 'none',
              lessonGoal: 'Продолжить практику.',
              successCriteria: ['самостоятельная попытка'],
              turnCount: 2,
              activeLearningSeconds: 360,
              dayActiveLearningSeconds: 360,
              dailyLimit: { status: 'ok', softLimitSeconds: 5400, hardLimitSeconds: 7200, usedSeconds: 360, remainingSeconds: 6840 },
              continuousLimit: { status: 'ok', softLimitSeconds: 2700, hardLimitSeconds: 3600, usedSeconds: 360, remainingSeconds: 3240 },
              shouldSuggestBreak: false,
              shouldStop: false,
              strategySignal: { direction: 'stable', summary: 'Стабильно.', recommendedAdjustment: 'Продолжать.' },
            },
            answer: 'Верно, дальше проверяем подстановкой.',
            blocks: [{ id: 'text-1', type: 'text', text: 'Верно, дальше проверяем подстановкой.' }],
            tasks: [],
            examples: [],
            needsImage: false,
            citations: [],
          }),
          lesson_type: 'practice',
          created_at: '2026-07-12T10:10:00.000Z',
        },
      ]);
    db.get.mockReturnValueOnce({
      summary_json: JSON.stringify({ summary: 'Решали линейное уравнение.' }),
      evidence_levels_json: JSON.stringify({ L2: 'summary' }),
    });

    const history = service.getLessonHistory({ user });

    expect(history.lessons).toHaveLength(1);
    expect(history.lessons[0]).toEqual(
      expect.objectContaining({
        lessonSessionId: 'lesson-history',
        conversationId: 'conv-history',
        lessonType: 'practice',
        summary: { summary: 'Решали линейное уравнение.' },
      }),
    );
    expect(history.lessons[0].turns[0]).toEqual(
      expect.objectContaining({
        id: 'turn-history',
        prompt: 'Я решил x = 6',
        lessonType: 'practice',
        answer: expect.objectContaining({ answer: 'Верно, дальше проверяем подстановкой.' }),
      }),
    );
  });

  it('scopes lesson history into active and historical sessions', () => {
    const { service, db } = createService();

    service.getLessonHistory({ user, scope: 'active' });

    expect(db.all).toHaveBeenCalledTimes(1);
    expect(String(db.all.mock.calls[0][0])).toContain('status NOT IN');

    db.all.mockClear();
    service.getLessonHistory({ user, scope: 'history' });

    expect(String(db.all.mock.calls[0][0])).toContain('status IN');
    expect(String(db.all.mock.calls[1][0])).toContain('FROM tutor_turns latest');
  });

  it('finishes an active lesson, queues closure analysis, and returns the archived history item', () => {
    const { service, lessonService, backgroundAi } = createService();

    const finished = service.finishLesson({
      user,
      lessonSessionId: 'lesson-finished',
    });

    expect(lessonService.finishSessionWithTransition).toHaveBeenCalledWith({
      userId: user.id,
      lessonSessionId: 'lesson-finished',
      reason: 'student_finished_lesson',
    });
    expect(backgroundAi.enqueueLessonClosureReview).toHaveBeenCalledWith({
      userId: user.id,
      conversationId: 'conv-finished',
      lessonSessionId: 'lesson-finished',
      lessonType: 'practice',
      finishReason: 'student_finished_lesson',
    });
    expect(finished).toEqual(
      expect.objectContaining({
        lessonSessionId: 'lesson-finished',
        conversationId: 'conv-finished',
        lessonType: 'practice',
        status: 'finished',
        finishReason: 'student_finished_lesson',
      }),
    );
  });

  it('does not queue closure analysis when finish is called on an already terminal lesson', () => {
    const { service, lessonService, backgroundAi } = createService();
    (lessonService.finishSessionWithTransition as jest.Mock).mockReturnValueOnce({
      transitioned: false,
      session: {
        id: 'lesson-finished',
        user_id: user.id,
        conversation_id: 'conv-finished',
        lesson_type: 'practice',
        status: 'finished',
        goal_status: 'in_progress',
        goal_text: 'Продолжить практику.',
        success_criteria_json: JSON.stringify(['самостоятельная попытка']),
        finish_reason: 'student_finished_lesson',
        active_learning_seconds: 360,
        turn_count: 2,
        started_at: '2026-07-12T10:00:00.000Z',
        last_activity_at: '2026-07-12T10:10:00.000Z',
        finished_at: '2026-07-12T10:12:00.000Z',
        created_at: '2026-07-12T10:00:00.000Z',
        updated_at: '2026-07-12T10:12:00.000Z',
      },
    });

    service.finishLesson({
      user,
      lessonSessionId: 'lesson-finished',
    });

    expect(backgroundAi.enqueueLessonClosureReview).not.toHaveBeenCalled();
  });

  it('queues closure analysis only for sessions confirmed by beginTurn transitions', async () => {
    const { service, lessonService, backgroundAi } = createService();
    (lessonService.beginTurnWithTransitions as jest.Mock).mockReturnValueOnce({
      lifecycle: {
        lessonSessionId: 'lesson-new',
        conversationId: 'conv-new',
        lessonType: 'tutor',
        status: 'active',
        goalStatus: 'in_progress',
        goalStatusEvidence: 'none',
        goalEvidenceLevel: 'none',
        lessonGoal: 'Дать понятный разбор вопроса и проверить понимание.',
        successCriteria: ['объяснен главный шаг'],
        turnCount: 1,
        activeLearningSeconds: 0,
        dayActiveLearningSeconds: 0,
        dailyLimit: { status: 'ok', softLimitSeconds: 5400, hardLimitSeconds: 7200, usedSeconds: 0, remainingSeconds: 7200 },
        continuousLimit: { status: 'ok', softLimitSeconds: 2700, hardLimitSeconds: 3600, usedSeconds: 0, remainingSeconds: 3600 },
        shouldSuggestBreak: false,
        shouldStop: false,
        strategySignal: {
          direction: 'unknown',
          summary: 'Пока недостаточно данных.',
          recommendedAdjustment: 'Собирай сигналы понимания.',
        },
      },
      closedSessions: [
        {
          id: 'lesson-old',
          user_id: user.id,
          conversation_id: 'conv-old',
          lesson_type: 'practice',
          status: 'finished',
          goal_status: 'in_progress',
          goal_text: 'Практика.',
          success_criteria_json: JSON.stringify(['попытка']),
          finish_reason: 'superseded_by_new_lesson_session',
          active_learning_seconds: 120,
          turn_count: 1,
          started_at: '2026-07-12T10:00:00.000Z',
          last_activity_at: '2026-07-12T10:02:00.000Z',
          finished_at: '2026-07-12T10:03:00.000Z',
          created_at: '2026-07-12T10:00:00.000Z',
          updated_at: '2026-07-12T10:02:00.000Z',
        },
      ],
    });

    await service.answerMessage({
      user,
      message: 'Начнем новую тему',
      conversationId: 'conv-new',
      source: 'text',
    });

    expect(backgroundAi.enqueueLessonClosureReview).toHaveBeenCalledWith({
      userId: user.id,
      conversationId: 'conv-old',
      lessonSessionId: 'lesson-old',
      lessonType: 'practice',
      finishReason: 'superseded_by_new_lesson_session',
    });
  });

  it('does not queue closure analysis when a terminal conversation reject closes nothing', async () => {
    const { service, lessonService, backgroundAi } = createService();
    (lessonService.beginTurnWithTransitions as jest.Mock).mockImplementationOnce(() => {
      throw new LessonBoundaryRejectedException(
        'Finished lesson conversations cannot be reopened. Start a new lesson.',
      );
    });

    await expect(
      service.answerMessage({
        user,
        message: 'Продолжим старое занятие',
        conversationId: 'conv-finished',
        source: 'text',
      }),
    ).rejects.toThrow('Finished lesson conversations cannot be reopened');

    expect(backgroundAi.enqueueLessonClosureReview).not.toHaveBeenCalled();
  });

  it('returns legacy tutor-turn conversations when no lesson session exists', () => {
    const { service, db } = createService();
    db.all
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        {
          conversation_id: 'conv-legacy-history',
          lesson_type: 'tutor',
          prompt: 'Объясни производную',
          answer_json: JSON.stringify({
            conversationId: 'conv-legacy-history',
            lessonType: 'tutor',
            answer: 'Говорили про производную как скорость изменения.',
            blocks: [
              {
                id: 'text-1',
                type: 'text',
                text: 'Говорили про производную как скорость изменения.',
              },
            ],
            tasks: [],
            examples: [],
            needsImage: false,
            citations: [],
          }),
          turn_count: 1,
          started_at: '2026-07-11T10:00:00.000Z',
          updated_at: '2026-07-11T10:00:00.000Z',
        },
      ])
      .mockReturnValueOnce([
        {
          id: 'turn-legacy-history',
          prompt: 'Объясни производную',
          answer_json: JSON.stringify({
            conversationId: 'conv-legacy-history',
            lessonType: 'tutor',
            answer: 'Говорили про производную как скорость изменения.',
            blocks: [
              {
                id: 'text-1',
                type: 'text',
                text: 'Говорили про производную как скорость изменения.',
              },
            ],
            tasks: [],
            examples: [],
            needsImage: false,
            citations: [],
          }),
          lesson_type: 'tutor',
          created_at: '2026-07-11T10:00:00.000Z',
        },
      ]);

    const history = service.getLessonHistory({ user });

    expect(String(db.all.mock.calls[1][0])).toContain('NOT EXISTS');
    expect(history.lessons).toHaveLength(1);
    expect(history.lessons[0]).toEqual(
      expect.objectContaining({
        lessonSessionId: 'legacy_conv-legacy-history',
        conversationId: 'conv-legacy-history',
        lessonType: 'tutor',
        status: 'finished',
        goalStatus: 'in_progress',
        lessonGoal: 'Говорили про производную как скорость изменения.',
        turnCount: 1,
      }),
    );
    expect(history.lessons[0].turns[0]).toEqual(
      expect.objectContaining({
        id: 'turn-legacy-history',
        prompt: 'Объясни производную',
      }),
    );
  });

  it('adds a backend-verifiable task for supported practice turns', async () => {
    const { service, curriculum, mathVerifier } = createService();
    curriculum.resolve.mockReturnValueOnce({
      topicId: 'algebra.linear_equations',
      topicTitle: 'Линейные уравнения',
      skillId: 'algebra.linear.solve_one_variable',
      skillTitle: 'Решение линейного уравнения',
      taskTypeId: 'ege.base.linear_equation_numeric',
      taskTypeTitle: 'ЕГЭ: линейное уравнение с числовым ответом',
      verifierKind: 'linear_equation_numeric',
      confidence: 'high',
    });
    mathVerifier.ensureBackendTask.mockImplementation(({ answer }) => {
      answer.tasks.push({
        title: 'ЕГЭ: линейное уравнение с числовым ответом',
        prompt: 'Реши уравнение: 2x + 3 = 15. В ответе напиши значение x.',
        difficulty: 'base',
      });
    });

    const result = await service.answerMessage({
      user,
      message: 'Дай практику по линейным уравнениям',
      conversationId: 'conv-practice',
      source: 'text',
      lessonType: 'practice',
    });

    expect(mathVerifier.verifyPendingTaskAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        lessonSessionId: 'lesson-1',
        message: 'Дай практику по линейным уравнениям',
      }),
    );
    expect(mathVerifier.ensureBackendTask).toHaveBeenCalledWith(
      expect.objectContaining({
        lessonType: 'practice',
        curriculum: expect.objectContaining({
          verifierKind: 'linear_equation_numeric',
        }),
      }),
    );
    expect(result.tasks.some((task) => task.prompt.includes('2x + 3 = 15'))).toBe(true);
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
    (lessonService.beginTurnWithTransitions as jest.Mock).mockReturnValueOnce({
      closedSessions: [],
      lifecycle: {
        lessonSessionId: 'lesson-hard',
        conversationId: 'conv-hard',
        lessonType: 'tutor',
        status: 'hard_limit_reached',
        goalStatus: 'stopped_by_limit',
        goalStatusEvidence: 'learning_limit',
        goalEvidenceLevel: 'none',
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
    expect(backgroundAi.enqueueLessonClosureReview).toHaveBeenCalledWith({
      userId: user.id,
      conversationId: 'conv-hard',
      lessonSessionId: 'lesson-hard',
      lessonType: 'tutor',
      finishReason: 'daily_learning_limit_reached',
    });
  });
});
