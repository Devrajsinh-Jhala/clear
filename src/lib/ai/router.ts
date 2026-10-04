import { ClearError } from "@/src/lib/api/errors";
import { assertModelId, encodeByokProvider, isByokProvider } from "@/src/lib/ai/byok";
import { resolveClearFreeModel } from "@/src/lib/ai/models";
import { anthropicProvider } from "@/src/lib/ai/providers/anthropic";
import { geminiProvider, resolveLessonModel } from "@/src/lib/ai/providers/gemini";
import { mockProvider } from "@/src/lib/ai/providers/mock";
import { compatibleProvider, openaiProvider, xaiProvider } from "@/src/lib/ai/providers/openai";
import type { AIProvider, InlineAttachment, ProviderCredential } from "@/src/lib/ai/types";

const providers: Record<string, AIProvider> = {
  gemini: geminiProvider,
  openai: openaiProvider,
  anthropic: anthropicProvider,
  xai: xaiProvider,
  compatible: compatibleProvider,
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

export function selectGeneration(input: {
  adapterId?: string;
  model?: string;
  credential?: ProviderCredential;
}): { provider: AIProvider; model: string; credential?: ProviderCredential; storedProviderId: string } {
  if (!input.adapterId) {
    const provider = resolveGenerationProvider();
    return {
      provider,
      model: resolveLessonModel(provider.id, input.model),
      storedProviderId: provider.id,
    };
  }
  if (!isByokProvider(input.adapterId)) {
    throw new ClearError("provider_unavailable", `CLEAR does not have a "${input.adapterId}" provider yet.`, {
      status: 400,
    });
  }
  if (!input.credential?.apiKey) {
    throw new ClearError(
      "provider_not_configured",
      "Connect that provider in Settings. CLEAR did not switch to CLEAR Free.",
      { status: 400 },
    );
  }
  const provider = getProvider(input.adapterId);
  let model: string;
  try {
    model = input.adapterId === "gemini" && !input.model ? resolveClearFreeModel(input.model) : assertModelId(input.model);
  } catch (error) {
    throw new ClearError("invalid_request", error instanceof Error ? error.message : "Choose a model.", { status: 400 });
  }
  return {
    provider,
    model,
    credential: input.credential,
    storedProviderId: encodeByokProvider(input.adapterId),
  };
}

export function assertProviderMedia(provider: AIProvider, attachments?: InlineAttachment[]): void {
  for (const item of attachments ?? []) {
    if (item.mimeType === "application/pdf" && !provider.capabilities.pdf) {
      throw new ClearError(
        "unsupported_attachment",
        `${provider.displayName} cannot read a PDF. Remove the file or use a provider that can. CLEAR did not switch providers.`,
        { status: 400 },
      );
    }
    if (item.mimeType.startsWith("image/") && item.dataBase64 && !provider.capabilities.vision) {
      throw new ClearError(
        "unsupported_attachment",
        `${provider.displayName} cannot read images. Remove the file or use a provider that can. CLEAR did not switch providers.`,
        { status: 400 },
      );
    }
  }
}
