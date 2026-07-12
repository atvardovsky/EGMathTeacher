import { OpenAiClientService } from '../openai/openai-client.service';
import { AiModelProvider } from './ai-model.types';

export class OpenAiModelProvider implements AiModelProvider {
  readonly id = 'openai';

  constructor(private readonly openAiClient: OpenAiClientService) {}

  createResponse(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.openAiClient.createResponse(payload);
  }

  generateImage(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.openAiClient.generateImage(payload);
  }

  createVectorStore(name: string): Promise<Record<string, unknown>> {
    return this.openAiClient.createVectorStore(name);
  }

  uploadFile(file: Express.Multer.File): Promise<Record<string, unknown>> {
    return this.openAiClient.uploadFile(file);
  }

  attachFileToVectorStore(
    vectorStoreId: string,
    fileId: string,
  ): Promise<Record<string, unknown>> {
    return this.openAiClient.attachFileToVectorStore(vectorStoreId, fileId);
  }

  removeFileFromVectorStore(
    vectorStoreId: string,
    fileId: string,
  ): Promise<Record<string, unknown>> {
    return this.openAiClient.removeFileFromVectorStore(vectorStoreId, fileId);
  }

  listVectorStoreFiles(vectorStoreId: string): Promise<Record<string, unknown>> {
    return this.openAiClient.listVectorStoreFiles(vectorStoreId);
  }
}
