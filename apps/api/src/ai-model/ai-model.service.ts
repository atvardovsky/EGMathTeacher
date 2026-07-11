import { Inject, Injectable } from '@nestjs/common';
import { AI_MODEL_PROVIDER_TOKEN } from './ai-model.constants';
import { AiModelProvider } from './ai-model.types';

@Injectable()
export class AiModelService implements AiModelProvider {
  constructor(
    @Inject(AI_MODEL_PROVIDER_TOKEN)
    private readonly provider: AiModelProvider,
  ) {}

  get id(): string {
    return this.provider.id;
  }

  createResponse(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.provider.createResponse(payload);
  }

  generateImage(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.provider.generateImage(payload);
  }

  createVectorStore(name: string): Promise<Record<string, unknown>> {
    return this.provider.createVectorStore(name);
  }

  uploadFile(file: Express.Multer.File): Promise<Record<string, unknown>> {
    return this.provider.uploadFile(file);
  }

  attachFileToVectorStore(
    vectorStoreId: string,
    fileId: string,
  ): Promise<Record<string, unknown>> {
    return this.provider.attachFileToVectorStore(vectorStoreId, fileId);
  }

  listVectorStoreFiles(vectorStoreId: string): Promise<Record<string, unknown>> {
    return this.provider.listVectorStoreFiles(vectorStoreId);
  }
}
