import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiProviderRequestOptions } from '../ai-model/ai-model.types';

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

@Injectable()
export class OpenAiClientService {
  private readonly logger = new Logger(OpenAiClientService.name);
  private readonly baseUrl = 'https://api.openai.com/v1';

  constructor(private readonly configService: ConfigService) {}

  async createResponse(
    payload: Record<string, unknown>,
    requestOptions: AiProviderRequestOptions = {},
  ): Promise<Record<string, unknown>> {
    return this.requestJson('/responses', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal: requestOptions.signal,
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
    let abortReason: 'timeout' | 'caller' | undefined;
    const timeout = setTimeout(() => {
      abortReason ??= 'timeout';
      controller.abort(new Error('openai_request_timeout'));
    }, timeoutMs);
    const callerSignal = options.signal;
    const abortFromCaller = () => {
      abortReason ??= 'caller';
      controller.abort(
        callerSignal?.reason ?? new Error('openai_request_aborted_by_caller'),
      );
    };
    if (callerSignal?.aborted) {
      abortFromCaller();
    } else {
      callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.error(`OpenAI request ${path} failed (${response.status}): ${body}`);
        throw new BadGatewayException(this.formatOpenAiError(response.status, body));
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (abortReason === 'caller') {
        this.logger.warn(`OpenAI request ${path} aborted by caller`);
        throw new ServiceUnavailableException('OpenAI request aborted by caller');
      }
      if (abortReason === 'timeout') {
        this.logger.error(`OpenAI request ${path} timed out after ${timeoutMs}ms`);
        throw new GatewayTimeoutException('OpenAI request timed out');
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`OpenAI request ${path} failed: ${message}`);
      throw new BadGatewayException('OpenAI request failed');
    } finally {
      callerSignal?.removeEventListener('abort', abortFromCaller);
      clearTimeout(timeout);
    }
  }

  private formatOpenAiError(status: number, body: string): string {
    const prefix = `OpenAI request failed with status ${status}`;
    const detail = this.extractOpenAiErrorDetail(body);
    return detail ? `${prefix}: ${detail}` : prefix;
  }

  private extractOpenAiErrorDetail(body: string): string | undefined {
    try {
      const parsed = JSON.parse(body) as unknown;
      const record =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
      const error = record.error;
      const errorRecord =
        error && typeof error === 'object' && !Array.isArray(error)
          ? (error as Record<string, unknown>)
          : {};
      let message: string | undefined;
      if (typeof errorRecord.message === 'string') {
        message = errorRecord.message;
      } else if (typeof record.message === 'string') {
        message = record.message;
      }
      const param = typeof errorRecord.param === 'string' ? errorRecord.param : undefined;
      const code = typeof errorRecord.code === 'string' ? errorRecord.code : undefined;
      return this.compactErrorDetail(
        [message, param ? `param=${param}` : undefined, code ? `code=${code}` : undefined]
          .filter((item): item is string => Boolean(item))
          .join(' '),
      );
    } catch {
      return this.compactErrorDetail(body);
    }
  }

  private compactErrorDetail(value: string): string | undefined {
    const compact = value.replace(/\s+/g, ' ').trim();
    return compact ? compact.slice(0, 500) : undefined;
  }
}
