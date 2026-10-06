export type ProviderCapabilities = {
  text: boolean;
  vision: boolean;
  pdf: boolean;
  audioInput: boolean;
  audioOutput: boolean;
  structuredOutput: boolean;
  toolCalling: boolean;
  streaming: boolean;
  realtime: boolean;
  modelDiscovery: boolean;
};

export type ProviderCredential = {
  apiKey: string;
  baseUrl?: string;
};

export type UnifiedMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type InlineAttachment = {
  mimeType: string;
  dataBase64: string;
};

export type UnifiedGenerationRequest = {
  model: string;
  system?: string;
  messages: UnifiedMessage[];
  attachments?: InlineAttachment[];
  temperature?: number;
  maxOutputTokens?: number;
};

export type UnifiedGenerationResponse = {
  text?: string;
  structured?: unknown;
  providerRequestId?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  finishReason?: string;
  /** The model that answered, when a provider had to use a different one. */
  model?: string;
};

export type ModelDescriptor = {
  id: string;
  displayName: string;
};

export interface AIProvider {
  id: string;
  displayName: string;
  capabilities: ProviderCapabilities;
  generate(
    request: UnifiedGenerationRequest,
    credential?: ProviderCredential,
  ): Promise<UnifiedGenerationResponse>;
}
