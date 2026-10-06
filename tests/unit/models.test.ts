import { afterEach, describe, expect, it } from "vitest";

import { defaultClearFreeModel, resolveClearFreeModel } from "@/src/lib/ai/models";

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
