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

export type UnifiedGenerationRequest = {
  model: string;
  system?: string;
  messages: UnifiedMessage[];
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
