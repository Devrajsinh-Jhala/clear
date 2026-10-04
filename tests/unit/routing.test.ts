import { describe, expect, it } from "vitest";

import { ClearError } from "@/src/lib/api/errors";
import {
  chooseRoute,
  classifyTask,
  defaultRoutingPreferences,
  shouldUseClearFreeFallback,
  type ApprovedTarget,
} from "@/src/lib/routing/choose";

const clearFree: ApprovedTarget = {
  provider: "clear-free",
  model: "gemini-2.5-flash",
  label: "CLEAR Free",
  pdf: true,
  vision: true,
};
const openai: ApprovedTarget = {
  provider: "openai",
  model: "gpt-4.1-mini",
  label: "OpenAI",
  pdf: false,
  vision: true,
};
const anthropic: ApprovedTarget = {
  provider: "anthropic",
  model: "claude-sonnet-4-5",
  label: "Anthropic",
  pdf: false,
  vision: true,
};

describe("model routing", () => {
  it("classifies a question before choosing a provider", () => {
    expect(classifyTask({ question: "Why does this function leak a mutex?", hasPdf: false, sourceLength: 0 })).toBe("coding");
    expect(classifyTask({ question: "Explain a proof of the derivative rule", hasPdf: false, sourceLength: 0 })).toBe("math");
    expect(classifyTask({ question: "What is a lock?", hasPdf: true, sourceLength: 20 })).toBe("research");
  });

  it("uses a saved task rule and does not invent an unapproved provider", () => {
    const preferences = defaultRoutingPreferences();
    preferences.tasks.coding = { provider: "openai", model: "gpt-4.1" };
    const chosen = chooseRoute({
      question: "How does this algorithm work?",
      sourceLength: 0,
      hasPdf: false,
      hasImage: false,
      preferences,
      available: [clearFree, openai],
      forceAuto: true,
    });
    expect(chosen).toMatchObject({ provider: "openai", model: "gpt-4.1", reason: "task:coding", fallback: false });

    const onlyFree = chooseRoute({
      question: "How does this algorithm work?",
      sourceLength: 0,
      hasPdf: false,
      hasImage: false,
      preferences: { ...defaultRoutingPreferences(), auto: true },
      available: [clearFree],
      forceAuto: true,
    });
    expect(onlyFree.provider).toBe("clear-free");
  });

  it("stops when fallback is off and uses CLEAR Free only when fallback is on", () => {
    const base = {
      question: "Explain a lock",
      sourceLength: 0,
      hasPdf: false,
      hasImage: false,
      available: [clearFree],
      explicit: { provider: "openai" as const, model: "gpt-4.1-mini" },
    };
    expect(() => chooseRoute({ ...base, preferences: defaultRoutingPreferences() })).toThrow(/Fallback is off/);
    const fallen = chooseRoute({
      ...base,
      preferences: { ...defaultRoutingPreferences(), fallbackAllowed: true },
    });
    expect(fallen).toMatchObject({ provider: "clear-free", fallback: true, reason: "fallback" });
    expect(
      shouldUseClearFreeFallback({
        error: new ClearError("provider_quota", "limited", { status: 429 }),
        provider: "openai",
        alreadyFellBack: false,
        fallbackAllowed: false,
        clearFreeAvailable: true,
      }),
    ).toBe(false);
  });

  it("sends a PDF only to a provider that can read it", () => {
    const chosen = chooseRoute({
      question: "Explain this paper",
      sourceLength: 100,
      hasPdf: true,
      hasImage: false,
      preferences: { ...defaultRoutingPreferences(), auto: true, tasks: { research: { provider: "anthropic", model: "claude" } } },
      available: [clearFree, anthropic],
      forceAuto: true,
    });
    expect(chosen.provider).toBe("clear-free");
  });
});
