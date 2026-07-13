import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { tmpdir } from 'os';
import { BackgroundAiService } from '../src/background-ai/background-ai.service';
import { DatabaseService } from '../src/database/database.service';
import { StudentProfileService } from '../src/student-profile/student-profile.service';

function createConfig(sqlitePath: string, overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    'app.sqlitePath': sqlitePath,
    'ai.openai.responsesModel': 'gpt-test',
    'ai.background.enabled': true,
    'ai.background.batchingEnabled': true,
    'ai.background.responsesModel': 'gpt-background',
    'ai.background.windowResponsesModel': 'gpt-window',
    'ai.background.refreshResponsesModel': 'gpt-refresh',
    'ai.background.serviceTier': 'flex',
    'ai.background.promptCacheKeyEnabled': true,
    'ai.background.drainIntervalMs': 60_000,
    'ai.background.drainBatchSize': 10,
    'ai.background.maxAttempts': 1,
    'ai.background.observationWindowSize': 1,
    'ai.background.observationMaxWindowSize': 12,
    'ai.background.observationIdleFlushMs': 900_000,
    'ai.background.runningJobTimeoutMs': 600_000,
    'ai.background.profileRefreshTurnInterval': 2,
    'ai.background.sessionSummaryTurnInterval': 2,
    ...overrides,
  };
  return {
    get: <T>(key: string) => values[key] as T,
  } as ConfigService;
}

describe('BackgroundAiService', () => {
  let db: DatabaseService;
  let service: BackgroundAiService;
  let aiModel: { createOperationResponse: jest.Mock };
  let knowledge: { getActiveVectorStoreIds: jest.Mock };
  let studentProfile: StudentProfileService;

  beforeEach(() => {
    const sqlitePath = join(tmpdir(), `egmathteacher-background-${randomUUID()}.sqlite`);
    const config = createConfig(sqlitePath);
    db = new DatabaseService(config);
    db.run(
      'INSERT INTO users (id, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
      ['student-1', 'Маша', 'hash', 'student', new Date().toISOString()],
    );
    db.run(
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
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'student-1',
        new Date().toISOString(),
        JSON.stringify({ weakTopics: [], analogyInterests: [], diagnosticAnswers: [] }),
        JSON.stringify({ overallLevel: { value: 'basic' } }),
        JSON.stringify({ explanationStyle: 'examples' }),
        JSON.stringify({ tutorTone: { value: 'calm' } }),
        JSON.stringify({ pacing: 'slow' }),
        'Нужен спокойный темп.',
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );
    db.run(
      `INSERT INTO tutor_turns (id, user_id, conversation_id, prompt, answer_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'turn-1',
        'student-1',
        'conv-1',
        'Объясни производную',
        JSON.stringify({
          answer: 'Производная показывает скорость изменения функции.',
          tasks: [],
          examples: [],
          needsImage: false,
          citations: [],
        }),
        new Date().toISOString(),
      ],
    );
    db.run(
      `INSERT INTO tutor_turns (id, user_id, conversation_id, prompt, answer_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'turn-2',
        'student-1',
        'conv-1',
        'Дай задачу',
        JSON.stringify({
          answer: 'Попробуй найти производную x^2.',
          tasks: [{ title: 'Производная', prompt: 'Найдите производную x^2' }],
          examples: [],
          needsImage: false,
          citations: [],
        }),
        new Date().toISOString(),
      ],
    );

    aiModel = {
      createOperationResponse: jest.fn(),
    };
    aiModel.createOperationResponse
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          summary: 'Ученик разбирает производную через смысл скорости изменения.',
          signals: [
            {
              category: 'knowledge',
              value: 'путает смысл производной',
              confidence: 'medium',
              evidence: ['просит объяснить производную'],
            },
          ],
          knowledgeDelta: { topicSignals: [{ topic: 'производная', status: 'gap' }] },
          teachingStrategyHints: ['дать пример через скорость'],
          sessionSummary: {
            summary: 'Ученик разбирает производную через смысл скорости изменения.',
            topicsWorked: ['производная'],
            nextSteps: ['короткая практика на смысл производной'],
          },
          evidenceLevels: {
            L0: 'raw tutor turns stored separately',
            L1: ['просит объяснение производной'],
            L2: 'работа со смыслом производной',
            L3: ['путает смысл производной'],
            L4: ['нужна поддержка'],
            L5: ['пример через скорость'],
          },
          skillProgressSignals: [
            {
              topic: 'производная',
              skill: 'смысл производной',
              direction: 'progress',
              confidence: 'medium',
              evidence: ['связал производную со скоростью изменения'],
              mistakePatterns: ['путает смысл с формулой'],
              supportNeeded: 'step_by_step',
              independence: 'medium',
              recommendedNextAction: 'дать похожую задачу на скорость',
            },
          ],
          qualityReview: { risk: 'none', issues: [], repairHints: [] },
          profileUpdateRecommended: true,
        }),
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          knowledgeStatePatch: { derivative: { status: 'gap', confidence: 'medium' } },
          learningPreferencesPatch: { examplePreference: 'real_world_speed' },
          psychologicalProfilePatch: {
            confidenceWithMath: { value: 'needs_support', confidence: 'low' },
            familyDetails: 'do not store',
          },
          explanationStrategyPatch: { structure: 'meaning_example_formula' },
          aiSummary: 'Лучше объяснять производную через скорость и короткие примеры.',
        }),
      });

    knowledge = {
      getActiveVectorStoreIds: jest.fn(() => ['vs_background']),
    };
    studentProfile = new StudentProfileService(
      db,
      knowledge as any,
      { createOperationResponse: jest.fn() } as any,
    );
    service = new BackgroundAiService(
      db,
      config,
      knowledge as any,
      aiModel as any,
      studentProfile,
    );
  });

  afterEach(() => {
    service.onModuleDestroy();
    db.onModuleDestroy();
  });

  it('stores tutor observations and drains them as a batched learning window', async () => {
    service.enqueueTutorTurnWork({
      userId: 'student-1',
      userName: 'Маша',
      conversationId: 'conv-1',
      lessonType: 'tutor',
      source: 'text',
      prompt: 'Я не понимаю производную',
      answer: {
        answer:
          'Производная показывает скорость изменения функции, поэтому сначала смотрим на смысл, затем на формулу и простой пример.',
        tasksCount: 0,
        examplesCount: 0,
        citationsCount: 0,
        needsImage: false,
      },
    });

    expect(service.getStatus().pending).toBe(1);
    expect(
      db.get<{ count: number }>(
        "SELECT COUNT(*) AS count FROM background_learning_observations WHERE status = 'pending'",
      )?.count,
    ).toBe(1);

    await expect(service.drainPending()).resolves.toBe(2);

    expect(service.getStatus()).toEqual({
      pending: 0,
      running: 0,
      succeeded: 2,
      failed: 0,
    });
    expect(aiModel.createOperationResponse).toHaveBeenCalledTimes(2);
    expect(aiModel.createOperationResponse).toHaveBeenNthCalledWith(
      1,
      'backgroundLearningWindow',
      expect.objectContaining({
        prompt_cache_key: expect.stringMatching(/^egmt:learningwind:[a-f0-9]{32}$/),
        metadata: expect.objectContaining({
          background_ai: 'true',
          background_specialist: 'learning-window-analyzer',
        }),
      }),
    );
    expect(aiModel.createOperationResponse).toHaveBeenNthCalledWith(
      2,
      'backgroundProfileStrategyRefresh',
      expect.objectContaining({
        prompt_cache_key: expect.stringMatching(/^egmt:profilestrat:[a-f0-9]{32}$/),
        metadata: expect.objectContaining({
          background_ai: 'true',
          background_specialist: 'profile-strategy-background-refresher',
        }),
        tools: [expect.objectContaining({ type: 'file_search', vector_store_ids: ['vs_background'] })],
      }),
    );

    const signals = db.all<{ signal_type: string; signal_json: string }>(
      'SELECT signal_type, signal_json FROM student_learning_signals ORDER BY created_at ASC',
    );
    expect(signals.map((signal) => signal.signal_type)).toEqual([
      'learning_window',
      'session_summary',
      'profile_strategy_refresh',
    ]);
    expect(JSON.stringify(signals)).not.toMatch(/familyDetails|do not store/i);
    expect(
      db.get<{ count: number }>(
        "SELECT COUNT(*) AS count FROM background_learning_observations WHERE status = 'processed' AND window_id IS NOT NULL",
      )?.count,
    ).toBe(1);
    expect(
      db.get<{ count: number }>('SELECT COUNT(*) AS count FROM background_analysis_windows')
        ?.count,
    ).toBe(1);
    expect(
      db.get<{ count: number }>('SELECT COUNT(*) AS count FROM student_session_summaries')
        ?.count,
    ).toBe(1);
    expect(
      db.get<{ direction: string; support_needed: string }>(
        'SELECT direction, support_needed FROM student_skill_progress WHERE topic = ?',
        ['производная'],
      ),
    ).toEqual({ direction: 'progress', support_needed: 'step_by_step' });

    const profile = db.get<{
      knowledge_state_json: string;
      explanation_strategy_json: string;
      ai_summary: string;
    }>('SELECT knowledge_state_json, explanation_strategy_json, ai_summary FROM student_profiles WHERE user_id = ?', [
      'student-1',
    ]);
    expect(profile?.knowledge_state_json).toContain('derivative');
    expect(profile?.explanation_strategy_json).toContain('meaning_example_formula');
    expect(profile?.ai_summary).toContain('скорость');
  });

  it('queues a lesson-closure review and preserves the closed lesson type', async () => {
    service.enqueueLessonClosureReview({
      userId: 'student-1',
      conversationId: 'conv-1',
      lessonSessionId: 'lesson-closure-1',
      lessonType: 'practice',
      finishReason: 'student_finished_lesson',
    });

    const jobs = db.all<{ type: string; payload_json: string }>(
      'SELECT type, payload_json FROM background_ai_jobs ORDER BY created_at ASC',
    );
    expect(jobs.map((job) => job.type)).toEqual([
      'learning_window_analysis',
      'session_summary',
      'profile_strategy_refresh',
    ]);
    expect(jobs.map((job) => JSON.parse(job.payload_json).lessonType)).toEqual([
      'practice',
      'practice',
      'practice',
    ]);

    await expect(service.drainPending()).resolves.toBe(3);

    expect((aiModel.createOperationResponse as jest.Mock).mock.calls.map(([operation]) => operation)).toEqual([
      'backgroundSessionSummary',
      'backgroundProfileStrategyRefresh',
    ]);
    expect(
      db.get<{ lesson_type: string }>(
        'SELECT lesson_type FROM student_session_summaries WHERE conversation_id = ?',
        ['conv-1'],
      ),
    ).toEqual({ lesson_type: 'practice' });
  });

  it('keeps the legacy per-turn background job mode when batching is disabled', async () => {
    aiModel.createOperationResponse.mockReset();
    aiModel.createOperationResponse
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          signals: [{ category: 'knowledge', value: 'legacy turn signal' }],
        }),
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          summary: 'Legacy session summary.',
        }),
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          knowledgeStatePatch: { derivative: { status: 'gap' } },
          aiSummary: 'Legacy profile summary.',
        }),
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          explanationStrategyPatch: { structure: 'legacy_strategy' },
          aiSummary: 'Legacy strategy summary.',
        }),
      });

    const legacyService = new BackgroundAiService(
      db,
      createConfig(':memory:', { 'ai.background.batchingEnabled': false }),
      knowledge as any,
      aiModel as any,
      studentProfile,
    );

    legacyService.enqueueTutorTurnWork({
      userId: 'student-1',
      userName: 'Маша',
      conversationId: 'conv-1',
      lessonType: 'tutor',
      source: 'text',
      prompt: 'Я не понимаю производную',
      answer: {
        answer:
          'Производная показывает скорость изменения функции, поэтому сначала смотрим на смысл, затем на формулу и простой пример.',
        tasksCount: 0,
        examplesCount: 0,
        citationsCount: 0,
        needsImage: false,
      },
    });

    expect(legacyService.getStatus().pending).toBe(4);
    await expect(legacyService.drainPending()).resolves.toBe(4);
    expect(aiModel.createOperationResponse).toHaveBeenCalledTimes(4);
    expect((aiModel.createOperationResponse as jest.Mock).mock.calls.map(([operation]) => operation)).toEqual([
      'backgroundLearningSignal',
      'backgroundSessionSummary',
      'backgroundProfileRefresh',
      'backgroundTeachingStrategyRefresh',
    ]);

    const jobTypes = db.all<{ type: string }>(
      'SELECT type FROM background_ai_jobs ORDER BY created_at ASC',
    );
    expect(jobTypes.map((job) => job.type)).toEqual([
      'learning_signal_extraction',
      'session_summary',
      'student_profile_refresh',
      'teaching_strategy_refresh',
    ]);
    expect(
      db.get<{ count: number }>('SELECT COUNT(*) AS count FROM background_learning_observations')
        ?.count,
    ).toBe(0);
  });

  it('does not enqueue jobs when background processing is disabled', () => {
    const config = {
      get: <T>(key: string) =>
        ({
          'ai.background.enabled': false,
          'ai.background.drainBatchSize': 10,
        })[key] as T,
    } as ConfigService;
    const disabledService = new BackgroundAiService(
      db,
      config,
      { getActiveVectorStoreIds: jest.fn(() => []) } as any,
      aiModel as any,
      { getProfile: jest.fn() } as any,
    );

    disabledService.enqueueTutorTurnWork({
      userId: 'student-1',
      userName: 'Маша',
      conversationId: 'conv-disabled',
      lessonType: 'tutor',
      source: 'text',
      prompt: 'test',
      answer: {
        answer: 'test answer',
        tasksCount: 0,
        examplesCount: 0,
        citationsCount: 0,
        needsImage: false,
      },
    });

    expect(disabledService.getStatus()).toEqual({
      pending: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
    });
  });

  it('releases claimed learning observations when window analysis fails', async () => {
    aiModel.createOperationResponse.mockReset();
    aiModel.createOperationResponse.mockRejectedValueOnce(new Error('model unavailable'));

    service.enqueueTutorTurnWork({
      userId: 'student-1',
      userName: 'Маша',
      conversationId: 'conv-1',
      lessonType: 'tutor',
      source: 'text',
      prompt: 'Я не понимаю производную',
      answer: {
        answer:
          'Производная показывает скорость изменения функции, поэтому сначала смотрим на смысл, затем на формулу и простой пример.',
        tasksCount: 0,
        examplesCount: 0,
        citationsCount: 0,
        needsImage: false,
      },
    });

    await expect(service.drainPending()).resolves.toBe(1);

    expect(service.getStatus()).toEqual({
      pending: 0,
      running: 0,
      succeeded: 0,
      failed: 1,
    });
    expect(
      db.get<{ count: number }>(
        "SELECT COUNT(*) AS count FROM background_learning_observations WHERE status = 'pending' AND window_id IS NULL",
      )?.count,
    ).toBe(1);
    expect(
      db.get<{ count: number }>(
        "SELECT COUNT(*) AS count FROM background_learning_observations WHERE status = 'queued'",
      )?.count,
    ).toBe(0);
    expect(
      db.get<{ count: number }>('SELECT COUNT(*) AS count FROM background_analysis_windows')
        ?.count,
    ).toBe(0);
  });

  it('requeues failed background jobs for a single signed-in user scope', () => {
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO background_ai_jobs (
         id, type, status, user_id, conversation_id, attempts, payload_json,
         error_message, scheduled_at, completed_at, created_at, updated_at
       )
       VALUES (?, 'learning_window_analysis', 'failed', ?, ?, 2, ?, ?, ?, ?, ?, ?)`,
      [
        'job-failed-user',
        'student-1',
        'conv-1',
        JSON.stringify({ triggerReason: 'test' }),
        'OpenAI request failed with status 400',
        now,
        now,
        now,
        now,
      ],
    );
    db.run(
      'INSERT INTO users (id, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
      ['other-user', 'Петя', 'hash', 'student', now],
    );
    db.run(
      `INSERT INTO background_ai_jobs (
         id, type, status, user_id, conversation_id, attempts, payload_json,
         error_message, scheduled_at, completed_at, created_at, updated_at
       )
       VALUES (?, 'learning_window_analysis', 'failed', ?, ?, 2, ?, ?, ?, ?, ?, ?)`,
      [
        'job-failed-other',
        'other-user',
        'conv-1',
        JSON.stringify({ triggerReason: 'test' }),
        'OpenAI request failed with status 400',
        now,
        now,
        now,
        now,
      ],
    );

    expect(service.requeueFailedJobsForUser({ userId: 'student-1', limit: 1 })).toEqual({
      requeued: 1,
      jobIds: ['job-failed-user'],
    });
    expect(
      db.get<{ status: string; attempts: number; completed_at: string | null }>(
        'SELECT status, attempts, completed_at FROM background_ai_jobs WHERE id = ?',
        ['job-failed-user'],
      ),
    ).toEqual({ status: 'pending', attempts: 0, completed_at: null });
    expect(
      db.get<{ status: string; attempts: number }>(
        'SELECT status, attempts FROM background_ai_jobs WHERE id = ?',
        ['job-failed-other'],
      ),
    ).toEqual({ status: 'failed', attempts: 2 });
  });

  it('recovers stale queued observations and terminal running jobs before draining', async () => {
    const oldTime = new Date(Date.now() - 60 * 60 * 1_000).toISOString();
    db.run(
      `INSERT INTO background_learning_observations (
         id, user_id, conversation_id, source, observation_json, status,
         window_id, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, 'queued', NULL, ?, ?)`,
      [
        'observation-stale',
        'student-1',
        'conv-stale',
        'text',
        JSON.stringify({ prompt: 'stale' }),
        oldTime,
        oldTime,
      ],
    );
    db.run(
      `INSERT INTO background_ai_jobs (
         id, type, status, user_id, conversation_id, attempts, payload_json,
         scheduled_at, started_at, created_at, updated_at
       )
       VALUES (?, 'learning_window_analysis', 'running', ?, ?, 1, ?, ?, ?, ?, ?)`,
      [
        'job-stale-terminal',
        'student-1',
        'conv-stale',
        JSON.stringify({ triggerReason: 'test' }),
        oldTime,
        oldTime,
        oldTime,
        oldTime,
      ],
    );

    const recoveryService = new BackgroundAiService(
      db,
      createConfig(':memory:', { 'ai.background.runningJobTimeoutMs': 1 }),
      knowledge as any,
      aiModel as any,
      studentProfile,
    );

    await expect(recoveryService.drainPending()).resolves.toBe(0);

    expect(
      db.get<{ status: string }>(
        'SELECT status FROM background_learning_observations WHERE id = ?',
        ['observation-stale'],
      ),
    ).toEqual({ status: 'pending' });
    expect(
      db.get<{ status: string; error_message: string }>(
        'SELECT status, error_message FROM background_ai_jobs WHERE id = ?',
        ['job-stale-terminal'],
      ),
    ).toEqual({
      status: 'failed',
      error_message: 'Background job timed out while running',
    });
  });
});
