import { ClearError } from "@/src/lib/api/errors";
import { assertModelId, encodeByokProvider, isByokProvider } from "@/src/lib/ai/byok";
import { CLEAR_FREE_MODELS, resolveClearFreeModel } from "@/src/lib/ai/models";
import { anthropicProvider } from "@/src/lib/ai/providers/anthropic";
import { geminiProvider, isGeminiBusy, resolveLessonModel } from "@/src/lib/ai/providers/gemini";
import { mockProvider } from "@/src/lib/ai/providers/mock";
import { compatibleProvider, openaiProvider, xaiProvider } from "@/src/lib/ai/providers/openai";
import type { AIProvider, InlineAttachment, ProviderCredential } from "@/src/lib/ai/types";
import { requestContext } from "@/src/lib/api/context";
import { currentAccount } from "@/src/lib/auth/session";
import { currentLearnerId } from "@/src/lib/learning/session";
import { withModelLimits } from "@/src/lib/security/limits";
import { reportServerError } from "@/src/lib/monitoring/server";

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
  return guardedProvider(provider);
}

export function resolveGenerationProvider(): AIProvider {
  if (process.env.CLEAR_PROVIDER === "mock") return guardedProvider(mockProvider);
  if (!process.env.GEMINI_API_KEY) {
    throw new ClearError(
      "provider_not_configured",
      "Add GEMINI_API_KEY to .env.local to generate explanations, or open the sample lesson.",
      { status: 503 },
    );
  }
  return clearFreeProvider();
}

// CLEAR Free stays on Gemini. When the chosen model is overloaded or rate limited it asks the
// other CLEAR Free models in turn and reports which one answered. Each attempt
// is admitted and counted like any other dispatch. BYOK never switches model.
function clearFreeProvider(): AIProvider {
  const guarded = guardedProvider(geminiProvider);
  return {
    ...guarded,
    async generate(input, credential) {
      const models = [input.model, ...CLEAR_FREE_MODELS.map((item) => item.id).filter((id) => id !== input.model)];
      let busy: unknown;
      for (const model of models) {
        try {
          return { ...(await guarded.generate({ ...input, model }, credential)), model };
        } catch (error) {
          if (!isGeminiBusy(error)) throw error;
          busy = error;
        }
      }
      throw busy;
    },
  };
}

/** Quotas wrap dispatch itself, so repairs and enabled fallback each spend an attempt. */
function guardedProvider(provider: AIProvider): AIProvider {
  return {
    ...provider,
    async generate(input, credential) {
      const context = requestContext.getStore();
      // Standalone evals and adapter tests explicitly select their own model and budget.
      if (!context) return provider.generate(input, credential);
      const account = await currentAccount();
      try {
        return await withModelLimits({
          providerId: provider.id,
          learnerId: await currentLearnerId(),
          authenticated: !!account,
          request: context.request,
          clearFree: provider.id === "gemini" && !credential?.apiKey,
        }, () => provider.generate(input, credential));
      } catch (error) {
        if (!(error instanceof ClearError) || error.status >= 500 || error.code === "model_unavailable" || error.code === "provider_key_invalid") {
          reportServerError(error, { operation: "provider", providerId: provider.id });
        }
        throw error;
      }
    },
  };
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
