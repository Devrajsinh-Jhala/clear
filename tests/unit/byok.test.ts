import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { encodeByokProvider, parseStoredProvider } from "@/src/lib/ai/byok";
import { openCredential, sealCredential } from "@/src/lib/ai/credentials";
import { assertProviderMedia, getProvider, selectGeneration } from "@/src/lib/ai/router";
import { ClearError } from "@/src/lib/api/errors";
import { maskedSuffix } from "@/src/lib/security/encryption";

describe("bring your own key", () => {
  it("encrypts a provider key and returns only a masked suffix", () => {
    const apiKey = "sk-test-secret-value";
    const key = randomBytes(32);
    const sealed = sealCredential(
      { provider: "openai", apiKey, model: "gpt-4.1-mini", maskedSuffix: maskedSuffix(apiKey) },
      key,
    );
    expect(JSON.stringify(sealed)).not.toContain(apiKey);
    expect(sealed.maskedSuffix).toBe("••••alue");
    expect(openCredential(sealed, key).apiKey).toBe(apiKey);
    expect(parseStoredProvider(encodeByokProvider("openai"))).toEqual({
      adapterId: "openai",
      usesOwnKey: true,
    });
  });

  it("stops when the saved provider has no key", () => {
    expect(() => selectGeneration({ adapterId: "openai", model: "gpt-4.1-mini" })).toThrow(ClearError);
    try {
      selectGeneration({ adapterId: "openai", model: "gpt-4.1-mini" });
    } catch (error) {
      expect(error).toBeInstanceOf(ClearError);
      expect((error as ClearError).message).toContain("did not switch to CLEAR Free");
    }
  });

  it("uses the saved provider instead of CLEAR Free", () => {
    const selected = selectGeneration({
      adapterId: "anthropic",
      model: "claude-sonnet-4-5",
      credential: { apiKey: "sk-ant-test" },
    });
    expect(selected.provider.id).toBe("anthropic");
    expect(selected.storedProviderId).toBe("byok:anthropic");
    expect(() =>
      assertProviderMedia(getProvider("openai"), [{ mimeType: "application/pdf", dataBase64: "" }]),
    ).toThrow(/PDF/);
  });
});
