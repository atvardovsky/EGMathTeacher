import { AiModelService } from '../src/ai-model/ai-model.service';
import { AiOperationPolicyService } from '../src/ai-model/ai-operation-policy.service';

describe('AiModelService', () => {
  it('delegates model operations to the configured provider', async () => {
    const provider = {
      id: 'openai',
      createResponse: jest.fn(async () => ({ output_text: '{}' })),
      generateImage: jest.fn(async () => ({ data: [] })),
      createVectorStore: jest.fn(async () => ({ id: 'vs_1' })),
      uploadFile: jest.fn(async () => ({ id: 'file_1' })),
      attachFileToVectorStore: jest.fn(async () => ({ status: 'queued' })),
      removeFileFromVectorStore: jest.fn(async () => ({ deleted: true })),
      listVectorStoreFiles: jest.fn(async () => ({ data: [] })),
    };
    const service = new AiModelService(provider);

    await expect(service.createResponse({ model: 'test' })).resolves.toEqual({ output_text: '{}' });
    await expect(service.generateImage({ prompt: 'graph' })).resolves.toEqual({ data: [] });
    await expect(service.createVectorStore('knowledge')).resolves.toEqual({ id: 'vs_1' });
    await expect(service.uploadFile({ originalname: 'a.txt' } as any)).resolves.toEqual({ id: 'file_1' });
    await expect(service.attachFileToVectorStore('vs_1', 'file_1')).resolves.toEqual({
      status: 'queued',
    });
    await expect(service.removeFileFromVectorStore('vs_1', 'file_1')).resolves.toEqual({
      deleted: true,
    });
    await expect(service.listVectorStoreFiles('vs_1')).resolves.toEqual({ data: [] });

    expect(service.id).toBe('openai');
    expect(provider.createResponse).toHaveBeenCalledWith({ model: 'test' });
    expect(provider.attachFileToVectorStore).toHaveBeenCalledWith('vs_1', 'file_1');
    expect(provider.removeFileFromVectorStore).toHaveBeenCalledWith('vs_1', 'file_1');
  });

  it('applies role and operation model policy to response requests', async () => {
    const provider = {
      id: 'openai',
      createResponse: jest.fn(async () => ({ output_text: '{}' })),
      generateImage: jest.fn(async () => ({ data: [] })),
      createVectorStore: jest.fn(),
      uploadFile: jest.fn(),
      attachFileToVectorStore: jest.fn(),
      removeFileFromVectorStore: jest.fn(),
      listVectorStoreFiles: jest.fn(),
    };
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          'ai.modelProvider': 'openai',
          'ai.operationModels.tutorAnswerWithRag': 'gpt-tutor-rag',
          'ai.operationServiceTiers.tutorAnswerWithRag': 'flex',
        };
        return values[key];
      }),
    };
    const policy = new AiOperationPolicyService(config as any);
    const usage = {
      recordOperation: jest.fn(),
    };
    const service = new AiModelService(provider, policy, usage as any);

    await service.createOperationResponse('tutorAnswerWithRag', {
      instructions: 'answer',
      metadata: { existing: 'value' },
      usageContext: {
        userId: 'user-1',
        conversationId: 'conv-1',
        lessonSessionId: 'lesson-1',
      },
    });

    expect(provider.createResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-tutor-rag',
        service_tier: 'flex',
        metadata: expect.objectContaining({
          existing: 'value',
          ai_role: 'tutor',
          ai_operation: 'tutor.answer_with_rag',
          ai_provider: 'openai',
        }),
      }),
    );
    expect(provider.createResponse).not.toHaveBeenCalledWith(
      expect.objectContaining({
        usageContext: expect.anything(),
      }),
    );
    expect(usage.recordOperation).toHaveBeenCalledWith(
      expect.objectContaining({ operationKey: 'tutorAnswerWithRag' }),
      expect.objectContaining({ lessonSessionId: 'lesson-1' }),
      expect.not.objectContaining({ usageContext: expect.anything() }),
      { output_text: '{}' },
    );
  });

  it('records failed provider attempts without raw usage when a response call fails', async () => {
    const provider = {
      id: 'openai',
      createResponse: jest.fn(async () => {
        throw new Error('provider unavailable');
      }),
      generateImage: jest.fn(),
      createVectorStore: jest.fn(),
      uploadFile: jest.fn(),
      attachFileToVectorStore: jest.fn(),
      removeFileFromVectorStore: jest.fn(),
      listVectorStoreFiles: jest.fn(),
    };
    const usage = {
      recordOperation: jest.fn(),
      recordOperationFailure: jest.fn(),
    };
    const service = new AiModelService(provider, undefined, usage as any);

    await expect(
      service.createOperationResponse('tutorAnswer', {
        instructions: 'answer',
        usageContext: {
          userId: 'student-1',
          conversationId: 'conv-1',
          lessonSessionId: 'lesson-1',
        },
      }),
    ).rejects.toThrow('provider unavailable');

    expect(usage.recordOperation).not.toHaveBeenCalled();
    expect(usage.recordOperationFailure).toHaveBeenCalledWith(
      expect.objectContaining({ operationKey: 'tutorAnswer' }),
      expect.objectContaining({ userId: 'student-1' }),
      expect.objectContaining({ model: 'gpt-5.5' }),
      'provider_failure',
    );
  });

  it('classifies provider abort failures separately from provider outages', async () => {
    const provider = {
      id: 'openai',
      createResponse: jest.fn(async () => {
        throw Object.assign(new Error('operation aborted by caller'), {
          getStatus: () => 503,
        });
      }),
      generateImage: jest.fn(),
      createVectorStore: jest.fn(),
      uploadFile: jest.fn(),
      attachFileToVectorStore: jest.fn(),
      removeFileFromVectorStore: jest.fn(),
      listVectorStoreFiles: jest.fn(),
    };
    const usage = {
      recordOperation: jest.fn(),
      recordOperationFailure: jest.fn(),
    };
    const service = new AiModelService(provider, undefined, usage as any);

    await expect(
      service.createOperationResponse('tutorAnswer', {
        instructions: 'answer',
        usageContext: {
          userId: 'student-1',
          conversationId: 'conv-1',
          lessonSessionId: 'lesson-1',
        },
      }),
    ).rejects.toThrow('operation aborted by caller');

    expect(usage.recordOperationFailure).toHaveBeenCalledWith(
      expect.objectContaining({ operationKey: 'tutorAnswer' }),
      expect.objectContaining({ userId: 'student-1' }),
      expect.objectContaining({ model: 'gpt-5.5' }),
      'caller_abort',
    );
  });

  it('keeps abort signals local while passing them to the provider request options', async () => {
    const provider = {
      id: 'openai',
      createResponse: jest.fn(async () => ({ output_text: '{}' })),
      generateImage: jest.fn(),
      createVectorStore: jest.fn(),
      uploadFile: jest.fn(),
      attachFileToVectorStore: jest.fn(),
      removeFileFromVectorStore: jest.fn(),
      listVectorStoreFiles: jest.fn(),
    };
    const controller = new AbortController();
    const service = new AiModelService(provider);

    await service.createOperationResponse('tutorAnswer', {
      instructions: 'answer',
      abortSignal: controller.signal,
    });

    expect(provider.createResponse).toHaveBeenCalledWith(
      expect.not.objectContaining({ abortSignal: expect.anything() }),
      { signal: controller.signal },
    );
  });

  it('applies operation image model policy', async () => {
    const provider = {
      id: 'openai',
      createResponse: jest.fn(),
      generateImage: jest.fn(async () => ({ data: [] })),
      createVectorStore: jest.fn(),
      uploadFile: jest.fn(),
      attachFileToVectorStore: jest.fn(),
      removeFileFromVectorStore: jest.fn(),
      listVectorStoreFiles: jest.fn(),
    };
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          'ai.modelProvider': 'openai',
          'ai.operationModels.tutorImage': 'gpt-image-policy',
        };
        return values[key];
      }),
    };
    const service = new AiModelService(provider, new AiOperationPolicyService(config as any));

    await service.generateOperationImage('tutorImage', { prompt: 'graph' });

    expect(provider.generateImage).toHaveBeenCalledWith({
      model: 'gpt-image-policy',
      prompt: 'graph',
    });
  });

  it('applies lesson decision agent operation policy', async () => {
    const provider = {
      id: 'openai',
      createResponse: jest.fn(async () => ({ output_text: '{}' })),
      generateImage: jest.fn(),
      createVectorStore: jest.fn(),
      uploadFile: jest.fn(),
      attachFileToVectorStore: jest.fn(),
      removeFileFromVectorStore: jest.fn(),
      listVectorStoreFiles: jest.fn(),
    };
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          'ai.modelProvider': 'openai',
          'ai.operationModels.lessonDecision': 'gpt-lesson-decision',
        };
        return values[key];
      }),
    };
    const service = new AiModelService(
      provider,
      new AiOperationPolicyService(config as any),
    );

    await service.createOperationResponse('lessonDecision', { instructions: 'decide' });

    expect(provider.createResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-lesson-decision',
        metadata: expect.objectContaining({
          ai_role: 'lesson_decision_agent',
          ai_operation: 'lesson.decide_next_action',
        }),
      }),
    );
  });

  it('applies cheap background policy to realtime session reviews', async () => {
    const provider = {
      id: 'openai',
      createResponse: jest.fn(async () => ({ output_text: '{}' })),
      generateImage: jest.fn(),
      createVectorStore: jest.fn(),
      uploadFile: jest.fn(),
      attachFileToVectorStore: jest.fn(),
      removeFileFromVectorStore: jest.fn(),
      listVectorStoreFiles: jest.fn(),
    };
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          'ai.modelProvider': 'openai',
          'ai.operationModels.backgroundRealtimeSessionReview': 'gpt-background-cheap',
          'ai.operationServiceTiers.backgroundRealtimeSessionReview': 'flex',
          'ai.background.promptCacheKeyEnabled': true,
        };
        return values[key];
      }),
    };
    const service = new AiModelService(
      provider,
      new AiOperationPolicyService(config as any),
    );

    await service.createOperationResponse('backgroundRealtimeSessionReview', {
      instructions: 'review',
    });

    expect(provider.createResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-background-cheap',
        service_tier: 'flex',
        metadata: expect.objectContaining({
          ai_role: 'background_learning_analyst',
          ai_operation: 'background.review_realtime_session',
        }),
      }),
    );
  });
});
