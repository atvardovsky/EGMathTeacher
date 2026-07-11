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
  let aiModel: { createResponse: jest.Mock };
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
      createResponse: jest.fn(),
    };
    aiModel.createResponse
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
      config,
      knowledge as any,
      { createResponse: jest.fn() } as any,
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
    expect(aiModel.createResponse).toHaveBeenCalledTimes(2);
    expect(aiModel.createResponse).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        model: 'gpt-window',
        service_tier: 'flex',
        prompt_cache_key: expect.stringMatching(/^egmt:learningwind:[a-f0-9]{32}$/),
        metadata: expect.objectContaining({
          background_ai: true,
          background_specialist: 'learning-window-analyzer',
        }),
      }),
    );
    expect(aiModel.createResponse).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        model: 'gpt-refresh',
        service_tier: 'flex',
        prompt_cache_key: expect.stringMatching(/^egmt:profilestrat:[a-f0-9]{32}$/),
        metadata: expect.objectContaining({
          background_ai: true,
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

  it('keeps the legacy per-turn background job mode when batching is disabled', async () => {
    aiModel.createResponse.mockReset();
    aiModel.createResponse
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
    expect(aiModel.createResponse).toHaveBeenCalledTimes(4);

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
});
