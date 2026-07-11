import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { tmpdir } from 'os';
import { BackgroundAiService } from '../src/background-ai/background-ai.service';
import { DatabaseService } from '../src/database/database.service';
import { StudentProfileService } from '../src/student-profile/student-profile.service';

function createConfig(sqlitePath: string): ConfigService {
  const values: Record<string, unknown> = {
    'app.sqlitePath': sqlitePath,
    'ai.openai.responsesModel': 'gpt-test',
    'ai.background.enabled': true,
    'ai.background.responsesModel': 'gpt-background',
    'ai.background.serviceTier': 'flex',
    'ai.background.drainIntervalMs': 60_000,
    'ai.background.drainBatchSize': 10,
    'ai.background.maxAttempts': 1,
    'ai.background.profileRefreshTurnInterval': 2,
    'ai.background.sessionSummaryTurnInterval': 2,
  };
  return {
    get: <T>(key: string) => values[key] as T,
  } as ConfigService;
}

describe('BackgroundAiService', () => {
  let db: DatabaseService;
  let service: BackgroundAiService;
  let aiModel: { createResponse: jest.Mock };

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
        }),
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          summary: 'Ученик разбирает производную через смысл скорости изменения.',
          topicsWorked: ['производная'],
          mistakes: [],
          nextSteps: ['закрепить простыми функциями'],
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
          aiSummary: 'Лучше объяснять производную через скорость и короткие примеры.',
        }),
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          explanationStrategyPatch: { structure: 'meaning_example_formula' },
          aiSummary: 'Используй смысл, пример, затем формулу.',
        }),
      });

    const knowledge = {
      getActiveVectorStoreIds: jest.fn(() => ['vs_background']),
    };
    const studentProfile = new StudentProfileService(
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

  it('queues logical background jobs from tutor turns and drains them with flex tier', async () => {
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

    expect(service.getStatus().pending).toBe(4);

    await expect(service.drainPending()).resolves.toBe(4);

    expect(service.getStatus()).toEqual({
      pending: 0,
      running: 0,
      succeeded: 4,
      failed: 0,
    });
    expect(aiModel.createResponse).toHaveBeenCalledTimes(4);
    expect(aiModel.createResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-background',
        service_tier: 'flex',
        metadata: expect.objectContaining({ background_ai: true }),
      }),
    );

    const signals = db.all<{ signal_type: string; signal_json: string }>(
      'SELECT signal_type, signal_json FROM student_learning_signals ORDER BY created_at ASC',
    );
    expect(signals.map((signal) => signal.signal_type)).toEqual([
      'turn_signal',
      'session_summary',
      'profile_refresh',
      'strategy_refresh',
    ]);
    expect(JSON.stringify(signals)).not.toMatch(/familyDetails|do not store/i);

    const profile = db.get<{
      knowledge_state_json: string;
      explanation_strategy_json: string;
      ai_summary: string;
    }>('SELECT knowledge_state_json, explanation_strategy_json, ai_summary FROM student_profiles WHERE user_id = ?', [
      'student-1',
    ]);
    expect(profile?.knowledge_state_json).toContain('derivative');
    expect(profile?.explanation_strategy_json).toContain('meaning_example_formula');
    expect(profile?.ai_summary).toContain('смысл');
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
