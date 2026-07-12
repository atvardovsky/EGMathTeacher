import { BadGatewayException, Logger } from '@nestjs/common';
import { AiModelProvider } from './ai-model.types';

export class StubModelProvider implements AiModelProvider {
  private readonly logger = new Logger(StubModelProvider.name);

  constructor(readonly id: string) {}

  async createResponse(_payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.notImplemented('Responses');
  }

  async generateImage(_payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.notImplemented('image generation');
  }

  async createVectorStore(_name: string): Promise<Record<string, unknown>> {
    return this.notImplemented('vector stores');
  }

  async uploadFile(_file: Express.Multer.File): Promise<Record<string, unknown>> {
    return this.notImplemented('file upload');
  }

  async attachFileToVectorStore(
    _vectorStoreId: string,
    _fileId: string,
  ): Promise<Record<string, unknown>> {
    return this.notImplemented('vector store attachments');
  }

  async removeFileFromVectorStore(
    _vectorStoreId: string,
    _fileId: string,
  ): Promise<Record<string, unknown>> {
    return this.notImplemented('vector store attachment removal');
  }

  async listVectorStoreFiles(_vectorStoreId: string): Promise<Record<string, unknown>> {
    return this.notImplemented('vector store file listing');
  }

  private notImplemented(operation: string): never {
    this.logger.warn(`AI model provider "${this.id}" does not implement ${operation}.`);
    throw new BadGatewayException(`AI model provider "${this.id}" is not implemented`);
  }
}
