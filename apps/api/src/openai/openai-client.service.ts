import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

@Injectable()
export class OpenAiClientService {
  private readonly logger = new Logger(OpenAiClientService.name);
  private readonly baseUrl = 'https://api.openai.com/v1';

  constructor(private readonly configService: ConfigService) {}

  async createResponse(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.requestJson('/responses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async generateImage(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.requestJson('/images/generations', {
      method: 'POST',
      body: JSON.stringify(payload),
      timeoutMs: 120_000,
    });
  }

  async createVectorStore(name: string): Promise<Record<string, unknown>> {
    return this.requestJson('/vector_stores', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async uploadFile(file: Express.Multer.File): Promise<Record<string, unknown>> {
    const form = new FormData();
    form.append('purpose', 'assistants');
    const arrayBuffer = file.buffer.buffer.slice(
      file.buffer.byteOffset,
      file.buffer.byteOffset + file.buffer.byteLength,
    ) as ArrayBuffer;
    form.append(
      'file',
      new File([arrayBuffer], file.originalname, {
        type: file.mimetype || 'application/octet-stream',
      }),
    );

    return this.requestJson('/files', {
      method: 'POST',
      body: form,
      headers: {},
      timeoutMs: 120_000,
    });
  }

  async attachFileToVectorStore(
    vectorStoreId: string,
    fileId: string,
  ): Promise<Record<string, unknown>> {
    return this.requestJson(`/vector_stores/${encodeURIComponent(vectorStoreId)}/files`, {
      method: 'POST',
      body: JSON.stringify({ file_id: fileId }),
    });
  }

  async removeFileFromVectorStore(
    vectorStoreId: string,
    fileId: string,
  ): Promise<Record<string, unknown>> {
    return this.requestJson(
      `/vector_stores/${encodeURIComponent(vectorStoreId)}/files/${encodeURIComponent(fileId)}`,
      {
        method: 'DELETE',
      },
    );
  }

  async listVectorStoreFiles(vectorStoreId: string): Promise<Record<string, unknown>> {
    return this.requestJson(`/vector_stores/${encodeURIComponent(vectorStoreId)}/files`, {
      method: 'GET',
    });
  }

  private async requestJson<T extends Record<string, unknown>>(
    path: string,
    options: RequestOptions,
  ): Promise<T> {
    const apiKey = this.configService.get<string>('ai.openai.apiKey');
    if (!apiKey) {
      throw new BadGatewayException('OPENAI_API_KEY is not configured');
    }

    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${apiKey}`);
    if (options.body && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const timeoutMs =
      options.timeoutMs ?? this.configService.get<number>('ai.openai.requestTimeoutMs') ?? 30_000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.error(`OpenAI request ${path} failed (${response.status}): ${body}`);
        throw new BadGatewayException(`OpenAI request failed with status ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`OpenAI request ${path} failed: ${message}`);
      throw new BadGatewayException('OpenAI request failed');
    } finally {
      clearTimeout(timeout);
    }
  }
}
