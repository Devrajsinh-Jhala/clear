import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { assertBodySize, readBoundedBody, readBoundedFormData, readBoundedJson, requestBodyLimit } from "@/src/lib/security/limits/body";

afterEach(() => { vi.unstubAllEnvs(); });

describe("bounded request parsing", () => {
  it("rejects a declared oversized body before consuming the stream", async () => {
    const body = new ReadableStream<Uint8Array>({ pull() { throw new Error("should not read"); } });
    const request = new Request("https://clear.example/api/explanations", { method: "POST", body, duplex: "half", headers: { "Content-Length": "1001" } } as RequestInit);
    await expect(readBoundedBody(request, 1000)).rejects.toMatchObject({ status: 413, code: "payload_too_large" });
    expect(request.bodyUsed).toBe(false);
  });

  it("counts chunked bytes and cancels a dishonest or absent Content-Length", async () => {
    for (const headers of [{}, { "Content-Length": "1" }]) {
      const cancelled = vi.fn();
      let count = 0;
      const stream = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array(600)); count++; }, cancel: cancelled });
      const request = new Request("https://clear.example/api/explanations", { method: "POST", body: stream, duplex: "half", headers } as RequestInit);
      await expect(readBoundedBody(request, 1000)).rejects.toMatchObject({ status: 413 });
      expect(cancelled).toHaveBeenCalled();
      expect(count).toBeLessThanOrEqual(3);
    }
  });

  it("parses bounded JSON and rejects malformed JSON and invalid size headers", async () => {
    const valid = new Request("https://clear.example/api/explanations", { method: "POST", body: JSON.stringify({ question: "A question" }) });
    expect(await readBoundedJson(valid, 1000)).toEqual({ question: "A question" });
    const invalid = new Request("https://clear.example/api/explanations", { method: "POST", body: "{" });
    await expect(readBoundedJson(invalid)).rejects.toMatchObject({ status: 400, code: "invalid_request" });
    for (const size of ["-1", "1e20", "Infinity", "1, 1"]) {
      expect(() => assertBodySize(new Request("https://clear.example", { headers: { "Content-Length": size } }))).toThrow();
    }
  });

  it("bounds the full multipart envelope before parsing files", async () => {
    const form = new FormData();
    form.set("question", "Explain locks");
    form.set("files", new Blob(["synthetic attachment"], { type: "text/plain" }), "example.txt");
    const request = new Request("https://clear.example/api/explanations", { method: "POST", body: form });
    const parsed = await readBoundedFormData(request, 1000);
    expect(parsed.get("question")).toBe("Explain locks");
    expect((parsed.get("files") as File).name).toBe("example.txt");
    const oversized = new Request("https://clear.example/api/explanations", { method: "POST", body: form });
    await expect(readBoundedFormData(oversized, 100)).rejects.toMatchObject({ status: 413 });
  });

  it("keeps JSON and upload envelope limits configurable with a bounded maximum", () => {
    vi.stubEnv("CLEAR_MAX_JSON_BYTES", "4096");
    vi.stubEnv("MAX_UPLOAD_MB", "5");
    expect(requestBodyLimit("application/json")).toBe(4096);
    expect(requestBodyLimit("multipart/form-data; boundary=x")).toBe(15 * 1024 * 1024 + 64 * 1024);
    vi.stubEnv("CLEAR_MAX_MULTIPART_BYTES", "67108864");
    expect(requestBodyLimit("multipart/form-data")).toBe(15 * 1024 * 1024 + 64 * 1024);
    vi.stubEnv("VERCEL", "1");
    expect(requestBodyLimit("multipart/form-data")).toBe(4 * 1024 * 1024);
  });
});
