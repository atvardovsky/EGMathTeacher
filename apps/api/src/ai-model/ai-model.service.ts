import { Inject, Injectable, Optional } from '@nestjs/common';
import { AI_MODEL_PROVIDER_TOKEN } from './ai-model.constants';
import { AiOperationPolicyService } from './ai-operation-policy.service';
import {
  AiModelProvider,
  AiOperationKey,
  ResolvedAiOperationPolicy,
} from './ai-model.types';

@Injectable()
export class AiModelService implements AiModelProvider {
  constructor(
    @Inject(AI_MODEL_PROVIDER_TOKEN)
    private readonly provider: AiModelProvider,
    @Optional()
    private readonly operationPolicy?: AiOperationPolicyService,
  ) {}

  get id(): string {
    return this.provider.id;
  }

  createResponse(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.provider.createResponse(payload);
  }

  createOperationResponse(
    operationKey: AiOperationKey,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const policy = this.resolveOperationPolicy(operationKey);
    return this.provider.createResponse(this.applyResponsePolicy(payload, policy));
  }

  generateImage(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.provider.generateImage(payload);
  }

  generateOperationImage(
    operationKey: AiOperationKey,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const policy = this.resolveOperationPolicy(operationKey);
    return this.provider.generateImage({ ...payload, model: policy.model });
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

  listVectorStoreFiles(vectorStoreId: string): Promise<Record<string, unknown>> {
    return this.provider.listVectorStoreFiles(vectorStoreId);
  }

  private applyResponsePolicy(
    payload: Record<string, unknown>,
    policy: ResolvedAiOperationPolicy,
  ): Record<string, unknown> {
    const request: Record<string, unknown> = {
      ...payload,
      model: policy.model,
      metadata: this.mergeMetadata(payload.metadata, policy),
    };
    if (policy.serviceTier) {
      request.service_tier = policy.serviceTier;
    }
    return request;
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
