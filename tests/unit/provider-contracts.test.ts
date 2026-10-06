import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geminiProvider } from "@/src/lib/ai/providers/gemini";
import { openaiProvider, compatibleProvider, xaiProvider } from "@/src/lib/ai/providers/openai";
import { anthropicProvider } from "@/src/lib/ai/providers/anthropic";
import { ClearError } from "@/src/lib/api/errors";
import type { UnifiedGenerationRequest } from "@/src/lib/ai/types";
import { providerResponseByteLimit, readProviderResponse } from "@/src/lib/ai/providers/response-body";
import { assertSafeProviderUrl } from "@/src/lib/security/ssrf";

const dns = vi.hoisted(() => ({ lookup: vi.fn<(hostname: string, options: { all: boolean; verbatim: boolean }) => Promise<{ address: string; family: number }[]>>(async () => [{ address: "1.1.1.1", family: 4 }]) }));
vi.mock("node:dns/promises", () => dns);
const custom = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/src/lib/ai/providers/custom-http", () => ({ customProviderRequest: custom.request }));
const http = vi.fn<typeof fetch>();
const KEY = "SYNTHETIC_PRIVATE_PROVIDER_KEY_71";
const PRIVATE = "PRIVATE_UPSTREAM_PROMPT_UPLOAD_EMAIL_29";
const image = { mimeType: "image/png", dataBase64: "U1lOVEhFVElDX0lNQUdF" };
const request: UnifiedGenerationRequest = {
  model: "selected-model", system: "AUTHORITATIVE_SYSTEM_RULES", temperature: 0.2, maxOutputTokens: 600,
  messages: [{ role: "user", content: "Earlier question" }, { role: "assistant", content: "Earlier answer" }, { role: "system", content: "DISCARDED_MESSAGE_SYSTEM" }, { role: "user", content: "Latest question" }],
  attachments: [image],
};
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("fetch", http); dns.lookup.mockResolvedValue([{ address: "1.1.1.1", family: 4 }]);
  // Adapter contracts exercise serialization here; the actual native connector,
  // connection-time DNS pinning and cancellation have separate offline tests.
  custom.request.mockImplementation(async (endpoint: URL, input: { apiKey: string; body: string; signal: AbortSignal }) => {
    await assertSafeProviderUrl(endpoint.toString(), { allowLocal: process.env.NODE_ENV !== "production", lookup: async (hostname) => (await dns.lookup(hostname, { all: true, verbatim: true })).map((item) => item.address) });
    return http(endpoint, { method: "POST", headers: { authorization: `Bearer ${input.apiKey}` }, body: input.body, signal: input.signal, redirect: "manual" });
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

function openAiReply(extra: Record<string, unknown> = {}) {
  return Response.json({ choices: [{ message: { content: '{"essence":"Canonical answer"}' }, finish_reason: "stop" }], usage: { prompt_tokens: 17, completion_tokens: 23 }, ...extra });
}
function sentBody(call = 0): Record<string, unknown> { return JSON.parse(http.mock.calls[call][1]!.body as string) as Record<string, unknown>; }
async function rejected(promise: Promise<unknown>): Promise<ClearError> {
  const error = await promise.then(() => undefined, (failure: unknown) => failure);
  expect(error).toBeInstanceOf(ClearError);
  return error as ClearError;
}
function cancelableResponse(chunks: Uint8Array[], headers: Record<string, string> = {}, status = 200) {
  const cancel = vi.fn();
  let index = 0;
  const body = new ReadableStream<Uint8Array>({ pull(controller) { if (index < chunks.length) controller.enqueue(chunks[index++]); else controller.close(); }, cancel });
  return { response: new Response(body, { headers, status }), cancel };
}

describe("provider transport contracts", () => {
  it("serializes Gemini system/history and only attaches image/PDF data to the latest turn", async () => {
    http.mockResolvedValueOnce(Response.json({ candidates: [{ content: { parts: [{ thought: true, text: "PRIVATE_THOUGHT_61" }, { text: '{"essence":' }, { text: '"Canonical answer"}' }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 19 } }));
    const result = await geminiProvider.generate({ ...request, model: "gemini-3.6-flash", attachments: [image, { mimeType: "application/pdf", dataBase64: "U1lOVEhFVElDX1BERg==" }] }, { apiKey: KEY });
    expect(String(http.mock.calls[0][0])).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent");
    expect(new Headers(http.mock.calls[0][1]!.headers).get("x-goog-api-key")).toBe(KEY);
    expect(http.mock.calls[0][1]!.redirect).toBe("manual");
    const body = sentBody();
    expect(body.systemInstruction).toEqual({ parts: [{ text: request.system }] });
    expect(body.contents).toEqual([
      { role: "user", parts: [{ text: "Earlier question" }] },
      { role: "model", parts: [{ text: "Earlier answer" }] },
      { role: "user", parts: [{ text: "Latest question" }, { inlineData: { mimeType: image.mimeType, data: image.dataBase64 } }, { inlineData: { mimeType: "application/pdf", data: "U1lOVEhFVElDX1BERg==" } }] },
    ]);
    expect(body.generationConfig).toEqual({ temperature: 0.2, maxOutputTokens: 600, responseMimeType: "application/json" });
    expect(JSON.stringify(body)).not.toContain(KEY);
    expect(JSON.stringify(body)).not.toContain("DISCARDED_MESSAGE_SYSTEM");
    expect(result).toEqual({ text: '{"essence":"Canonical answer"}', structured: { essence: "Canonical answer" }, usage: { inputTokens: 11, outputTokens: 19 }, finishReason: "STOP" });
  });

  it.each([
    { provider: openaiProvider, baseUrl: undefined, endpoint: "https://api.openai.com/v1/chat/completions" },
    { provider: xaiProvider, baseUrl: undefined, endpoint: "https://api.x.ai/v1/chat/completions" },
    { provider: compatibleProvider, baseUrl: "https://custom.example/v1", endpoint: "https://custom.example/v1/chat/completions" },
  ])("keeps model, auth, history and structured output on the selected $provider.id endpoint", async ({ provider, baseUrl, endpoint }) => {
    http.mockResolvedValueOnce(openAiReply());
    const result = await provider.generate({ ...request, attachments: provider.id === "xai" ? [] : request.attachments }, { apiKey: KEY, baseUrl });
    expect(String(http.mock.calls[0][0])).toBe(endpoint);
    expect(new Headers(http.mock.calls[0][1]!.headers).get("authorization")).toBe(`Bearer ${KEY}`);
    expect(http.mock.calls[0][1]!.redirect).toBe("manual");
    const body = sentBody();
    expect(body.model).toBe("selected-model");
    expect(body.max_tokens).toBe(600);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages).toEqual([
      { role: "system", content: "AUTHORITATIVE_SYSTEM_RULES" }, { role: "user", content: "Earlier question" }, { role: "assistant", content: "Earlier answer" },
      { role: "user", content: provider.id === "xai" ? "Latest question" : [{ type: "text", text: "Latest question" }, { type: "image_url", image_url: { url: `data:image/png;base64,${image.dataBase64}` } }] },
    ]);
    expect(JSON.stringify(body)).not.toContain(KEY);
    expect(JSON.stringify(body)).not.toContain("DISCARDED_MESSAGE_SYSTEM");
    expect(result).toEqual({ text: '{"essence":"Canonical answer"}', structured: { essence: "Canonical answer" }, usage: { inputTokens: 17, outputTokens: 23 }, finishReason: "stop" });
    expect(http).toHaveBeenCalledTimes(1);
    if (baseUrl) expect(dns.lookup).toHaveBeenCalledWith("custom.example", { all: true, verbatim: true });
  });

  it("normalizes Anthropic text/usage/stop reason with separate system and typed image content", async () => {
    http.mockResolvedValueOnce(Response.json({ content: [{ type: "thinking", thinking: "PRIVATE_THOUGHT_61" }, { type: "text", text: '{"essence":' }, { type: "text", text: '"Canonical answer"}' }], usage: { input_tokens: 29, output_tokens: 31 }, stop_reason: "end_turn" }));
    const result = await anthropicProvider.generate(request, { apiKey: KEY });
    expect(String(http.mock.calls[0][0])).toBe("https://api.anthropic.com/v1/messages");
    expect(new Headers(http.mock.calls[0][1]!.headers).get("x-api-key")).toBe(KEY);
    expect(new Headers(http.mock.calls[0][1]!.headers).get("anthropic-version")).toBe("2023-06-01");
    const body = sentBody();
    expect(body.system).toBe(request.system);
    expect(body.model).toBe("selected-model");
    expect(body.messages).toEqual([{ role: "user", content: "Earlier question" }, { role: "assistant", content: "Earlier answer" }, { role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/png", data: image.dataBase64 } }, { type: "text", text: "Latest question" }] }]);
    expect(JSON.stringify(body)).not.toContain(KEY);
    expect(result).toEqual({ text: '{"essence":"Canonical answer"}', structured: { essence: "Canonical answer" }, usage: { inputTokens: 29, outputTokens: 31 }, finishReason: "end_turn" });
  });

  it("allows one JSON-format compatibility retry on the same endpoint/key/model without silently choosing another provider", async () => {
    http.mockResolvedValueOnce(Response.json({ error: { message: `${PRIVATE} response_format unsupported` } }, { status: 400 })).mockResolvedValueOnce(openAiReply());
    await openaiProvider.generate(request, { apiKey: KEY });
    expect(http).toHaveBeenCalledTimes(2);
    expect(String(http.mock.calls[0][0])).toBe(String(http.mock.calls[1][0]));
    const initial = sentBody(); const retry = sentBody(1);
    delete initial.response_format;
    expect(retry).toEqual(initial);
    expect(new Headers(http.mock.calls[1][1]!.headers).get("authorization")).toBe(`Bearer ${KEY}`);
    expect(http.mock.calls[0][1]!.signal).toBe(http.mock.calls[1][1]!.signal);
  });

  it("does not renew the overall deadline for a JSON-format retry", async () => {
    const controller = new AbortController();
    const deadline = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    http.mockImplementationOnce(async () => {
      controller.abort(new DOMException("synthetic timeout", "TimeoutError"));
      return Response.json({ error: { message: "response_format unsupported" } }, { status: 400 });
    });
    const error = await rejected(openaiProvider.generate(request, { apiKey: KEY }));
    expect(error.code).toBe("provider_timeout");
    expect(deadline).toHaveBeenCalledExactlyOnceWith(60_000);
    expect(http).toHaveBeenCalledTimes(1);
  });

  it.each([geminiProvider, openaiProvider, anthropicProvider])("stops $id redirects and cancels the response without forwarding a key", async (provider) => {
    const { response, cancel } = cancelableResponse([new TextEncoder().encode(PRIVATE)], { location: "https://attacker.invalid" }, 302);
    http.mockResolvedValueOnce(response);
    const error = await rejected(provider.generate(request, { apiKey: KEY }));
    expect(error.code).toBe("provider_error");
    expect(error.message).toContain("redirect");
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(http).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(error)).not.toContain(PRIVATE);
  });

  it.each([geminiProvider, openaiProvider, anthropicProvider, xaiProvider])("never exposes raw $id upstream error content or silently falls back", async (provider) => {
    http.mockResolvedValueOnce(Response.json({ error: { message: `${KEY} ${PRIVATE} private@example.invalid`, prompt: PRIVATE } }, { status: 503 }));
    const error = await rejected(provider.generate(request, { apiKey: KEY }));
    expect(error.code).toBe("provider_error");
    expect(error.retryable).toBe(true);
    expect(error.details).toBeUndefined();
    expect(`${error.message}${JSON.stringify(error)}`).not.toContain(KEY);
    expect(`${error.message}${JSON.stringify(error)}`).not.toContain(PRIVATE);
    expect(http).toHaveBeenCalledTimes(1);
  });

  it("tells the learner when Gemini is busy or a model is retired, without retrying by itself", async () => {
    http.mockResolvedValueOnce(Response.json({ error: { message: PRIVATE } }, { status: 503 }));
    const busy = await rejected(geminiProvider.generate(request, { apiKey: KEY }));
    expect(busy.status).toBe(503);
    expect(busy.message).toContain("busy");
    http.mockResolvedValueOnce(Response.json({ error: { message: PRIVATE } }, { status: 404 }));
    const retired = await rejected(geminiProvider.generate(request, { apiKey: KEY }));
    expect(retired.code).toBe("model_unavailable");
    expect(retired.message).toContain("Choose another model");
    expect(http).toHaveBeenCalledTimes(2);
  });

  it("uses finite generic errors for malformed JSON, aborted reads, authentication failures and rate limits", async () => {
    http.mockResolvedValueOnce(new Response(`invalid ${PRIVATE}`));
    expect((await rejected(openaiProvider.generate(request, { apiKey: KEY }))).message).not.toContain(PRIVATE);
    http.mockResolvedValueOnce(new Response("rejected", { status: 401 }));
    expect((await rejected(openaiProvider.generate(request, { apiKey: KEY }))).code).toBe("provider_key_invalid");
    http.mockResolvedValueOnce(new Response(PRIVATE, { status: 429 }));
    expect((await rejected(anthropicProvider.generate(request, { apiKey: KEY }))).code).toBe("provider_quota");
    http.mockRejectedValueOnce(new DOMException(PRIVATE, "TimeoutError"));
    const timeout = await rejected(geminiProvider.generate(request, { apiKey: KEY }));
    expect(timeout.code).toBe("provider_timeout");
    expect(timeout.message).not.toContain(PRIVATE);
  });

  it("rejects an unsafe custom endpoint before any request and ignores invalid token counts", async () => {
    vi.stubEnv("NODE_ENV", "production");
    dns.lookup.mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
    expect((await rejected(compatibleProvider.generate(request, { apiKey: KEY, baseUrl: "https://custom.example/v1" }))).code).toBe("unsafe_provider_url");
    expect(http).not.toHaveBeenCalled();
    http.mockResolvedValueOnce(openAiReply({ usage: { prompt_tokens: -1, completion_tokens: 2.5 } }));
    expect((await openaiProvider.generate(request, { apiKey: KEY })).usage).toEqual({ inputTokens: undefined, outputTokens: undefined });
  });
});

describe("bounded upstream response reader", () => {
  it("defaults to 1 MiB and validates the environment cap without silently accepting unsafe limits", () => {
    expect(providerResponseByteLimit()).toBe(1024 * 1024);
    vi.stubEnv("CLEAR_PROVIDER_RESPONSE_MAX_BYTES", String(4 * 1024 * 1024));
    expect(providerResponseByteLimit()).toBe(4 * 1024 * 1024);
    for (const value of ["0", "-1", "1.5", "4194305", "not-a-limit"]) {
      vi.stubEnv("CLEAR_PROVIDER_RESPONSE_MAX_BYTES", value);
      expect(() => providerResponseByteLimit()).toThrow(ClearError);
    }
  });

  it("decodes multibyte UTF-8 split between chunks at the exact byte limit", async () => {
    const data = new TextEncoder().encode("π and α");
    vi.stubEnv("CLEAR_PROVIDER_RESPONSE_MAX_BYTES", String(data.byteLength));
    const { response, cancel } = cancelableResponse([data.subarray(0, 1), data.subarray(1, 4), data.subarray(4)]);
    expect(await readProviderResponse(response)).toBe("π and α");
    expect(cancel).not.toHaveBeenCalled();
  });

  it.each(["absent", "dishonest"])("enforces streamed byte counts with %s Content-Length", async (kind) => {
    vi.stubEnv("CLEAR_PROVIDER_RESPONSE_MAX_BYTES", "4");
    const headers: Record<string, string> = kind === "dishonest" ? { "content-length": "2" } : {};
    const { response, cancel } = cancelableResponse([new Uint8Array(3), new Uint8Array(3)], headers);
    const error = await rejected(readProviderResponse(response));
    expect(error.message).toContain("safe size limit");
    expect(error.retryable).toBe(false);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("cancels an oversized declared response without reading it", async () => {
    vi.stubEnv("CLEAR_PROVIDER_RESPONSE_MAX_BYTES", "4");
    const { response, cancel } = cancelableResponse([new Uint8Array(2)], { "content-length": "999999999999999999" });
    expect((await rejected(readProviderResponse(response))).message).toContain("safe size limit");
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(response.bodyUsed).toBe(true);
  });

  it.each([geminiProvider, openaiProvider, anthropicProvider])("applies size bounds before $id response parsing or format retries", async (provider) => {
    vi.stubEnv("CLEAR_PROVIDER_RESPONSE_MAX_BYTES", "16");
    // Leave an unread tail so cancellation exercises an open upstream stream.
    const { response, cancel } = cancelableResponse([new TextEncoder().encode(`${PRIVATE} response_format`), new Uint8Array(1)], {}, 400);
    http.mockResolvedValueOnce(response);
    const error = await rejected(provider.generate(request, { apiKey: KEY }));
    expect(error.message).toContain("safe size limit");
    expect(error.message).not.toContain(PRIVATE);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(http).toHaveBeenCalledTimes(1);
  });

  it("does not expose upstream stream failures or malformed UTF-8", async () => {
    const failed = new Response(new ReadableStream<Uint8Array>({ pull(controller) { controller.error(new Error(PRIVATE)); } }));
    const streamError = await rejected(readProviderResponse(failed));
    expect(streamError.message).not.toContain(PRIVATE);
    const malformed = new Response(Uint8Array.from([0xff, 0xfe]));
    expect((await rejected(readProviderResponse(malformed))).code).toBe("provider_error");
  });
});
