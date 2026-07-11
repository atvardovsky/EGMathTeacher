export interface AiModelProvider {
  readonly id: string;
  createResponse(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  generateImage(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  createVectorStore(name: string): Promise<Record<string, unknown>>;
  uploadFile(file: Express.Multer.File): Promise<Record<string, unknown>>;
  attachFileToVectorStore(
    vectorStoreId: string,
    fileId: string,
  ): Promise<Record<string, unknown>>;
  listVectorStoreFiles(vectorStoreId: string): Promise<Record<string, unknown>>;
}
