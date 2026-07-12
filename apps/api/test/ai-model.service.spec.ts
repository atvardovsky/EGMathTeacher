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
    await expect(service.listVectorStoreFiles('vs_1')).resolves.toEqual({ data: [] });

    expect(service.id).toBe('openai');
    expect(provider.createResponse).toHaveBeenCalledWith({ model: 'test' });
    expect(provider.attachFileToVectorStore).toHaveBeenCalledWith('vs_1', 'file_1');
  });

  it('applies role and operation model policy to response requests', async () => {
    const provider = {
      id: 'openai',
      createResponse: jest.fn(async () => ({ output_text: '{}' })),
      generateImage: jest.fn(async () => ({ data: [] })),
      createVectorStore: jest.fn(),
      uploadFile: jest.fn(),
      attachFileToVectorStore: jest.fn(),
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
    const service = new AiModelService(provider, policy);

    await service.createOperationResponse('tutorAnswerWithRag', {
      instructions: 'answer',
      metadata: { existing: 'value' },
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
  });

  it('applies operation image model policy', async () => {
    const provider = {
      id: 'openai',
      createResponse: jest.fn(),
      generateImage: jest.fn(async () => ({ data: [] })),
      createVectorStore: jest.fn(),
      uploadFile: jest.fn(),
      attachFileToVectorStore: jest.fn(),
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
});
