import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { Readable } from 'stream';
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
  source_kind: string;
  source_path: string | null;
  source_pack_version: string | null;
  content_hash: string | null;
  sync_status: string;
  superseded_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectAiResourceRow {
  resource_id: string;
}

export interface KnowledgeFileDto {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  openaiFileId: string;
  vectorStoreId: string;
  status: string;
  sourceKind: string;
  sourcePath?: string;
  sourcePackVersion?: string;
  contentHash?: string;
  syncStatus: string;
  supersededAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncRagSourceFileInput {
  relativePath: string;
  buffer: Buffer;
  mimeType?: string;
  sourcePackVersion: string;
  contentHash: string;
  dryRun?: boolean;
}

export interface SyncRagSourceFileResult {
  relativePath: string;
  action:
    | 'skipped'
    | 'skipped_cleaned'
    | 'uploaded'
    | 'replaced'
    | 'would_upload'
    | 'would_replace';
  vectorStoreId: string;
  openAiFileId?: string;
  knowledgeFileId?: string;
  contentHash: string;
  supersededCount: number;
}

const STUDENT_RAG_RESOURCE_KEY = 'student_rag_vector_store';
const KNOWLEDGE_PACK_RAG_SOURCE_KIND = 'knowledge_pack_student_rag';

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
        (
          id, original_name, mime_type, size_bytes, openai_file_id,
          vector_store_id, status, source_kind, sync_status, created_at, updated_at
        )
       VALUES (?, ?, ?, ?, ?, ?, ?, 'manual_upload', 'active', ?, ?)`,
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

    this.upsertProjectAiResource(vectorStoreId, { source: 'manual_upload' });

    return this.toDto({
      id,
      original_name: file.originalname,
      mime_type: file.mimetype || 'application/octet-stream',
      size_bytes: file.size,
      openai_file_id: openAiFileId,
      vector_store_id: vectorStoreId,
      status,
      source_kind: 'manual_upload',
      source_path: null,
      source_pack_version: null,
      content_hash: null,
      sync_status: 'active',
      superseded_at: null,
      error_message: null,
      created_at: now,
      updated_at: now,
    });
  }

  async syncRagSourceFile(input: SyncRagSourceFileInput): Promise<SyncRagSourceFileResult> {
    const file = this.toMulterFile(input);
    this.assertSupportedFile(file);
    const vectorStoreId = input.dryRun
      ? this.getActiveVectorStoreIds()[0] ?? 'would_create_vector_store'
      : await this.resolveWritableVectorStoreId();
    const same = this.findCurrentSyncedSource(
      input.relativePath,
      input.contentHash,
      vectorStoreId,
    );
    const stale = this.findStaleSyncedSources(input.relativePath, input.contentHash, vectorStoreId);

    if (same && stale.length === 0) {
      this.upsertSourceFileState({
        relativePath: input.relativePath,
        sourcePackVersion: input.sourcePackVersion,
        contentHash: input.contentHash,
        sizeBytes: input.buffer.length,
        status: 'skipped',
        knowledgeFileId: same.id,
        metadata: { reason: 'same_content_hash', vectorStoreId },
      });
      return {
        relativePath: input.relativePath,
        action: 'skipped',
        vectorStoreId,
        openAiFileId: same.openai_file_id,
        knowledgeFileId: same.id,
        contentHash: input.contentHash,
        supersededCount: 0,
      };
    }

    if (input.dryRun) {
      return {
        relativePath: input.relativePath,
        action: same || stale.length > 0 ? 'would_replace' : 'would_upload',
        vectorStoreId,
        openAiFileId: same?.openai_file_id,
        knowledgeFileId: same?.id,
        contentHash: input.contentHash,
        supersededCount: stale.length,
      };
    }

    if (same) {
      const cleanup = await this.cleanupSupersededSources(stale);
      this.upsertSourceFileState({
        relativePath: input.relativePath,
        sourcePackVersion: input.sourcePackVersion,
        contentHash: input.contentHash,
        sizeBytes: input.buffer.length,
        status: cleanup.failed === 0 ? 'skipped' : 'failed',
        knowledgeFileId: same.id,
        metadata: { reason: 'same_content_hash_cleanup', vectorStoreId, cleanup },
        errorMessage: cleanup.failed === 0 ? undefined : 'Could not remove all stale vector files',
      });
      return {
        relativePath: input.relativePath,
        action: 'skipped_cleaned',
        vectorStoreId,
        openAiFileId: same.openai_file_id,
        knowledgeFileId: same.id,
        contentHash: input.contentHash,
        supersededCount: cleanup.removed,
      };
    }

    const uploadedFile = await this.aiModel.uploadFile(file);
    const openAiFileId = this.pickString(uploadedFile, 'id');
    if (!openAiFileId) {
      throw new BadRequestException('OpenAI did not return a file id');
    }

    const attachment = await this.aiModel.attachFileToVectorStore(vectorStoreId, openAiFileId);
    const status = this.pickString(attachment, 'status') ?? 'queued';
    const now = new Date().toISOString();
    const knowledgeFileId = randomUUID();

    this.db.transaction(() => {
      this.db.run(
        `INSERT INTO knowledge_files (
           id, original_name, mime_type, size_bytes, openai_file_id,
           vector_store_id, status, source_kind, source_path, source_pack_version,
           content_hash, sync_status, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        [
          knowledgeFileId,
          input.relativePath,
          file.mimetype || 'text/markdown',
          file.size,
          openAiFileId,
          vectorStoreId,
          status,
          KNOWLEDGE_PACK_RAG_SOURCE_KIND,
          input.relativePath,
          input.sourcePackVersion,
          input.contentHash,
          now,
          now,
        ],
      );
      this.upsertProjectAiResource(vectorStoreId, {
        source: KNOWLEDGE_PACK_RAG_SOURCE_KIND,
        sourcePackVersion: input.sourcePackVersion,
      });
      this.upsertSourceFileState({
        relativePath: input.relativePath,
        sourcePackVersion: input.sourcePackVersion,
        contentHash: input.contentHash,
        sizeBytes: input.buffer.length,
        status: 'synced',
        knowledgeFileId,
        metadata: { vectorStoreId, openAiFileId },
      });
    });

    const cleanup = await this.cleanupSupersededSources(stale);
    return {
      relativePath: input.relativePath,
      action: stale.length > 0 ? 'replaced' : 'uploaded',
      vectorStoreId,
      openAiFileId,
      knowledgeFileId,
      contentHash: input.contentHash,
      supersededCount: cleanup.removed,
    };
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
          `SELECT
             id, original_name, mime_type, size_bytes, openai_file_id,
             vector_store_id, status, source_kind, source_path,
             source_pack_version, content_hash, sync_status, superseded_at,
             error_message, created_at, updated_at
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

    const resourceRows = this.db.all<ProjectAiResourceRow>(
      `SELECT resource_id
       FROM project_ai_resources
       WHERE resource_key = ?
         AND provider = 'openai'
         AND resource_type = 'vector_store'
       ORDER BY updated_at DESC`,
      [STUDENT_RAG_RESOURCE_KEY],
    );
    if (resourceRows.length > 0) {
      return Array.from(new Set(resourceRows.map((row) => row.resource_id).filter(Boolean)));
    }

    const rows = this.db.all<{ vector_store_id: string }>(
      `SELECT DISTINCT vector_store_id
       FROM knowledge_files
       WHERE sync_status IN ('active', 'cleanup_failed')
       ORDER BY vector_store_id`,
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
    this.upsertProjectAiResource(vectorStoreId, { source: 'created_by_api' });
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

  private findCurrentSyncedSource(
    relativePath: string,
    contentHash: string,
    vectorStoreId: string,
  ): KnowledgeFileRow | undefined {
    return this.db.get<KnowledgeFileRow>(
      `SELECT
         id, original_name, mime_type, size_bytes, openai_file_id,
         vector_store_id, status, source_kind, source_path,
         source_pack_version, content_hash, sync_status, superseded_at,
         error_message, created_at, updated_at
       FROM knowledge_files
       WHERE source_kind = ?
         AND source_path = ?
         AND content_hash = ?
         AND vector_store_id = ?
         AND sync_status = 'active'
         AND superseded_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 1`,
      [KNOWLEDGE_PACK_RAG_SOURCE_KIND, relativePath, contentHash, vectorStoreId],
    );
  }

  private findStaleSyncedSources(
    relativePath: string,
    contentHash: string,
    vectorStoreId: string,
  ): KnowledgeFileRow[] {
    return this.db.all<KnowledgeFileRow>(
      `SELECT
         id, original_name, mime_type, size_bytes, openai_file_id,
         vector_store_id, status, source_kind, source_path,
         source_pack_version, content_hash, sync_status, superseded_at,
         error_message, created_at, updated_at
       FROM knowledge_files
       WHERE source_kind = ?
         AND source_path = ?
         AND content_hash <> ?
         AND vector_store_id = ?
         AND sync_status IN ('active', 'cleanup_failed')
         AND superseded_at IS NULL
       ORDER BY updated_at DESC`,
      [KNOWLEDGE_PACK_RAG_SOURCE_KIND, relativePath, contentHash, vectorStoreId],
    );
  }

  private async cleanupSupersededSources(
    staleRows: KnowledgeFileRow[],
  ): Promise<{ removed: number; failed: number }> {
    let removed = 0;
    let failed = 0;
    const now = new Date().toISOString();

    for (const row of staleRows) {
      try {
        await this.aiModel.removeFileFromVectorStore(row.vector_store_id, row.openai_file_id);
        this.db.run(
          `UPDATE knowledge_files
           SET sync_status = 'superseded',
               superseded_at = ?,
               error_message = NULL,
               updated_at = ?
           WHERE id = ?`,
          [now, now, row.id],
        );
        removed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.db.run(
          `UPDATE knowledge_files
           SET sync_status = 'cleanup_failed',
               error_message = ?,
               updated_at = ?
           WHERE id = ?`,
          [message.slice(0, 1_000), now, row.id],
        );
        failed += 1;
      }
    }

    return { removed, failed };
  }

  private upsertProjectAiResource(
    vectorStoreId: string,
    metadata: Record<string, unknown>,
  ): void {
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO project_ai_resources (
         resource_key, provider, resource_type, resource_id, metadata_json,
         created_at, updated_at
       )
       VALUES (?, 'openai', 'vector_store', ?, ?, ?, ?)
       ON CONFLICT(resource_key) DO UPDATE SET
         provider = excluded.provider,
         resource_type = excluded.resource_type,
         resource_id = excluded.resource_id,
         metadata_json = excluded.metadata_json,
         updated_at = excluded.updated_at`,
      [
        STUDENT_RAG_RESOURCE_KEY,
        vectorStoreId,
        JSON.stringify({ ...metadata, purpose: 'student_rag' }),
        now,
        now,
      ],
    );
  }

  private upsertSourceFileState(input: {
    relativePath: string;
    sourcePackVersion: string;
    contentHash: string;
    sizeBytes: number;
    status: 'imported' | 'synced' | 'skipped' | 'failed';
    knowledgeFileId?: string;
    metadata: Record<string, unknown>;
    errorMessage?: string;
  }): void {
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO knowledge_source_files (
         id, source_pack_version, relative_path, target_kind, content_hash,
         size_bytes, status, knowledge_file_id, metadata_json, error_message,
         created_at, updated_at
       )
       VALUES (?, ?, ?, 'student_rag', ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(source_pack_version, relative_path, target_kind) DO UPDATE SET
         content_hash = excluded.content_hash,
         size_bytes = excluded.size_bytes,
         status = excluded.status,
         knowledge_file_id = excluded.knowledge_file_id,
         metadata_json = excluded.metadata_json,
         error_message = excluded.error_message,
         updated_at = excluded.updated_at`,
      [
        randomUUID(),
        input.sourcePackVersion,
        input.relativePath,
        input.contentHash,
        input.sizeBytes,
        input.status,
        input.knowledgeFileId ?? null,
        JSON.stringify(input.metadata),
        input.errorMessage ?? null,
        now,
        now,
      ],
    );
  }

  private assertSupportedFile(
    file: Express.Multer.File | undefined,
  ): asserts file is Express.Multer.File {
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
      sourceKind: row.source_kind,
      sourcePath: row.source_path ?? undefined,
      sourcePackVersion: row.source_pack_version ?? undefined,
      contentHash: row.content_hash ?? undefined,
      syncStatus: row.sync_status,
      supersededAt: row.superseded_at ?? undefined,
      errorMessage: row.error_message ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toMulterFile(input: SyncRagSourceFileInput): Express.Multer.File {
    return {
      fieldname: 'file',
      originalname: input.relativePath,
      encoding: '7bit',
      mimetype: input.mimeType ?? 'text/markdown',
      size: input.buffer.length,
      buffer: input.buffer,
      stream: Readable.from(input.buffer),
      destination: '',
      filename: input.relativePath,
      path: '',
    };
  }

  private pickString(source: Record<string, unknown>, key: string): string | undefined {
    const value = source[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  }
}
