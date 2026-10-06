import { afterEach, describe, expect, it, vi } from "vitest";

import { ClearError } from "@/src/lib/api/errors";
import { redactSecrets } from "@/src/lib/ai/redact";
import { getProvider, resolveGenerationProvider } from "@/src/lib/ai/router";
import { MUTEX_FIXTURE } from "@/src/lib/explanation/fixtures/mutex";
import { continueExplanation } from "@/src/lib/explanation/follow-up";
import { FOLLOW_UP_SYSTEM_PROMPT } from "@/src/lib/prompts/follow-up.v1";

vi.mock("server-only", () => ({}));

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("CLEAR Free when a Gemini model is busy", () => {
  const input = { model: "gemini-3.6-flash", messages: [{ role: "user" as const, content: "Synthetic question" }] };
  const answer = () => Response.json({ candidates: [{ content: { parts: [{ text: '{"essence":"ok"}' }] } }] });
  const busy = () => Response.json({ error: { message: "overloaded" } }, { status: 503 });
  const modelOf = (call: unknown[]) => String(call[0]).match(/models\/([^:]+):/)?.[1];

  it("asks the other CLEAR Free model and reports which one answered", async () => {
    vi.stubEnv("GEMINI_API_KEY", "SYNTHETIC_KEY");
    const http = vi.fn<typeof fetch>().mockResolvedValueOnce(busy()).mockResolvedValueOnce(answer());
    vi.stubGlobal("fetch", http);
    const result = await resolveGenerationProvider().generate(input);
    expect(http.mock.calls.map(modelOf)).toEqual(["gemini-3.6-flash", "gemini-3.5-flash-lite"]);
    expect(result.model).toBe("gemini-3.5-flash-lite");
  });

  it("stops with the busy message once every CLEAR Free model is busy", async () => {
    vi.stubEnv("GEMINI_API_KEY", "SYNTHETIC_KEY");
    const http = vi.fn<typeof fetch>().mockImplementation(async () => busy());
    vi.stubGlobal("fetch", http);
    await expect(resolveGenerationProvider().generate(input)).rejects.toMatchObject({ status: 503, retryable: true });
    expect(http).toHaveBeenCalledTimes(2);
  });

  it("does not switch model for other failures or for a learner's own key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "SYNTHETIC_KEY");
    const http = vi.fn<typeof fetch>().mockImplementation(async () => new Response("no", { status: 404 }));
    vi.stubGlobal("fetch", http);
    await expect(resolveGenerationProvider().generate(input)).rejects.toMatchObject({ code: "model_unavailable" });
    expect(http).toHaveBeenCalledTimes(1);
    http.mockImplementation(async () => busy());
    await expect(getProvider("gemini").generate(input, { apiKey: "OWN_SYNTHETIC_KEY" })).rejects.toMatchObject({ status: 503 });
    expect(http).toHaveBeenCalledTimes(2);
  });
});

describe("providers", () => {
  it("returns the mock provider and hides secrets in errors", () => {
    expect(getProvider("mock").id).toBe("mock");
    expect(redactSecrets("failed with sk-abcdefghijklmnopqrstuvwxyz")).toContain("[redacted]");
    expect(() => getProvider("missing")).toThrow(ClearError);
  });

  it("keeps the canonical lesson during a local mock follow-up", async () => {
    vi.stubEnv("CLEAR_PROVIDER", "mock");
    const original = structuredClone(MUTEX_FIXTURE);
    const result = await continueExplanation({
      document: original,
      message: "What happens when two threads want the mutex?",
      activeView: "voice",
    });

    expect(result.providerId).toBe("mock");
    expect(result.model).toBe("clear-mock");
    expect(result.document.id).toBe(original.id);
    expect(result.document.topic).toBe(original.topic);
    expect(result.document.normalizedQuestion).toBe(original.normalizedQuestion);
    expect(result.document.concepts).toEqual(original.concepts);
    expect(result.document.process).toEqual(original.process);
    expect(result.document.mentalModel).toEqual(original.mentalModel);
    expect(result.document.examples).toEqual(original.examples);
    expect(result.document.audience).toEqual(original.audience);
    expect(result.document.metadata.provider).toBe("mock");
    expect(result.reply).toContain("Local mock");
    expect(result.reply).toContain("No model reviewed or answered");
    expect(MUTEX_FIXTURE).toEqual(original);
  });

  it("rejects a local mock follow-up that has no readable current lesson", async () => {
    await expect(getProvider("mock").generate({
      model: "clear-mock",
      system: FOLLOW_UP_SYSTEM_PROMPT,
      messages: [{ role: "user", content: "Current explanation JSON:\ninvalid\n\nLearner follow-up:\nHelp" }],
    })).rejects.toThrow("The local mock could not read the current lesson.");
  });
});
