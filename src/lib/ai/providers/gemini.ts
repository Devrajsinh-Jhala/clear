import { ClearError } from "@/src/lib/api/errors";
import { redactSecrets } from "@/src/lib/ai/redact";
import type { AIProvider, UnifiedGenerationRequest, UnifiedGenerationResponse } from "@/src/lib/ai/types";
import { isRecord, parseJsonText } from "@/src/lib/explanation/normalize";

import { defaultClearFreeModel, resolveClearFreeModel } from "@/src/lib/ai/models";
import { discardProviderResponse, readProviderResponse, tokenCount } from "@/src/lib/ai/providers/response-body";

export const geminiProvider: AIProvider = {
  id: "gemini",
  displayName: "Google Gemini",
  capabilities: {
    text: true,
    vision: true,
    pdf: true,
    audioInput: true,
    audioOutput: true,
    structuredOutput: true,
    toolCalling: true,
    streaming: true,
    realtime: false,
    modelDiscovery: true,
  },
  async generate(request, credential) {
    const apiKey = credential?.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ClearError(
        "provider_not_configured",
        "CLEAR Free needs a Gemini API key on the server.",
        { status: 503 },
      );
    }
    return requestGemini(request, apiKey);
  },
};

export function defaultGeminiModel(): string {
  return defaultClearFreeModel();
}

export function resolveLessonModel(providerId: string, requested?: string): string {
  if (providerId === "mock") return "clear-mock";
  return resolveClearFreeModel(requested);
}

async function requestGemini(
  request: UnifiedGenerationRequest,
  apiKey: string,
): Promise<UnifiedGenerationResponse> {
  const model = request.model || defaultGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const contents = request.messages
    .filter((message) => message.role !== "system")
    .map((message, index, messages) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: partsFor(message.content, index === messages.length - 1 ? request.attachments : undefined),
    }));

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: request.system ? { parts: [{ text: request.system }] } : undefined,
        contents,
        generationConfig: {
          temperature: request.temperature ?? 0.4,
          maxOutputTokens: request.maxOutputTokens ?? 8000,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new ClearError(
      timedOut ? "provider_timeout" : "provider_unreachable",
      timedOut ? "Gemini took too long to respond." : "CLEAR could not reach Gemini.",
      { retryable: true, status: 504 },
    );
  }

  if (response.status >= 300 && response.status < 400) {
    discardProviderResponse(response);
    throw new ClearError("provider_error", "Gemini tried to redirect the request. CLEAR stopped.", { status: 502 });
  }
  const bodyText = await readProviderResponse(response);
  if (!response.ok) {
    throw geminiHttpError(response.status, bodyText);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    throw new ClearError("provider_error", "Gemini returned an unreadable response.", {
      retryable: true,
      status: 502,
    });
  }

  const text = readGeminiText(payload);
  if (!text) {
    throw new ClearError("provider_error", "Gemini returned an empty explanation.", {
      retryable: true,
      status: 502,
    });
  }

  let structured: unknown;
  try {
    structured = parseJsonText(text);
  } catch {
    structured = undefined;
  }

  return {
    text,
    structured,
    usage: readUsage(payload),
    finishReason: readFinishReason(payload),
  };
}

function partsFor(text: string, attachments: UnifiedGenerationRequest["attachments"]) {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text }];
  for (const attachment of attachments ?? []) {
    if (!attachment.dataBase64) continue;
    parts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.dataBase64 } });
  }
  return parts;
}

function readGeminiText(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.candidates)) return "";
  const candidate = payload.candidates[0];
  if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) {
    return "";
  }
  return candidate.content.parts
    .map((part) => (isRecord(part) && part.thought !== true && typeof part.text === "string" ? part.text : ""))
    .join("");
}

function readUsage(payload: unknown): UnifiedGenerationResponse["usage"] {
  if (!isRecord(payload) || !isRecord(payload.usageMetadata)) return undefined;
  const usage = payload.usageMetadata;
  return {
    inputTokens: tokenCount(usage.promptTokenCount),
    outputTokens: tokenCount(usage.candidatesTokenCount),
  };
}

function readFinishReason(payload: unknown): string | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.candidates)) return undefined;
  const candidate = payload.candidates[0];
  return isRecord(candidate) && typeof candidate.finishReason === "string"
    ? candidate.finishReason
    : undefined;
}

/** Gemini refused the call because the model is overloaded, not because of the request. */
export function isGeminiBusy(error: unknown): boolean {
  return error instanceof ClearError && error.code === "provider_error" && error.status === 503;
}

function geminiHttpError(status: number, bodyText: string): ClearError {
  const safeBody = redactSecrets(bodyText).slice(0, 500);
  if (status === 400 && safeBody.includes("API_KEY_INVALID")) {
    return new ClearError("provider_key_invalid", "The Gemini API key was rejected.", { status: 401 });
  }
  if (status === 401 || status === 403) {
    return new ClearError("provider_key_invalid", "The Gemini API key was rejected.", { status: 401 });
  }
  if (status === 429) {
    return new ClearError("provider_quota", "Gemini is rate limiting CLEAR Free right now.", {
      retryable: true,
      status: 429,
    });
  }
  if (status === 404) {
    return new ClearError("model_unavailable", "That Gemini model is not available. Choose another model in Explanation preferences.", { status: 400 });
  }
  if (status === 503) {
    return new ClearError("provider_error", "Gemini is busy right now. Try again in a moment.", {
      retryable: true,
      status: 503,
    });
  }
  return new ClearError("provider_error", "Gemini could not generate this explanation.", {
    retryable: status >= 500,
    status: 502,
  });
}
