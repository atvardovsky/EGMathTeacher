import { Inject, Injectable, Optional } from '@nestjs/common';
import { AI_MODEL_PROVIDER_TOKEN } from './ai-model.constants';
import { AiOperationPolicyService } from './ai-operation-policy.service';
import {
  AiOperationPayload,
  AiModelProvider,
  AiOperationKey,
  AiOperationFailureReason,
  ResolvedAiOperationPolicy,
  AiProviderRequestOptions,
} from './ai-model.types';
import { UsageService } from '../usage/usage.service';

@Injectable()
export class AiModelService implements AiModelProvider {
  constructor(
    @Inject(AI_MODEL_PROVIDER_TOKEN)
    private readonly provider: AiModelProvider,
    @Optional()
    private readonly operationPolicy?: AiOperationPolicyService,
    @Optional()
    private readonly usageService?: UsageService,
  ) {}

  get id(): string {
    return this.provider.id;
  }

  createResponse(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.provider.createResponse(payload);
  }

  createOperationResponse(
    operationKey: AiOperationKey,
    payload: AiOperationPayload,
  ): Promise<Record<string, unknown>> {
    const policy = this.resolveOperationPolicy(operationKey);
    const request = this.applyResponsePolicy(payload, policy);
    return this.callResponseProvider(policy, payload, request);
  }

  generateImage(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.provider.generateImage(payload);
  }

  generateOperationImage(
    operationKey: AiOperationKey,
    payload: AiOperationPayload,
  ): Promise<Record<string, unknown>> {
    const policy = this.resolveOperationPolicy(operationKey);
    const request = this.withoutUsageContext({ ...payload, model: policy.model });
    return this.callImageProvider(policy, payload, request);
  }

  resolveOperationPolicy(operationKey: AiOperationKey): ResolvedAiOperationPolicy {
    if (this.operationPolicy) {
      return this.operationPolicy.resolve(operationKey);
    }
    const model = 'gpt-5.5';
    return {
      operationKey,
      operation: operationKey,
      role: 'tutor',
      provider: this.provider.id,
      model,
      responseFormat: 'json',
      promptCacheKeyEnabled: false,
    };
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

  removeFileFromVectorStore(
    vectorStoreId: string,
    fileId: string,
  ): Promise<Record<string, unknown>> {
    return this.provider.removeFileFromVectorStore(vectorStoreId, fileId);
  }

  listVectorStoreFiles(vectorStoreId: string): Promise<Record<string, unknown>> {
    return this.provider.listVectorStoreFiles(vectorStoreId);
  }

  private applyResponsePolicy(
    payload: AiOperationPayload,
    policy: ResolvedAiOperationPolicy,
  ): Record<string, unknown> {
    const providerPayload = this.withoutUsageContext(payload);
    const request: Record<string, unknown> = {
      ...providerPayload,
      model: policy.model,
      metadata: this.mergeMetadata(providerPayload.metadata, policy),
    };
    if (policy.serviceTier) {
      request.service_tier = policy.serviceTier;
    }
    return request;
  }

  private async callResponseProvider(
    policy: ResolvedAiOperationPolicy,
    payload: AiOperationPayload,
    request: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const options = this.getProviderRequestOptions(payload);
    try {
      const response = options
        ? await this.provider.createResponse(request, options)
        : await this.provider.createResponse(request);
      this.usageService?.recordOperation(policy, payload.usageContext, request, response);
      return response;
    } catch (error) {
      this.usageService?.recordOperationFailure(
        policy,
        payload.usageContext,
        request,
        this.getProviderFailureReason(error),
      );
      throw error;
    }
  }

  private async callImageProvider(
    policy: ResolvedAiOperationPolicy,
    payload: AiOperationPayload,
    request: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    try {
      const response = await this.provider.generateImage(request);
      this.usageService?.recordOperation(policy, payload.usageContext, request, response);
      return response;
    } catch (error) {
      this.usageService?.recordOperationFailure(
        policy,
        payload.usageContext,
        request,
        this.getProviderFailureReason(error),
      );
      throw error;
    }
  }

  private withoutUsageContext(payload: AiOperationPayload): Record<string, unknown> {
    const {
      usageContext: _usageContext,
      abortSignal: _abortSignal,
      ...providerPayload
    } = payload;
    return providerPayload;
  }

  private getProviderRequestOptions(
    payload: AiOperationPayload,
  ): AiProviderRequestOptions | undefined {
    return payload.abortSignal ? { signal: payload.abortSignal } : undefined;
  }

  private getProviderFailureReason(error: unknown): AiOperationFailureReason {
    const status = this.getHttpStatus(error);
    const message = this.extractErrorMessage(error).toLowerCase();
    if (status === 504 || message.includes('timed out')) {
      return 'timeout';
    }
    if (
      (status === 503 && message.includes('aborted by caller')) ||
      (message.includes('abort') && !message.includes('timeout'))
    ) {
      return 'caller_abort';
    }
    return 'provider_failure';
  }

  private getHttpStatus(error: unknown): number | undefined {
    const maybeHttp = error as { getStatus?: unknown };
    if (typeof maybeHttp?.getStatus === 'function') {
      const status = maybeHttp.getStatus();
      return typeof status === 'number' ? status : undefined;
    }
    return undefined;
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    const response = (error as { getResponse?: unknown })?.getResponse;
    if (typeof response === 'function') {
      const value = response.call(error);
      if (typeof value === 'string') {
        return value;
      }
      if (value && typeof value === 'object') {
        const message = (value as Record<string, unknown>).message;
        return Array.isArray(message) ? message.join(' ') : String(message ?? '');
      }
    }
    return String(error ?? '');
  }

  private mergeMetadata(
    metadata: unknown,
    policy: ResolvedAiOperationPolicy,
  ): Record<string, unknown> {
    const existing =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? { ...(metadata as Record<string, unknown>) }
        : {};
    return {
      ...existing,
      ai_role: policy.role,
      ai_operation: policy.operation,
      ai_provider: policy.provider,
    };
  }
}
