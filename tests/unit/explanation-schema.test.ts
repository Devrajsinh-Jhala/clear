import { describe, expect, it } from "vitest";

import { ClearError } from "@/src/lib/api/errors";
import { validateConsistency } from "@/src/lib/explanation/consistency";
import { MUTEX_FIXTURE } from "@/src/lib/explanation/fixtures/mutex";
import { buildSampleModelOutput, sampleAudience, sampleStamp } from "@/src/lib/explanation/fixtures/sample";
import { explanationDocumentSchema } from "@/src/lib/explanation/schema";
import { acceptModelOutput } from "@/src/lib/explanation/validate";
import { decryptSecret, encryptSecret } from "@/src/lib/security/encryption";
import { assertSafeProviderUrl, isBlockedIp, UnsafeUrlError } from "@/src/lib/security/ssrf";

describe("explanation schema", () => {
  it("accepts the mutex lesson", () => {
    const document = explanationDocumentSchema.parse(MUTEX_FIXTURE);
    expect(validateConsistency(document)).toEqual([]);
    expect(document.concepts.map((concept) => concept.id)).toEqual(
      expect.arrayContaining(["mutex", "race-condition", "critical-section"]),
    );
    expect(document.mentalModel.analogy?.limitations.join(" ")).toMatch(/operating system/i);
  });

  it("rejects a relationship to an unknown concept", () => {
    const broken = structuredClone(MUTEX_FIXTURE);
    broken.relationships[0].to = "missing-concept";
    expect(validateConsistency(broken).length).toBeGreaterThan(0);
  });
});

describe("model output acceptance", () => {
  it("builds a valid document from model JSON", async () => {
    const document = await acceptModelOutput({
      raw: buildSampleModelOutput("How does DNS work?"),
      question: "How does DNS work?",
      audience: sampleAudience(),
      stamp: sampleStamp(),
    });
    expect(document.topic).toContain("DNS");
    expect(document.schemaVersion).toBe("1.0");
  });

  it("repairs one invalid draft", async () => {
    const document = await acceptModelOutput({
      raw: { topic: "" },
      question: "How does DNS work?",
      audience: sampleAudience(),
      stamp: sampleStamp(),
      repair: async () => buildSampleModelOutput("How does DNS work?"),
    });
    expect(document.essence.length).toBeGreaterThan(10);
  });

  it("stops after one failed repair", async () => {
    await expect(
      acceptModelOutput({
        raw: {},
        question: "How does DNS work?",
        audience: sampleAudience(),
        stamp: sampleStamp(),
        repair: async () => ({}),
      }),
    ).rejects.toBeInstanceOf(ClearError);
  });
});

describe("encryption", () => {
  it("round-trips a provider key", () => {
    const key = Buffer.alloc(32, 7);
    const encrypted = encryptSecret("sk-test-key-value", key);
    expect(encrypted.ciphertext).not.toContain("sk-test");
    expect(decryptSecret(encrypted, key)).toBe("sk-test-key-value");
  });
});

describe("provider URL safety", () => {
  it("blocks private and loopback targets", async () => {
    expect(isBlockedIp("127.0.0.1")).toBe(true);
    expect(isBlockedIp("10.1.2.3")).toBe(true);
    expect(isBlockedIp("192.168.1.8")).toBe(true);
    expect(isBlockedIp("169.254.169.254")).toBe(true);
    expect(isBlockedIp("8.8.8.8")).toBe(false);

    await expect(
      assertSafeProviderUrl("http://example.com", { lookup: async () => ["8.8.8.8"] }),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(
      assertSafeProviderUrl("https://127.0.0.1/v1", { lookup: async () => ["127.0.0.1"] }),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(
      assertSafeProviderUrl("https://proxy.internal/v1", { lookup: async () => ["8.8.8.8"] }),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("allows a public https endpoint", async () => {
    const url = await assertSafeProviderUrl("https://api.openai.com/v1", {
      lookup: async () => ["1.1.1.1"],
    });
    expect(url.hostname).toBe("api.openai.com");
  });

  it("rejects a hostname that resolves privately", async () => {
    await expect(
      assertSafeProviderUrl("https://example.com", { lookup: async () => ["10.0.0.4"] }),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
  });
});
