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
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          'ai.openai.responsesModel': 'gpt-test',
          'ai.openai.imageModel': 'gpt-image-test',
        };
        return values[key];
      }),
    } as unknown as ConfigService;
    const knowledge = {
      getActiveVectorStoreIds: jest.fn(() => ['vs_test']),
    };
    const aiModel = {
      createResponse: jest.fn(async () =>
        overrides.response ?? {
          output: [
            {
              type: 'message',
              content: [
                {
                  type: 'output_text',
                  text: JSON.stringify({
                    answer: 'Решаем через дискриминант.',
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
      generateImage: jest.fn(async () => ({
        data: [{ b64_json: 'abc123', revised_prompt: 'diagram' }],
      })),
    };
    const studentProfile = {
      getTutorContext: jest.fn(() => 'Профиль ученика: нужен спокойный темп и примеры.'),
    };

    return {
      service: new TutorService(
        db as any,
        config,
        knowledge as any,
        aiModel as any,
        studentProfile as any,
      ),
      db,
      aiModel,
      studentProfile,
    };
  }

  it('returns structured tutor output with citations', async () => {
    const { service, db, aiModel } = createService();

    const result = await service.answerMessage({
      user,
      message: 'Объясни квадратное уравнение',
      conversationId: 'conv-1',
      source: 'text',
    });

    expect(result.answer).toContain('дискриминант');
    expect(result.tasks).toHaveLength(1);
    expect(result.examples).toHaveLength(1);
    expect(result.needsImage).toBe(true);
    expect(result.citations).toEqual([{ fileId: 'file_1', filename: 'ege.pdf', quote: undefined }]);
    expect(db.run).toHaveBeenCalled();
    expect(aiModel.createResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-test',
        tools: [expect.objectContaining({ type: 'file_search', vector_store_ids: ['vs_test'] })],
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
    });

    expect(studentProfile.getTutorContext).toHaveBeenCalledWith(user.id);
    expect(JSON.stringify((aiModel.createResponse as jest.Mock).mock.calls[0][0])).toContain(
      'нужен спокойный темп',
    );
  });

  it('generates an image data URL', async () => {
    const { service, aiModel } = createService();

    const result = await service.generateImage({
      prompt: 'Парабола y=x^2',
      context: 'Квадратичная функция',
    });

    expect(result.dataUrl).toBe('data:image/png;base64,abc123');
    expect(aiModel.generateImage).toHaveBeenCalledWith(expect.objectContaining({ model: 'gpt-image-test' }));
  });
});
