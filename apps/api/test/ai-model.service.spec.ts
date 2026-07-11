import { AiModelService } from '../src/ai-model/ai-model.service';

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
});
