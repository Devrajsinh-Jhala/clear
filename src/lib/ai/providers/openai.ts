import { ClearError } from "@/src/lib/api/errors";
import type { AIProvider } from "@/src/lib/ai/types";
import { openaiCompatibleGenerate } from "@/src/lib/ai/providers/openai-chat";

const textProvider = {
  text: true,
  vision: true,
  pdf: false,
  audioInput: false,
  audioOutput: false,
  structuredOutput: true,
  toolCalling: false,
  streaming: false,
  realtime: false,
  modelDiscovery: false,
} as const;

export const openaiProvider: AIProvider = {
  id: "openai",
  displayName: "OpenAI",
  capabilities: textProvider,
  generate(request, credential) {
    if (!credential?.apiKey) throw missingKey("OpenAI");
    return openaiCompatibleGenerate({ baseUrl: "https://api.openai.com/v1", apiKey: credential.apiKey, request });
  },
};

export const xaiProvider: AIProvider = {
  id: "xai",
  displayName: "xAI",
  capabilities: { ...textProvider, vision: false },
  generate(request, credential) {
    if (!credential?.apiKey) throw missingKey("xAI");
    return openaiCompatibleGenerate({ baseUrl: "https://api.x.ai/v1", apiKey: credential.apiKey, request });
  },
};

export const compatibleProvider: AIProvider = {
  id: "compatible",
  displayName: "Custom OpenAI-compatible",
  capabilities: textProvider,
  generate(request, credential) {
    if (!credential?.apiKey || !credential.baseUrl) throw missingKey("that custom endpoint");
    return openaiCompatibleGenerate({
      baseUrl: credential.baseUrl,
      apiKey: credential.apiKey,
      request,
      checkSsrf: true,
    });
  },
};

function missingKey(name: string): ClearError {
  return new ClearError("provider_not_configured", `Connect a key for ${name} in Settings. CLEAR did not switch to CLEAR Free.`, {
    status: 400,
  });
}
