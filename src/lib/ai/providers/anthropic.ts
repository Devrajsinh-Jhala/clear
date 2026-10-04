import { ClearError } from "@/src/lib/api/errors";
import { anthropicGenerate } from "@/src/lib/ai/providers/openai-chat";
import type { AIProvider } from "@/src/lib/ai/types";

export const anthropicProvider: AIProvider = {
  id: "anthropic",
  displayName: "Anthropic",
  capabilities: {
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
  },
  generate(request, credential) {
    if (!credential?.apiKey) {
      throw new ClearError("provider_not_configured", "Connect an Anthropic key before using it.", { status: 400 });
    }
    return anthropicGenerate({ apiKey: credential.apiKey, request });
  },
};
