import { ClearError } from "@/src/lib/api/errors";
import { geminiProvider } from "@/src/lib/ai/providers/gemini";
import { mockProvider } from "@/src/lib/ai/providers/mock";
import type { AIProvider } from "@/src/lib/ai/types";

const providers: Record<string, AIProvider> = {
  gemini: geminiProvider,
  mock: mockProvider,
};

export function listProviders(): AIProvider[] {
  return Object.values(providers);
}

export function getProvider(id: string): AIProvider {
  const provider = providers[id];
  if (!provider) {
    throw new ClearError("provider_unavailable", `CLEAR does not have a "${id}" provider yet.`, {
      status: 400,
    });
  }
  return provider;
}

export function resolveGenerationProvider(): AIProvider {
  if (process.env.CLEAR_PROVIDER === "mock") return mockProvider;
  if (!process.env.GEMINI_API_KEY) {
    throw new ClearError(
      "provider_not_configured",
      "Add GEMINI_API_KEY to .env.local to generate explanations, or open the sample lesson.",
      { status: 503 },
    );
  }
  return geminiProvider;
}
