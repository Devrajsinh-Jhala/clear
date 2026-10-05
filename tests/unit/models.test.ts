import { afterEach, describe, expect, it } from "vitest";

import { defaultClearFreeModel, resolveClearFreeModel } from "@/src/lib/ai/models";

describe("CLEAR Free models", () => {
  const previous = process.env.GEMINI_MODEL;

  afterEach(() => {
    if (previous === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = previous;
  });

  it("uses Gemini 3.5 Flash when the env model is unknown", () => {
    process.env.GEMINI_MODEL = "gemini-unknown";
    expect(defaultClearFreeModel()).toBe("gemini-3.5-flash");
    expect(resolveClearFreeModel("not-a-model")).toBe("gemini-3.5-flash");
  });

  it("keeps a known lesson model", () => {
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
    expect(resolveClearFreeModel("gemini-3.5-flash")).toBe("gemini-3.5-flash");
  });

  it("defaults to the configured known model", () => {
    process.env.GEMINI_MODEL = "gemini-3.5-flash";
    expect(defaultClearFreeModel()).toBe("gemini-3.5-flash");
  });
});
