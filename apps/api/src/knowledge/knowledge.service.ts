import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { AiModelService } from '../ai-model/ai-model.service';
import { DatabaseService } from '../database/database.service';

interface KnowledgeFileRow {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  openai_file_id: string;
  vector_store_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeFileDto {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  openaiFileId: string;
  vectorStoreId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class KnowledgeService {
  private readonly supportedExtensions = new Set(['.pdf', '.md', '.txt', '.docx', '.tex']);

  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
    private readonly aiModel: AiModelService,
  ) {}

  async uploadKnowledgeFile(file: Express.Multer.File): Promise<KnowledgeFileDto> {
    this.assertSupportedFile(file);
    const vectorStoreId = await this.resolveWritableVectorStoreId();
    const uploadedFile = await this.aiModel.uploadFile(file);
    const openAiFileId = this.pickString(uploadedFile, 'id');
    if (!openAiFileId) {
      throw new BadRequestException('OpenAI did not return a file id');
    }

    const attachment = await this.aiModel.attachFileToVectorStore(vectorStoreId, openAiFileId);
    const status = this.pickString(attachment, 'status') ?? 'queued';
    const now = new Date().toISOString();
    const id = randomUUID();

    this.db.run(
      `INSERT INTO knowledge_files
        (id, original_name, mime_type, size_bytes, openai_file_id, vector_store_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        file.originalname,
        file.mimetype || 'application/octet-stream',
        file.size,
        openAiFileId,
        vectorStoreId,
        status,
        now,
        now,
      ],
    );

    return this.toDto({
      id,
      original_name: file.originalname,
      mime_type: file.mimetype || 'application/octet-stream',
      size_bytes: file.size,
      openai_file_id: openAiFileId,
      vector_store_id: vectorStoreId,
      status,
      created_at: now,
      updated_at: now,
    });
  }

  async getStatus(): Promise<{ vectorStoreIds: string[]; files: KnowledgeFileDto[] }> {
    const vectorStoreIds = this.getActiveVectorStoreIds();
    if (vectorStoreIds.length > 0) {
      await this.refreshStatuses(vectorStoreIds);
    }

    return {
      vectorStoreIds,
      files: this.db
        .all<KnowledgeFileRow>(
          `SELECT id, original_name, mime_type, size_bytes, openai_file_id, vector_store_id, status, created_at, updated_at
           FROM knowledge_files
           ORDER BY created_at DESC`,
        )
        .map((row) => this.toDto(row)),
    };
  }

  getActiveVectorStoreIds(): string[] {
    const configured =
      this.configService.get<string[]>('ai.openai.vectorStoreIds')?.filter(Boolean) ?? [];
    if (configured.length > 0) {
      return Array.from(new Set(configured));
    }

    const rows = this.db.all<{ vector_store_id: string }>(
      'SELECT DISTINCT vector_store_id FROM knowledge_files ORDER BY vector_store_id',
    );
    return rows.map((row) => row.vector_store_id).filter(Boolean);
  }

  private async resolveWritableVectorStoreId(): Promise<string> {
    const existing = this.getActiveVectorStoreIds();
    if (existing.length > 0) {
      return existing[0];
    }

    const vectorStore = await this.aiModel.createVectorStore('EGMathTeacher ЕГЭ knowledge');
    const vectorStoreId = this.pickString(vectorStore, 'id');
    if (!vectorStoreId) {
      throw new BadRequestException('OpenAI did not return a vector store id');
    }
    return vectorStoreId;
  }

  private async refreshStatuses(vectorStoreIds: string[]): Promise<void> {
    const statusByFileId = new Map<string, string>();

    for (const vectorStoreId of vectorStoreIds) {
      const response = await this.aiModel.listVectorStoreFiles(vectorStoreId);
      const data = Array.isArray(response.data) ? (response.data as Record<string, unknown>[]) : [];
      for (const entry of data) {
        const fileId = this.pickString(entry, 'id') ?? this.pickString(entry, 'file_id');
        const status = this.pickString(entry, 'status');
        if (fileId && status) {
          statusByFileId.set(fileId, status);
        }
      }
    }

    const now = new Date().toISOString();
    for (const [openAiFileId, status] of statusByFileId.entries()) {
      this.db.run('UPDATE knowledge_files SET status = ?, updated_at = ? WHERE openai_file_id = ?', [
        status,
        now,
        openAiFileId,
      ]);
    }
  }

  private assertSupportedFile(file: Express.Multer.File | undefined): asserts file is Express.Multer.File {
    if (!file?.buffer || file.size <= 0) {
      throw new BadRequestException('Upload a non-empty file');
    }

    const extension = extname(file.originalname).toLowerCase();
    if (!this.supportedExtensions.has(extension)) {
      throw new BadRequestException('Supported knowledge files: PDF, Markdown, TXT, DOCX, TeX');
    }
  }

  private toDto(row: KnowledgeFileRow): KnowledgeFileDto {
    return {
      id: row.id,
      originalName: row.original_name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      openaiFileId: row.openai_file_id,
      vectorStoreId: row.vector_store_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private pickString(source: Record<string, unknown>, key: string): string | undefined {
    const value = source[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  }
}
