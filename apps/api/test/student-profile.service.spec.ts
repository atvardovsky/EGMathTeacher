import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { join } from 'path';
import { tmpdir } from 'os';
import { AuthSession } from '../src/auth/auth.types';
import { DatabaseService } from '../src/database/database.service';
import { StudentProfileService } from '../src/student-profile/student-profile.service';

function createConfig(sqlitePath: string): ConfigService {
  const values: Record<string, unknown> = {
    'app.sqlitePath': sqlitePath,
    'app.profileCreationRunningTimeoutMs': 900_000,
    'ai.openai.responsesModel': 'gpt-test',
  };
  return {
    get: <T>(key: string) => values[key] as T,
  } as ConfigService;
}

describe('StudentProfileService', () => {
  let db: DatabaseService;
  let service: StudentProfileService;
  let config: ConfigService;
  const user: AuthSession = {
    id: 'student-1',
    name: 'Маша',
    role: 'student',
    createdAt: new Date().toISOString(),
    iat: 1,
    exp: 9_999_999_999,
  };

  const admin: AuthSession = {
    ...user,
    id: 'admin-1',
    name: 'Админ',
    role: 'admin',
  };

  const aiModel = {
    createOperationResponse: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    aiModel.createOperationResponse
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          knowledgeState: {
            overallLevel: {
              value: 'medium',
              confidence: 'medium',
              evidence: ['решила линейное уравнение'],
            },
            topicSignals: [{ topic: 'функции', status: 'unstable', confidence: 'medium' }],
            priorityTopics: ['функции'],
            medicalNotes: 'diagnosed ADHD',
          },
        }),
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          learningPreferences: {
            explanationStyle: 'examples_first',
            visualSupport: true,
          },
          psychologicalProfile: {
            confidenceWithMath: {
              value: 'low',
              confidence: 'medium',
              evidence: ['назвала уверенность низкой'],
            },
            mathEmotion: {
              value: 'anxious',
              confidence: 'medium',
              evidence: ['описала математику как тревожную'],
            },
            tutorTone: {
              value: 'calm_direct',
              confidence: 'medium',
              evidence: ['просит спокойный темп'],
            },
            clinicalDiagnosis: 'ADHD',
            familyDetails: 'parents are divorcing',
          },
        }),
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          explanationStrategy: {
            pacing: 'slow',
            structure: 'example_then_rule',
            avoid: ['pressure'],
            parentNotes: 'do not store family details',
          },
          aiSummary:
            'Ученик готовится к ЕГЭ, лучше понимает через примеры и спокойный темп.',
        }),
      });
  });

  const knowledge = {
    getActiveVectorStoreIds: jest.fn(() => ['vs_profile']),
  };

  beforeEach(() => {
    const sqlitePath = join(tmpdir(), `egmathteacher-profile-${randomUUID()}.sqlite`);
    config = createConfig(sqlitePath);
    db = new DatabaseService(config);
    db.run(
      'INSERT INTO users (id, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
      [user.id, user.name, 'hash', user.role, user.createdAt],
    );
    db.run(
      'INSERT INTO users (id, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
      [admin.id, admin.name, 'hash', admin.role, admin.createdAt],
    );
    service = new StudentProfileService(db, config, knowledge as any, aiModel as any);
  });

  afterEach(() => {
    db.onModuleDestroy();
  });

  function mockConversationProfilePipeline(): void {
    aiModel.createOperationResponse.mockReset();
    aiModel.createOperationResponse
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          answers: {
            exam: 'ЕГЭ',
            grade: '10',
            currentLevel: 'средне',
            mathFeeling: 'тревожно',
            weakTopics: ['производная'],
            motivation: 'поступить на инженерное направление',
            explanationStyle: 'сначала пример',
            pacing: 'медленно',
            visualPreference: true,
            analogyInterests: ['техника'],
            diagnosticAnswers: [
              {
                prompt: 'Реши 2x + 5 = 17',
                answer: 'x = 6',
              },
            ],
            freeform: 'мне сложно слушать длинные объяснения',
          },
        }),
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          knowledgeState: {
            overallLevel: {
              value: 'medium',
              confidence: 'medium',
              evidence: ['решила линейное уравнение'],
            },
            priorityTopics: ['производная'],
          },
        }),
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          learningPreferences: {
            explanationStyle: 'examples_first',
            visualSupport: true,
          },
          psychologicalProfile: {
            confidenceWithMath: {
              value: 'low',
              confidence: 'medium',
              evidence: ['просит медленный темп'],
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          explanationStrategy: {
            pacing: 'slow',
            structure: 'example_then_rule',
          },
          aiSummary: 'Лучше начинать с короткого примера и затем давать правило.',
        }),
      });
  }

  function insertReadyMeeting(conversationId: string, baseTime: string): void {
    db.run(
      `INSERT INTO lesson_sessions (
         id, user_id, conversation_id, lesson_type, status, goal_status, goal_text,
         success_criteria_json, active_learning_seconds, turn_count, started_at,
         last_activity_at, created_at, updated_at
       )
       VALUES (?, ?, ?, 'meeting', 'active', 'in_progress', ?, ?, 0, 4, ?, ?, ?, ?)`,
      [
        `lesson-${conversationId}`,
        user.id,
        conversationId,
        'Понять стартовый учебный контекст ученика.',
        JSON.stringify(['получены ответы о цели']),
        baseTime,
        baseTime,
        baseTime,
        baseTime,
      ],
    );
    const prompts = [
      'Начни первую голосовую встречу с учеником для AI-репетитора ЕГЭ по математике',
      'Хочу подготовиться к ЕГЭ, мне сложны производные',
      'Сначала пример, медленно. В задаче 2x + 5 = 17 получается x = 6',
      'Уровень средний, уверенности мало, с графиками и производной часто застреваю',
    ];
    prompts.forEach((prompt, index) => {
      const createdAt = new Date(Date.parse(baseTime) + index).toISOString();
      db.run(
        `INSERT INTO tutor_turns (
           id, user_id, conversation_id, request_id, lesson_type, prompt, answer_json, created_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `turn-${conversationId}-${index}`,
          user.id,
          conversationId,
          `request-${conversationId}-${index}`,
          'meeting',
          prompt,
          JSON.stringify({ answer: 'Следующий вопрос.' }),
          createdAt,
        ],
      );
    });
  }

  function getMeetingTranscriptHash(userId: string, conversationId: string): string {
    const turns = db.all<{
      id: string;
      prompt: string;
      answer_json: string;
      lesson_type: string;
      created_at: string;
    }>(
      `SELECT id, prompt, answer_json, lesson_type, created_at
       FROM tutor_turns
       WHERE user_id = ?
         AND conversation_id = ?
         AND lesson_type = 'meeting'
       ORDER BY created_at ASC
       LIMIT 16`,
      [userId, conversationId],
    );
    return createHash('sha256')
      .update(JSON.stringify(turns))
      .digest('hex');
  }

  it('requires onboarding for students without a profile but not for admins', () => {
    expect(service.getStatus(user)).toEqual({ onboardingRequired: true, profile: null });
    expect(service.getStatus(admin)).toEqual({ onboardingRequired: false, profile: null });
  });

  it('creates an AI-made tutoring profile and stores it in SQLite', async () => {
    const status = await service.completeOnboarding({
      user,
      answers: {
        exam: 'ЕГЭ',
        grade: '10',
        targetScore: 75,
        currentLevel: 'средне',
        confidence: 'низкая',
        mathFeeling: 'тревожно',
        weakTopics: ['функции'],
        motivation: 'поступление',
        explanationStyle: 'сначала пример',
        pacing: 'медленно',
        visualPreference: true,
        analogyInterests: ['игры'],
        diagnosticAnswers: [{ prompt: '2x + 5 = 17', answer: 'x = 6' }],
        freeform: 'У меня СДВГ и проблемы в семье, но длинные объяснения утомляют',
      },
    });

    expect(status.onboardingRequired).toBe(false);
    expect(status.profile?.aiSummary).toContain('спокойный темп');
    expect(status.profile?.psychologicalProfile.confidenceWithMath).toEqual(
      expect.objectContaining({ value: 'low', confidence: 'medium' }),
    );
    expect(status.profile?.onboardingAnswers.motivation).toBe('поступление');
    expect(status.profile?.onboardingAnswers.freeform).toBeUndefined();
    expect(status.profile?.knowledgeState).not.toHaveProperty('medicalNotes');
    expect(status.profile?.psychologicalProfile).not.toHaveProperty('clinicalDiagnosis');
    expect(status.profile?.psychologicalProfile).not.toHaveProperty('familyDetails');
    expect(status.profile?.explanationStrategy).not.toHaveProperty('parentNotes');
    expect(JSON.stringify(status.profile)).not.toMatch(/СДВГ|ADHD|parents|семье/i);
    expect(aiModel.createOperationResponse).toHaveBeenCalledTimes(3);
    expect(aiModel.createOperationResponse).toHaveBeenCalledWith(
      'onboardingKnowledgeDiagnosis',
      expect.objectContaining({
        tools: [expect.objectContaining({ type: 'file_search', vector_store_ids: ['vs_profile'] })],
      }),
    );
    const operationNames = (aiModel.createOperationResponse as jest.Mock).mock.calls.map(
      ([operation]) => operation,
    );
    expect(operationNames).toEqual([
      'onboardingKnowledgeDiagnosis',
      'onboardingPsychopedagogicalProfile',
      'onboardingStrategyPlan',
    ]);
    const specialistNames = (aiModel.createOperationResponse as jest.Mock).mock.calls.map(
      ([, payload]) => payload.metadata.profile_specialist,
    );
    expect(specialistNames).toEqual([
      'math-knowledge-diagnostician',
      'psychopedagogical-profiler',
      'teaching-strategy-planner',
    ]);
    const psychopedagogicalPayload = (aiModel.createOperationResponse as jest.Mock).mock.calls[1][1];
    expect(psychopedagogicalPayload.instructions).toContain('только учебно полезные сигналы');
    expect(psychopedagogicalPayload.input[0].content[0].text).not.toMatch(/СДВГ|семье/i);
    expect(service.getTutorContext(user.id)).toContain('учебно полезных сигналов');
  });

  it('creates an AI-made tutoring profile from a stored meeting conversation', async () => {
    aiModel.createOperationResponse.mockReset();
    aiModel.createOperationResponse
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          answers: {
            exam: 'ЕГЭ',
            grade: '10',
            currentLevel: 'средне',
            mathFeeling: 'тревожно',
            weakTopics: ['производная'],
            motivation: 'поступить на инженерное направление',
            explanationStyle: 'сначала пример',
            pacing: 'медленно',
            visualPreference: true,
            analogyInterests: ['техника'],
            diagnosticAnswers: [
              {
                prompt: 'Реши 2x + 5 = 17',
                answer: 'x = 6',
              },
            ],
            freeform: 'мне сложно слушать длинные объяснения',
          },
        }),
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          knowledgeState: {
            overallLevel: {
              value: 'medium',
              confidence: 'medium',
              evidence: ['решила линейное уравнение'],
            },
            priorityTopics: ['производная'],
          },
        }),
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          learningPreferences: {
            explanationStyle: 'examples_first',
            visualSupport: true,
          },
          psychologicalProfile: {
            confidenceWithMath: {
              value: 'low',
              confidence: 'medium',
              evidence: ['просит медленный темп'],
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          explanationStrategy: {
            pacing: 'slow',
            structure: 'example_then_rule',
          },
          aiSummary: 'Лучше начинать с короткого примера и затем давать правило.',
        }),
      });

    const now = new Date().toISOString();
    const conversationId = 'meeting-conv-1';
    db.run(
      `INSERT INTO lesson_sessions (
         id, user_id, conversation_id, lesson_type, status, goal_status, goal_text,
         success_criteria_json, active_learning_seconds, turn_count, started_at,
         last_activity_at, created_at, updated_at
       )
       VALUES (?, ?, ?, 'meeting', 'active', 'in_progress', ?, ?, 0, 4, ?, ?, ?, ?)`,
      [
        'lesson-meeting-1',
        user.id,
        conversationId,
        'Понять стартовый учебный контекст ученика.',
        JSON.stringify(['получены ответы о цели']),
        now,
        now,
        now,
        now,
      ],
    );
    db.run(
      `INSERT INTO tutor_turns (
         id, user_id, conversation_id, request_id, lesson_type, prompt, answer_json, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'turn-meeting-1',
        user.id,
        conversationId,
        'request-meeting-1',
        'meeting',
        'Хочу подготовиться к ЕГЭ, мне сложны производные',
        JSON.stringify({
          answer: 'Понял. Расскажи, как тебе легче: сначала правило или пример?',
        }),
        now,
      ],
    );
    db.run(
      `INSERT INTO tutor_turns (
         id, user_id, conversation_id, request_id, lesson_type, prompt, answer_json, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'turn-meeting-0',
        user.id,
        conversationId,
        'request-meeting-0',
        'meeting',
        'Начни первую голосовую встречу с учеником для AI-репетитора ЕГЭ по математике',
        JSON.stringify({
          answer: 'Привет. Какая цель по ЕГЭ и где сейчас сложнее всего?',
        }),
        now,
      ],
    );
    db.run(
      `INSERT INTO tutor_turns (
         id, user_id, conversation_id, request_id, lesson_type, prompt, answer_json, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'turn-meeting-2',
        user.id,
        conversationId,
        'request-meeting-2',
        'meeting',
        'Сначала пример, медленно. В задаче 2x + 5 = 17 получается x = 6',
        JSON.stringify({
          blocks: [
            {
              type: 'text',
              text: 'Хорошо, я буду начинать с примера и проверять маленькими шагами.',
            },
          ],
        }),
        now,
      ],
    );
    db.run(
      `INSERT INTO tutor_turns (
         id, user_id, conversation_id, request_id, lesson_type, prompt, answer_json, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'turn-meeting-3',
        user.id,
        conversationId,
        'request-meeting-3',
        'meeting',
        'Уровень средний, уверенности мало, с графиками и производной часто застреваю',
        JSON.stringify({
          answer: 'Понял. Давай еще один короткий пример и потом соберем профиль.',
        }),
        now,
      ],
    );

    const transactionSpy = jest.spyOn(db, 'transaction');
    const status = await service.completeOnboardingFromConversation({
      user,
      conversationId,
    });

    expect(status.onboardingRequired).toBe(false);
    expect(transactionSpy).toHaveBeenCalled();
    expect(status.profile?.onboardingAnswers.weakTopics).toEqual(['производная']);
    expect(status.profile?.onboardingAnswers.diagnosticAnswers).toEqual([
      { prompt: 'Реши 2x + 5 = 17', answer: 'x = 6' },
    ]);
    expect(aiModel.createOperationResponse).toHaveBeenCalledTimes(4);
    const operationNames = (aiModel.createOperationResponse as jest.Mock).mock.calls.map(
      ([operation]) => operation,
    );
    expect(operationNames).toEqual([
      'onboardingConversationExtraction',
      'onboardingKnowledgeDiagnosis',
      'onboardingPsychopedagogicalProfile',
      'onboardingStrategyPlan',
    ]);
    const extractionPayload = (aiModel.createOperationResponse as jest.Mock).mock.calls[0][1];
    expect(extractionPayload.usageContext).toMatchObject({
      userId: user.id,
      conversationId,
      lessonSessionId: 'lesson-meeting-1',
      lessonType: 'meeting',
    });
    for (const [, payload] of (aiModel.createOperationResponse as jest.Mock).mock.calls.slice(1)) {
      expect(payload.usageContext).toMatchObject({
        userId: user.id,
        conversationId,
        lessonSessionId: 'lesson-meeting-1',
        lessonType: 'meeting',
      });
    }
    expect(extractionPayload.input[0].content[0].text).toContain(
      'Хочу подготовиться к ЕГЭ',
    );
    expect(
      db.get<{ status: string; goal_status: string; finish_reason: string | null }>(
        'SELECT status, goal_status, finish_reason FROM lesson_sessions WHERE id = ?',
        ['lesson-meeting-1'],
      ),
    ).toEqual({
      status: 'finished',
      goal_status: 'reached',
      finish_reason: 'profile_created_from_meeting',
    });
    expect(
      db.get<{
        status: string;
        attempts: number;
        transcript_hash: string;
      }>(
        `SELECT status, attempts, transcript_hash
         FROM student_profile_creation_runs
         WHERE user_id = ?
           AND conversation_id = ?`,
        [user.id, conversationId],
      ),
    ).toEqual({
      status: 'completed',
      attempts: 1,
      transcript_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });

    aiModel.createOperationResponse.mockClear();
    const repeatedStatus = await service.completeOnboardingFromConversation({
      user,
      conversationId,
    });
    expect(repeatedStatus.onboardingRequired).toBe(false);
    expect(repeatedStatus.profile?.userId).toBe(user.id);
    expect(aiModel.createOperationResponse).not.toHaveBeenCalled();
  });

  it('reconciles a retried conversation profile after profile storage already succeeded', async () => {
    aiModel.createOperationResponse.mockReset();
    const now = new Date().toISOString();
    const conversationId = 'meeting-conv-reconcile';
    insertReadyMeeting(conversationId, now);
    const transcriptHash = getMeetingTranscriptHash(user.id, conversationId);
    db.run(
      `INSERT INTO student_profiles (
         user_id, onboarding_completed_at, onboarding_answers_json,
         knowledge_state_json, learning_preferences_json, psychological_profile_json,
         explanation_strategy_json, ai_summary, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        now,
        JSON.stringify({ exam: 'ЕГЭ', weakTopics: ['производная'] }),
        JSON.stringify({ overallLevel: { value: 'medium' } }),
        JSON.stringify({ explanationStyle: 'examples_first' }),
        JSON.stringify({ confidenceWithMath: { value: 'low' } }),
        JSON.stringify({ pacing: 'slow' }),
        'Профиль уже был сохранен до сбоя финализации.',
        now,
        now,
      ],
    );
    db.run(
      `INSERT INTO student_profile_creation_runs (
         id, user_id, conversation_id, transcript_hash, status, attempts,
         error_message, started_at, completed_at, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, 'running', 1, NULL, ?, NULL, ?, ?)`,
      [
        'profile-run-reconcile',
        user.id,
        conversationId,
        transcriptHash,
        now,
        now,
        now,
      ],
    );
    db.run(
      `INSERT INTO student_profile_creation_runs (
         id, user_id, conversation_id, transcript_hash, status, attempts,
         error_message, started_at, completed_at, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, 'failed', 1, ?, ?, ?, ?, ?)`,
      [
        'profile-run-reconcile-old-failed',
        user.id,
        conversationId,
        'old-transcript-hash',
        'previous provider failure',
        now,
        now,
        now,
        now,
      ],
    );

    const status = await service.completeOnboardingFromConversation({
      user,
      conversationId,
    });

    expect(status.onboardingRequired).toBe(false);
    expect(status.profile?.aiSummary).toBe('Профиль уже был сохранен до сбоя финализации.');
    expect(aiModel.createOperationResponse).not.toHaveBeenCalled();
    expect(
      db.get<{ status: string; goal_status: string; finish_reason: string | null }>(
        'SELECT status, goal_status, finish_reason FROM lesson_sessions WHERE id = ?',
        [`lesson-${conversationId}`],
      ),
    ).toEqual({
      status: 'finished',
      goal_status: 'reached',
      finish_reason: 'profile_created_from_meeting',
    });
    expect(
      db.get<{ status: string; error_message: string | null }>(
        `SELECT status, error_message
         FROM student_profile_creation_runs
         WHERE id = ?`,
        ['profile-run-reconcile'],
      ),
    ).toEqual({
      status: 'completed',
      error_message: null,
    });
    expect(
      db.get<{ status: string; error_message: string | null }>(
        `SELECT status, error_message
         FROM student_profile_creation_runs
         WHERE id = ?`,
        ['profile-run-reconcile-old-failed'],
      ),
    ).toEqual({
      status: 'failed',
      error_message: 'previous provider failure',
    });
  });

  it('reconciles an existing profile with the current running conversation when no conversation id is provided', async () => {
    aiModel.createOperationResponse.mockReset();
    const now = new Date().toISOString();
    const conversationId = 'meeting-conv-existing-no-id';
    insertReadyMeeting(conversationId, now);
    const transcriptHash = getMeetingTranscriptHash(user.id, conversationId);
    db.run(
      `INSERT INTO student_profiles (
         user_id, onboarding_completed_at, onboarding_answers_json,
         knowledge_state_json, learning_preferences_json, psychological_profile_json,
         explanation_strategy_json, ai_summary, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        now,
        JSON.stringify({ exam: 'ЕГЭ', weakTopics: ['производная'] }),
        JSON.stringify({ overallLevel: { value: 'medium' } }),
        JSON.stringify({ explanationStyle: 'examples_first' }),
        JSON.stringify({ confidenceWithMath: { value: 'low' } }),
        JSON.stringify({ pacing: 'slow' }),
        'Профиль уже создан.',
        now,
        now,
      ],
    );
    db.run(
      `INSERT INTO student_profile_creation_runs (
         id, user_id, conversation_id, transcript_hash, status, attempts,
         error_message, started_at, completed_at, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, 'running', 1, NULL, ?, NULL, ?, ?)`,
      [
        'profile-run-existing-no-id',
        user.id,
        conversationId,
        transcriptHash,
        now,
        now,
        now,
      ],
    );

    const status = await service.completeOnboardingFromConversation({ user });

    expect(status.onboardingRequired).toBe(false);
    expect(aiModel.createOperationResponse).not.toHaveBeenCalled();
    expect(
      db.get<{ status: string; error_message: string | null }>(
        `SELECT status, error_message
         FROM student_profile_creation_runs
         WHERE id = ?`,
        ['profile-run-existing-no-id'],
      ),
    ).toEqual({
      status: 'completed',
      error_message: null,
    });
    expect(
      db.get<{ status: string; finish_reason: string | null }>(
        `SELECT status, finish_reason
         FROM lesson_sessions
         WHERE id = ?`,
        [`lesson-${conversationId}`],
      ),
    ).toEqual({
      status: 'finished',
      finish_reason: 'profile_created_from_meeting',
    });
  });

  it('uses the latest meeting with saved turns when a newer active meeting is empty', async () => {
    mockConversationProfilePipeline();
    const now = new Date().toISOString();
    const terminalConversationId = 'meeting-conv-terminal-with-turns';
    insertReadyMeeting(terminalConversationId, now);
    db.run(
      `UPDATE lesson_sessions
       SET status = 'goal_reached',
           goal_status = 'reached',
           finished_at = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        new Date(Date.parse(now) + 1_000).toISOString(),
        new Date(Date.parse(now) + 1_000).toISOString(),
        `lesson-${terminalConversationId}`,
      ],
    );
    const emptyActiveConversationId = 'meeting-conv-empty-active';
    db.run(
      `INSERT INTO lesson_sessions (
         id, user_id, conversation_id, lesson_type, status, goal_status, goal_text,
         success_criteria_json, active_learning_seconds, turn_count, started_at,
         last_activity_at, created_at, updated_at
       )
       VALUES (?, ?, ?, 'meeting', 'active', 'in_progress', ?, ?, 0, 0, ?, ?, ?, ?)`,
      [
        'lesson-empty-active',
        user.id,
        emptyActiveConversationId,
        'Пустая новая встреча после сбоя AI-запроса.',
        JSON.stringify(['нет сохраненных ходов']),
        new Date(Date.parse(now) + 5_000).toISOString(),
        new Date(Date.parse(now) + 5_000).toISOString(),
        new Date(Date.parse(now) + 5_000).toISOString(),
        new Date(Date.parse(now) + 5_000).toISOString(),
      ],
    );

    expect(service.getMeetingReadiness(user)).toEqual(
      expect.objectContaining({
        conversationId: terminalConversationId,
        canCreateProfile: true,
      }),
    );

    const status = await service.completeOnboardingFromConversation({ user });

    expect(status.onboardingRequired).toBe(false);
    expect(aiModel.createOperationResponse).toHaveBeenCalledTimes(4);
    expect(
      db.get<{ status: string }>(
        `SELECT status
         FROM student_profile_creation_runs
         WHERE user_id = ?
           AND conversation_id = ?`,
        [user.id, terminalConversationId],
      ),
    ).toEqual({ status: 'completed' });
    expect(
      db.get<{ status: string }>(
        `SELECT status
         FROM lesson_sessions
         WHERE id = ?`,
        ['lesson-empty-active'],
      ),
    ).toEqual({ status: 'active' });
  });

  it('heartbeats the running profile creation lease during a long AI request', async () => {
    jest.useFakeTimers({ now: new Date('2026-01-01T12:00:00.000Z') });
    try {
      aiModel.createOperationResponse.mockReset();
      const now = new Date().toISOString();
      const conversationId = 'meeting-conv-long-request';
      insertReadyMeeting(conversationId, now);
      let resolveExtraction: (value: unknown) => void = () => undefined;
      const extractionPromise = new Promise((resolve) => {
        resolveExtraction = resolve;
      });
      aiModel.createOperationResponse
        .mockImplementationOnce(() => extractionPromise)
        .mockResolvedValueOnce({
          output_text: JSON.stringify({
            knowledgeState: {
              overallLevel: {
                value: 'medium',
                confidence: 'medium',
                evidence: ['решила линейное уравнение'],
              },
              priorityTopics: ['производная'],
            },
          }),
        })
        .mockResolvedValueOnce({
          output_text: JSON.stringify({
            learningPreferences: {
              explanationStyle: 'examples_first',
              visualSupport: true,
            },
            psychologicalProfile: {
              confidenceWithMath: {
                value: 'low',
                confidence: 'medium',
                evidence: ['просит медленный темп'],
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          output_text: JSON.stringify({
            explanationStrategy: {
              pacing: 'slow',
              structure: 'example_then_rule',
            },
            aiSummary: 'Лучше начинать с короткого примера и затем давать правило.',
          }),
        });

      const profilePromise = service.completeOnboardingFromConversation({
        user,
        conversationId,
      });
      await Promise.resolve();

      const firstHeartbeat = db.get<{ updated_at: string }>(
        `SELECT updated_at
         FROM student_profile_creation_runs
         WHERE user_id = ?
           AND conversation_id = ?`,
        [user.id, conversationId],
      )?.updated_at;

      await jest.advanceTimersByTimeAsync(61_000);

      const secondHeartbeat = db.get<{ updated_at: string }>(
        `SELECT updated_at
         FROM student_profile_creation_runs
         WHERE user_id = ?
           AND conversation_id = ?`,
        [user.id, conversationId],
      )?.updated_at;
      expect(Date.parse(secondHeartbeat ?? '')).toBeGreaterThan(
        Date.parse(firstHeartbeat ?? ''),
      );

      resolveExtraction({
        output_text: JSON.stringify({
          answers: {
            exam: 'ЕГЭ',
            grade: '10',
            currentLevel: 'средне',
            mathFeeling: 'тревожно',
            weakTopics: ['производная'],
            motivation: 'поступить на инженерное направление',
            explanationStyle: 'сначала пример',
            pacing: 'медленно',
            visualPreference: true,
            analogyInterests: ['техника'],
            diagnosticAnswers: [
              {
                prompt: 'Реши 2x + 5 = 17',
                answer: 'x = 6',
              },
            ],
          },
        }),
      });
      const status = await profilePromise;

      expect(status.onboardingRequired).toBe(false);
      expect(aiModel.createOperationResponse).toHaveBeenCalledTimes(4);
    } finally {
      jest.useRealTimers();
    }
  });

  it('aborts a pending onboarding AI request when the running claim is lost', async () => {
    jest.useFakeTimers({ now: new Date('2026-01-01T12:00:00.000Z') });
    try {
      aiModel.createOperationResponse.mockReset();
      const now = new Date().toISOString();
      const conversationId = 'meeting-conv-claim-lost';
      insertReadyMeeting(conversationId, now);
      let abortObserved = false;
      aiModel.createOperationResponse.mockImplementationOnce((_operation, payload) => {
        const signal = payload.abortSignal as AbortSignal | undefined;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            abortObserved = true;
            reject(new Error('request aborted after claim loss'));
          });
        });
      });

      const profilePromise = service.completeOnboardingFromConversation({
        user,
        conversationId,
      });
      const handledProfilePromise = profilePromise.catch((error: unknown) => error);
      await Promise.resolve();
      db.run(
        `UPDATE student_profile_creation_runs
         SET status = 'failed',
             error_message = 'claim stolen by newer worker',
             updated_at = ?
         WHERE user_id = ?
           AND conversation_id = ?
           AND status = 'running'`,
        [
          new Date(Date.parse(now) + 1_000).toISOString(),
          user.id,
          conversationId,
        ],
      );

      await jest.advanceTimersByTimeAsync(61_000);

      const error = await handledProfilePromise;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Profile creation claim is no longer active');
      expect(abortObserved).toBe(true);
      expect(aiModel.createOperationResponse).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('recovers a stale running conversation profile claim and completes it', async () => {
    mockConversationProfilePipeline();
    const now = new Date().toISOString();
    const conversationId = 'meeting-conv-stale';
    insertReadyMeeting(conversationId, now);
    const transcriptHash = getMeetingTranscriptHash(user.id, conversationId);
    const staleStartedAt = new Date(Date.now() - 3_600_000).toISOString();
    db.run(
      `INSERT INTO student_profile_creation_runs (
         id, user_id, conversation_id, transcript_hash, status, attempts,
         error_message, started_at, completed_at, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, 'running', 1, NULL, ?, NULL, ?, ?)`,
      [
        'profile-run-stale',
        user.id,
        conversationId,
        transcriptHash,
        staleStartedAt,
        staleStartedAt,
        staleStartedAt,
      ],
    );

    const status = await service.completeOnboardingFromConversation({
      user,
      conversationId,
    });

    expect(status.onboardingRequired).toBe(false);
    expect(aiModel.createOperationResponse).toHaveBeenCalledTimes(4);
    expect(
      db.get<{ status: string; attempts: number; error_message: string | null }>(
        `SELECT status, attempts, error_message
         FROM student_profile_creation_runs
         WHERE id = ?`,
        ['profile-run-stale'],
      ),
    ).toEqual({
      status: 'completed',
      attempts: 2,
      error_message: null,
    });
  });

  it('retries a failed conversation profile claim and completes it once', async () => {
    mockConversationProfilePipeline();
    const now = new Date().toISOString();
    const conversationId = 'meeting-conv-failed';
    insertReadyMeeting(conversationId, now);
    const transcriptHash = getMeetingTranscriptHash(user.id, conversationId);
    const failedAt = new Date(Date.now() - 60_000).toISOString();
    db.run(
      `INSERT INTO student_profile_creation_runs (
         id, user_id, conversation_id, transcript_hash, status, attempts,
         error_message, started_at, completed_at, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, 'failed', 1, ?, ?, ?, ?, ?)`,
      [
        'profile-run-failed',
        user.id,
        conversationId,
        transcriptHash,
        'temporary provider failure',
        failedAt,
        failedAt,
        failedAt,
        failedAt,
      ],
    );

    const status = await service.completeOnboardingFromConversation({
      user,
      conversationId,
    });

    expect(status.onboardingRequired).toBe(false);
    expect(aiModel.createOperationResponse).toHaveBeenCalledTimes(4);
    expect(
      db.get<{ status: string; attempts: number; error_message: string | null }>(
        `SELECT status, attempts, error_message
         FROM student_profile_creation_runs
         WHERE id = ?`,
        ['profile-run-failed'],
      ),
    ).toEqual({
      status: 'completed',
      attempts: 2,
      error_message: null,
    });
  });

  it('rejects a fresh running conversation profile claim without spending AI calls', async () => {
    aiModel.createOperationResponse.mockReset();
    const now = new Date().toISOString();
    const conversationId = 'meeting-conv-running';
    insertReadyMeeting(conversationId, now);
    const transcriptHash = getMeetingTranscriptHash(user.id, conversationId);
    db.run(
      `INSERT INTO student_profile_creation_runs (
         id, user_id, conversation_id, transcript_hash, status, attempts,
         error_message, started_at, completed_at, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, 'running', 1, NULL, ?, NULL, ?, ?)`,
      [
        'profile-run-running',
        user.id,
        conversationId,
        transcriptHash,
        now,
        now,
        now,
      ],
    );

    await expect(
      service.completeOnboardingFromConversation({
        user,
        conversationId,
      }),
    ).rejects.toThrow('Profile creation is already in progress');
    expect(aiModel.createOperationResponse).not.toHaveBeenCalled();
  });

  it('rejects a fresh running profile claim from another meeting conversation for the same user', async () => {
    aiModel.createOperationResponse.mockReset();
    const now = new Date().toISOString();
    const activeConversationId = 'meeting-conv-user-active';
    const newConversationId = 'meeting-conv-user-second';
    insertReadyMeeting(activeConversationId, now);
    insertReadyMeeting(newConversationId, now);
    const activeTranscriptHash = getMeetingTranscriptHash(user.id, activeConversationId);
    db.run(
      `INSERT INTO student_profile_creation_runs (
         id, user_id, conversation_id, transcript_hash, status, attempts,
         error_message, started_at, completed_at, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, 'running', 1, NULL, ?, NULL, ?, ?)`,
      [
        'profile-run-user-active',
        user.id,
        activeConversationId,
        activeTranscriptHash,
        now,
        now,
        now,
      ],
    );

    await expect(
      service.completeOnboardingFromConversation({
        user,
        conversationId: newConversationId,
      }),
    ).rejects.toThrow('Profile creation is already in progress');
    expect(aiModel.createOperationResponse).not.toHaveBeenCalled();
    expect(
      db.all<{ id: string }>(
        `SELECT id
         FROM student_profile_creation_runs
         WHERE user_id = ?
           AND status = 'running'`,
        [user.id],
      ),
    ).toEqual([{ id: 'profile-run-user-active' }]);
  });

  it('rejects a second running conversation profile claim when transcript hash changed', async () => {
    aiModel.createOperationResponse.mockReset();
    const now = new Date().toISOString();
    const conversationId = 'meeting-conv-running-changed';
    insertReadyMeeting(conversationId, now);
    const originalTranscriptHash = getMeetingTranscriptHash(user.id, conversationId);
    db.run(
      `INSERT INTO student_profile_creation_runs (
         id, user_id, conversation_id, transcript_hash, status, attempts,
         error_message, started_at, completed_at, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, 'running', 1, NULL, ?, NULL, ?, ?)`,
      [
        'profile-run-running-changed',
        user.id,
        conversationId,
        originalTranscriptHash,
        now,
        now,
        now,
      ],
    );
    db.run(
      `INSERT INTO tutor_turns (
         id, user_id, conversation_id, request_id, lesson_type, prompt, answer_json, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'turn-running-changed-extra',
        user.id,
        conversationId,
        'request-running-changed-extra',
        'meeting',
        'Еще добавлю: мне важно больше коротких проверок и спокойный темп',
        JSON.stringify({ answer: 'Зафиксировал, это поможет подобрать формат.' }),
        new Date(Date.parse(now) + 10_000).toISOString(),
      ],
    );

    expect(getMeetingTranscriptHash(user.id, conversationId)).not.toBe(originalTranscriptHash);
    await expect(
      service.completeOnboardingFromConversation({
        user,
        conversationId,
      }),
    ).rejects.toThrow('Profile creation is already in progress');
    expect(aiModel.createOperationResponse).not.toHaveBeenCalled();
    expect(
      db.all<{ status: string }>(
        `SELECT status
         FROM student_profile_creation_runs
         WHERE user_id = ?
           AND conversation_id = ?
           AND status = 'running'`,
        [user.id, conversationId],
      ),
    ).toHaveLength(1);
  });

  it('supersedes a stale running conversation profile claim when transcript hash changed', async () => {
    mockConversationProfilePipeline();
    const now = new Date().toISOString();
    const conversationId = 'meeting-conv-stale-changed';
    insertReadyMeeting(conversationId, now);
    const originalTranscriptHash = getMeetingTranscriptHash(user.id, conversationId);
    const staleAt = new Date(Date.now() - 3_600_000).toISOString();
    db.run(
      `INSERT INTO student_profile_creation_runs (
         id, user_id, conversation_id, transcript_hash, status, attempts,
         error_message, started_at, completed_at, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, 'running', 1, NULL, ?, NULL, ?, ?)`,
      [
        'profile-run-stale-changed',
        user.id,
        conversationId,
        originalTranscriptHash,
        staleAt,
        staleAt,
        staleAt,
      ],
    );
    db.run(
      `INSERT INTO tutor_turns (
         id, user_id, conversation_id, request_id, lesson_type, prompt, answer_json, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'turn-stale-changed-extra',
        user.id,
        conversationId,
        'request-stale-changed-extra',
        'meeting',
        'Еще добавлю: хочу тренировать производные через примеры и маленькие задачи',
        JSON.stringify({ answer: 'Хорошо, добавлю это в предварительную стратегию.' }),
        new Date(Date.parse(now) + 10_000).toISOString(),
      ],
    );
    const newTranscriptHash = getMeetingTranscriptHash(user.id, conversationId);

    const status = await service.completeOnboardingFromConversation({
      user,
      conversationId,
    });

    expect(status.onboardingRequired).toBe(false);
    expect(aiModel.createOperationResponse).toHaveBeenCalledTimes(4);
    expect(
      db.all<{
        status: string;
        transcript_hash: string;
        error_message: string | null;
      }>(
        `SELECT status, transcript_hash, error_message
         FROM student_profile_creation_runs
         WHERE user_id = ?
           AND conversation_id = ?
         ORDER BY created_at ASC, id ASC`,
        [user.id, conversationId],
      ),
    ).toEqual([
      {
        status: 'failed',
        transcript_hash: originalTranscriptHash,
        error_message: 'Stale profile creation run superseded by newer meeting transcript',
      },
      {
        status: 'completed',
        transcript_hash: newTranscriptHash,
        error_message: null,
      },
    ]);
  });

  it('supersedes a stale profile claim from another meeting conversation before creating the user profile', async () => {
    mockConversationProfilePipeline();
    const now = new Date().toISOString();
    const staleConversationId = 'meeting-conv-stale-other-user-lock';
    const newConversationId = 'meeting-conv-new-user-lock';
    insertReadyMeeting(staleConversationId, now);
    insertReadyMeeting(newConversationId, now);
    const staleTranscriptHash = getMeetingTranscriptHash(user.id, staleConversationId);
    const newTranscriptHash = getMeetingTranscriptHash(user.id, newConversationId);
    const staleAt = new Date(Date.now() - 3_600_000).toISOString();
    db.run(
      `INSERT INTO student_profile_creation_runs (
         id, user_id, conversation_id, transcript_hash, status, attempts,
         error_message, started_at, completed_at, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, 'running', 1, NULL, ?, NULL, ?, ?)`,
      [
        'profile-run-stale-other-user-lock',
        user.id,
        staleConversationId,
        staleTranscriptHash,
        staleAt,
        staleAt,
        staleAt,
      ],
    );

    const status = await service.completeOnboardingFromConversation({
      user,
      conversationId: newConversationId,
    });

    expect(status.onboardingRequired).toBe(false);
    expect(aiModel.createOperationResponse).toHaveBeenCalledTimes(4);
    expect(
      db.all<{
        conversation_id: string;
        status: string;
        transcript_hash: string;
        error_message: string | null;
      }>(
        `SELECT conversation_id, status, transcript_hash, error_message
         FROM student_profile_creation_runs
         WHERE user_id = ?
         ORDER BY created_at ASC, id ASC`,
        [user.id],
      ),
    ).toEqual([
      {
        conversation_id: staleConversationId,
        status: 'failed',
        transcript_hash: staleTranscriptHash,
        error_message:
          'Stale profile creation run superseded by another meeting conversation',
      },
      {
        conversation_id: newConversationId,
        status: 'completed',
        transcript_hash: newTranscriptHash,
        error_message: null,
      },
    ]);
  });

  it('recovers a completed conversation profile run when the profile row is missing', async () => {
    mockConversationProfilePipeline();
    const now = new Date().toISOString();
    const conversationId = 'meeting-conv-completed-without-profile';
    insertReadyMeeting(conversationId, now);
    const transcriptHash = getMeetingTranscriptHash(user.id, conversationId);
    db.run(
      `INSERT INTO student_profile_creation_runs (
         id, user_id, conversation_id, transcript_hash, status, attempts,
         error_message, started_at, completed_at, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, 'completed', 1, NULL, ?, ?, ?, ?)`,
      [
        'profile-run-completed-missing-profile',
        user.id,
        conversationId,
        transcriptHash,
        now,
        now,
        now,
        now,
      ],
    );

    const status = await service.completeOnboardingFromConversation({
      user,
      conversationId,
    });

    expect(status.onboardingRequired).toBe(false);
    expect(aiModel.createOperationResponse).toHaveBeenCalledTimes(4);
    expect(
      db.get<{ status: string; attempts: number; error_message: string | null }>(
        `SELECT status, attempts, error_message
         FROM student_profile_creation_runs
         WHERE id = ?`,
        ['profile-run-completed-missing-profile'],
      ),
    ).toEqual({
      status: 'completed',
      attempts: 2,
      error_message: null,
    });
  });

  it('reports meeting readiness and ignores the technical starter prompt', async () => {
    const now = new Date().toISOString();
    const conversationId = 'meeting-conv-ready';
    db.run(
      `INSERT INTO lesson_sessions (
         id, user_id, conversation_id, lesson_type, status, goal_status, goal_text,
         success_criteria_json, active_learning_seconds, turn_count, started_at,
         last_activity_at, created_at, updated_at
       )
       VALUES (?, ?, ?, 'meeting', 'active', 'in_progress', ?, ?, 0, 4, ?, ?, ?, ?)`,
      [
        'lesson-meeting-ready',
        user.id,
        conversationId,
        'Понять стартовый учебный контекст ученика.',
        JSON.stringify(['получены ответы о цели']),
        now,
        now,
        now,
        now,
      ],
    );
    for (const [index, prompt] of [
      'Начни первую голосовую встречу с учеником для AI-репетитора ЕГЭ по математике',
      'Готовлюсь к ЕГЭ, хочу 80 баллов, сложны производные',
      'Уровень средний, уверенности мало, часто застреваю на графиках',
      'Мне удобнее сначала пример и медленно; в задаче 2x + 5 = 17 ответ x = 6',
    ].entries()) {
      db.run(
        `INSERT INTO tutor_turns (
           id, user_id, conversation_id, request_id, lesson_type, prompt, answer_json, created_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `turn-ready-${index}`,
          user.id,
          conversationId,
          `request-ready-${index}`,
          'meeting',
          prompt,
          JSON.stringify({ answer: 'Следующий вопрос.' }),
          now,
        ],
      );
    }

    expect(service.getMeetingReadiness(user, conversationId)).toEqual(
      expect.objectContaining({
        conversationId,
        lessonSessionId: 'lesson-meeting-ready',
        canCreateProfile: true,
        meaningfulStudentTurnCount: 3,
        missingSignals: [],
      }),
    );
  });

  it('rejects a conversation profile when the first meeting is too shallow', async () => {
    aiModel.createOperationResponse.mockReset();
    db.run(
      `INSERT INTO tutor_turns (
         id, user_id, conversation_id, request_id, lesson_type, prompt, answer_json, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'turn-short-meeting',
        user.id,
        'meeting-conv-short',
        'request-short-meeting',
        'meeting',
        'Привет',
        JSON.stringify({ answer: 'Привет. Что хочешь улучшить в математике?' }),
        new Date().toISOString(),
      ],
    );

    await expect(
      service.completeOnboardingFromConversation({
        user,
        conversationId: 'meeting-conv-short',
      }),
    ).rejects.toThrow('First meeting needs more teaching context');
    expect(aiModel.createOperationResponse).not.toHaveBeenCalled();
  });

  it('records the initial SQLite migration version', () => {
    expect(
      db.get<{ version: string }>('SELECT version FROM schema_migrations WHERE version = ?', [
        '001_initial_schema',
      ]),
    ).toEqual({ version: '001_initial_schema' });
    expect(
      db.get<{ version: string }>('SELECT version FROM schema_migrations WHERE version = ?', [
        '002_background_ai_jobs',
      ]),
    ).toEqual({ version: '002_background_ai_jobs' });
    expect(
      db.get<{ version: string }>('SELECT version FROM schema_migrations WHERE version = ?', [
        '003_background_observation_windows',
      ]),
    ).toEqual({ version: '003_background_observation_windows' });
    expect(
      db.get<{ version: string }>('SELECT version FROM schema_migrations WHERE version = ?', [
        '004_session_progress_tracking',
      ]),
    ).toEqual({ version: '004_session_progress_tracking' });
    expect(
      db.get<{ version: string }>('SELECT version FROM schema_migrations WHERE version = ?', [
        '005_lesson_lifecycle_usage',
      ]),
    ).toEqual({ version: '005_lesson_lifecycle_usage' });
    expect(
      db.get<{ version: string }>('SELECT version FROM schema_migrations WHERE version = ?', [
        '006_lesson_decision_agent',
      ]),
    ).toEqual({ version: '006_lesson_decision_agent' });
    expect(
      db.get<{ version: string }>('SELECT version FROM schema_migrations WHERE version = ?', [
        '007_verified_learning_loop',
      ]),
    ).toEqual({ version: '007_verified_learning_loop' });
    expect(
      db.get<{ version: string }>('SELECT version FROM schema_migrations WHERE version = ?', [
        '008_knowledge_pack_ingestion',
      ]),
    ).toEqual({ version: '008_knowledge_pack_ingestion' });
    expect(
      db.get<{ version: string }>('SELECT version FROM schema_migrations WHERE version = ?', [
        '009_knowledge_pack_runtime_repair',
      ]),
    ).toEqual({ version: '009_knowledge_pack_runtime_repair' });
    expect(
      db.get<{ version: string }>('SELECT version FROM schema_migrations WHERE version = ?', [
        '010_mastery_policy_and_task_source',
      ]),
    ).toEqual({ version: '010_mastery_policy_and_task_source' });
    expect(
      db.get<{ version: string }>('SELECT version FROM schema_migrations WHERE version = ?', [
        '011_task_identity_and_indexing_state',
      ]),
    ).toEqual({ version: '011_task_identity_and_indexing_state' });
    expect(
      db.get<{ version: string }>('SELECT version FROM schema_migrations WHERE version = ?', [
        '012_generated_task_identity_normalization',
      ]),
    ).toEqual({ version: '012_generated_task_identity_normalization' });
    expect(
      db.get<{ version: string }>('SELECT version FROM schema_migrations WHERE version = ?', [
        '013_student_profile_creation_idempotency',
      ]),
    ).toEqual({ version: '013_student_profile_creation_idempotency' });
    expect(
      db.get<{ version: string }>('SELECT version FROM schema_migrations WHERE version = ?', [
        '014_profile_creation_conversation_lock',
      ]),
    ).toEqual({ version: '014_profile_creation_conversation_lock' });
    expect(
      db.get<{ version: string }>('SELECT version FROM schema_migrations WHERE version = ?', [
        '015_profile_creation_user_lock',
      ]),
    ).toEqual({ version: '015_profile_creation_user_lock' });
    expect(db.all('PRAGMA foreign_key_check')).toEqual([]);
  });
});
