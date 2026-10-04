import { lookup } from "node:dns/promises";

import { ClearError } from "@/src/lib/api/errors";
import { redactSecrets } from "@/src/lib/ai/redact";
import type { InlineAttachment, UnifiedGenerationRequest, UnifiedGenerationResponse } from "@/src/lib/ai/types";
import { isRecord, parseJsonText } from "@/src/lib/explanation/normalize";
import { assertSafeProviderUrl } from "@/src/lib/security/ssrf";

export async function openaiCompatibleGenerate(input: {
  baseUrl: string;
  apiKey: string;
  request: UnifiedGenerationRequest;
  checkSsrf?: boolean;
}): Promise<UnifiedGenerationResponse> {
  const endpoint = await chatEndpoint(input.baseUrl, input.checkSsrf === true);
  const body = {
    model: input.request.model,
    temperature: input.request.temperature ?? 0.4,
    max_tokens: input.request.maxOutputTokens ?? 8000,
    response_format: { type: "json_object" },
    messages: openAiMessages(input.request),
  };
  return postChat(endpoint, input.apiKey, body, true);
}

async function postChat(
  endpoint: URL,
  apiKey: string,
  body: Record<string, unknown>,
  allowFormatRetry: boolean,
): Promise<UnifiedGenerationResponse> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      redirect: "manual",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new ClearError(timedOut ? "provider_timeout" : "provider_unreachable", timedOut ? "The provider took too long." : "CLEAR could not reach that provider.", {
      retryable: true,
      status: 504,
    });
  }
  if (response.status >= 300 && response.status < 400) {
    throw new ClearError("provider_error", "The provider tried to redirect the request. CLEAR stopped.", { status: 502 });
  }
  const bodyText = await response.text();
  if (!response.ok && allowFormatRetry && response.status === 400 && /response_format/i.test(bodyText)) {
    const next = { ...body };
    delete next.response_format;
    return postChat(endpoint, apiKey, next, false);
  }
  if (!response.ok) throw httpError(response.status, bodyText);
  return parseOpenAi(bodyText);
}

export async function anthropicGenerate(input: {
  apiKey: string;
  request: UnifiedGenerationRequest;
}): Promise<UnifiedGenerationResponse> {
  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      redirect: "manual",
      headers: {
        "x-api-key": input.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: input.request.model,
        max_tokens: input.request.maxOutputTokens ?? 8000,
        temperature: input.request.temperature ?? 0.4,
        system: input.request.system,
        messages: anthropicMessages(input.request),
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new ClearError(timedOut ? "provider_timeout" : "provider_unreachable", timedOut ? "Anthropic took too long." : "CLEAR could not reach Anthropic.", {
      retryable: true,
      status: 504,
    });
  }
  const bodyText = await response.text();
  if (!response.ok) throw httpError(response.status, bodyText);
  let payload: unknown;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    throw new ClearError("provider_error", "Anthropic returned an unreadable response.", { retryable: true, status: 502 });
  }
  if (!isRecord(payload) || !Array.isArray(payload.content)) {
    throw new ClearError("provider_error", "Anthropic returned an empty explanation.", { retryable: true, status: 502 });
  }
  const text = payload.content
    .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
    .join("");
  return finishText(text);
}

async function chatEndpoint(baseUrl: string, checkSsrf: boolean): Promise<URL> {
  const root = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const endpoint = new URL("chat/completions", root);
  if (!checkSsrf) return endpoint;
  try {
    await assertSafeProviderUrl(endpoint.toString(), {
      allowLocal: process.env.NODE_ENV !== "production",
      lookup: async (hostname) => {
        const records = await lookup(hostname, { all: true, verbatim: true });
        return records.map((record) => record.address);
      },
    });
  } catch (error) {
    throw new ClearError("unsafe_provider_url", error instanceof Error ? error.message : "That provider URL is not allowed.", {
      status: 400,
    });
  }
  return endpoint;
}

function openAiMessages(request: UnifiedGenerationRequest) {
  const messages = [];
  if (request.system) messages.push({ role: "system", content: request.system });
  request.messages
    .filter((message) => message.role !== "system")
    .forEach((message, index, list) => {
      const attachments = index === list.length - 1 ? request.attachments : undefined;
      messages.push({
        role: message.role,
        content: attachments?.length ? openAiContent(message.content, attachments) : message.content,
      });
    });
  return messages;
}

function openAiContent(text: string, attachments: InlineAttachment[]) {
  return [
    { type: "text", text },
    ...attachments
      .filter((item) => item.dataBase64 && item.mimeType.startsWith("image/"))
      .map((item) => ({
        type: "image_url",
        image_url: { url: `data:${item.mimeType};base64,${item.dataBase64}` },
      })),
  ];
}

function anthropicMessages(request: UnifiedGenerationRequest) {
  return request.messages
    .filter((message) => message.role !== "system")
    .map((message, index, list) => {
      const attachments = index === list.length - 1 ? request.attachments : undefined;
      if (!attachments?.length) return { role: message.role, content: message.content };
      return {
        role: message.role,
        content: [
          ...attachments
            .filter((item) => item.dataBase64 && item.mimeType.startsWith("image/"))
            .map((item) => ({
              type: "image",
              source: { type: "base64", media_type: item.mimeType, data: item.dataBase64 },
            })),
          { type: "text", text: message.content },
        ],
      };
    });
}

function parseOpenAi(bodyText: string): UnifiedGenerationResponse {
  let payload: unknown;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    throw new ClearError("provider_error", "The provider returned an unreadable response.", { retryable: true, status: 502 });
  }
  if (!isRecord(payload) || !Array.isArray(payload.choices) || !isRecord(payload.choices[0])) {
    throw new ClearError("provider_error", "The provider returned an empty explanation.", { retryable: true, status: 502 });
  }
  const message = payload.choices[0].message;
  const text = isRecord(message) && typeof message.content === "string" ? message.content : "";
  const usage = isRecord(payload.usage)
    ? {
        inputTokens: typeof payload.usage.prompt_tokens === "number" ? payload.usage.prompt_tokens : undefined,
        outputTokens: typeof payload.usage.completion_tokens === "number" ? payload.usage.completion_tokens : undefined,
      }
    : undefined;
  const parsed = finishText(text);
  return { ...parsed, usage };
}

function finishText(text: string): UnifiedGenerationResponse {
  if (!text.trim()) {
    throw new ClearError("provider_error", "The provider returned an empty explanation.", { retryable: true, status: 502 });
  }
  let structured: unknown;
  try {
    structured = parseJsonText(text);
  } catch {
    structured = undefined;
  }
  return { text, structured };
}

function httpError(status: number, bodyText: string): ClearError {
  const safe = redactSecrets(bodyText).slice(0, 300);
  if (status === 401 || status === 403) {
    return new ClearError("provider_key_invalid", "That API key was rejected.", { status: 401 });
  }
  if (status === 429) {
    return new ClearError("provider_quota", "That provider is rate limiting the key.", { retryable: true, status: 429 });
  }
  return new ClearError("provider_error", "The provider could not generate this explanation.", {
    retryable: status >= 500,
    status: 502,
    details: safe || undefined,
  });
}
