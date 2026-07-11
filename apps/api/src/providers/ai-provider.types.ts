export interface PersonaConfig {
  name?: string;
  description?: string;
  tone?: string;
  locale?: string;
  rules?: string;
}

export interface FileSearchAttachmentConfig {
  documentationIds?: string[];
  ruleIds?: string[];
}

export interface RealtimeSessionRequest {
  sessionId: string;
  conversationId: string;
  voice?: string;
  persona?: PersonaConfig;
  fileSearch?: FileSearchAttachmentConfig;
}

export interface RealtimeSessionResponse {
  id: string;
  model?: string;
  clientSecret: {
    value: string;
    expiresAt: string;
  };
  raw: unknown;
}

export interface AiProvider {
  readonly id: string;
  createRealtimeSession(
    request: RealtimeSessionRequest,
  ): Promise<RealtimeSessionResponse>;
}
