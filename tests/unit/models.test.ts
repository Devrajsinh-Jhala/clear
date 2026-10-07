import { afterEach, describe, expect, it } from "vitest";

import { CLEAR_FREE_MODELS, clearFreeModelLabel, defaultClearFreeModel, resolveClearFreeModel } from "@/src/lib/ai/models";

describe("CLEAR Free models", () => {
  const previous = process.env.GEMINI_MODEL;

  afterEach(() => {
    if (previous === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = previous;
  });

  it("uses Gemini 3.5 Flash-Lite when the env model is unknown", () => {
    process.env.GEMINI_MODEL = "gemini-unknown";
    expect(defaultClearFreeModel()).toBe("gemini-3.5-flash-lite");
    expect(resolveClearFreeModel("not-a-model")).toBe("gemini-3.5-flash-lite");
  });

  it("keeps a known lesson model", () => {
    process.env.GEMINI_MODEL = "gemini-3.5-flash-lite";
    expect(resolveClearFreeModel("gemini-3.6-flash")).toBe("gemini-3.6-flash");
  });

  it("offers five models, Flash-Lite first, and keeps each one when asked for it", () => {
    expect(CLEAR_FREE_MODELS.map((item) => item.id)).toEqual(["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"]);
    for (const item of CLEAR_FREE_MODELS) expect(resolveClearFreeModel(item.id)).toBe(item.id);
    expect(clearFreeModelLabel("gemini-3.8-flash")).toBe("Gemini 3.8 Flash");
  });

  it("defaults to the configured known model", () => {
    process.env.GEMINI_MODEL = "gemini-3.6-flash";
    expect(defaultClearFreeModel()).toBe("gemini-3.6-flash");
  });

  it("moves lessons saved on a retired model to the current default", () => {
    delete process.env.GEMINI_MODEL;
    expect(resolveClearFreeModel("gemini-2.5-flash")).toBe("gemini-3.5-flash-lite");
    expect(resolveClearFreeModel("gemini-3.5-flash")).toBe("gemini-3.5-flash-lite");
  });
});
