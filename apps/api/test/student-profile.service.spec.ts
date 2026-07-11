import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { tmpdir } from 'os';
import { AuthSession } from '../src/auth/auth.types';
import { DatabaseService } from '../src/database/database.service';
import { StudentProfileService } from '../src/student-profile/student-profile.service';

function createConfig(sqlitePath: string): ConfigService {
  const values: Record<string, unknown> = {
    'app.sqlitePath': sqlitePath,
    'ai.openai.responsesModel': 'gpt-test',
  };
  return {
    get: <T>(key: string) => values[key] as T,
  } as ConfigService;
}

describe('StudentProfileService', () => {
  let db: DatabaseService;
  let service: StudentProfileService;
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
    createResponse: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    aiModel.createResponse
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
    const config = createConfig(sqlitePath);
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
    expect(aiModel.createResponse).toHaveBeenCalledTimes(3);
    expect(aiModel.createResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-test',
        tools: [expect.objectContaining({ type: 'file_search', vector_store_ids: ['vs_profile'] })],
      }),
    );
    const specialistNames = (aiModel.createResponse as jest.Mock).mock.calls.map(
      ([payload]) => payload.metadata.profile_specialist,
    );
    expect(specialistNames).toEqual([
      'math-knowledge-diagnostician',
      'psychopedagogical-profiler',
      'teaching-strategy-planner',
    ]);
    const psychopedagogicalPayload = (aiModel.createResponse as jest.Mock).mock.calls[1][0];
    expect(psychopedagogicalPayload.instructions).toContain('только учебно полезные сигналы');
    expect(psychopedagogicalPayload.input[0].content[0].text).not.toMatch(/СДВГ|семье/i);
    expect(service.getTutorContext(user.id)).toContain('учебно полезных сигналов');
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
  });
});
