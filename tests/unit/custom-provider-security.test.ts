import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import type { RequestOptions } from "node:https";
import { Readable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("node:dns/promises", () => ({ lookup: transport.lookup }));
vi.mock("node:https", () => ({ request: transport.request }));

import { abortable, customProviderRequest, safeConnectionLookup } from "@/src/lib/ai/providers/custom-http";
import { readProviderResponse } from "@/src/lib/ai/providers/response-body";
import { assertSafeProviderUrl, isBlockedIp, UnsafeUrlError } from "@/src/lib/security/ssrf";

const endpoint = new URL("https://custom.example/v1/chat/completions");
const input = (signal = new AbortController().signal) => ({ signal, body: '{"model":"chosen","messages":[]}', apiKey: "SYNTHETIC_SECRET_KEY" });
const incoming: Readable[] = [];
let connected: string[] = [];
let responseFactory: () => Readable;

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  transport.lookup.mockReset().mockResolvedValue([{ address: "1.1.1.1", family: 4 }]);
  connected = [];
  responseFactory = () => Readable.from([Buffer.from('{"ok":true}')]);
  transport.request.mockReset().mockImplementation((url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) => {
    const outgoing = new EventEmitter() as EventEmitter & { end: (body: string) => void };
    outgoing.end = () => {
      options.lookup!(url.hostname, { all: false }, (error, address) => {
        if (error) { outgoing.emit("error", error); return; }
        connected.push(String(address));
        const response = responseFactory();
        incoming.push(response);
        Object.assign(response, { rawHeaders: ["content-type", "application/json"], statusCode: 200 });
        if (options.signal) options.signal.addEventListener("abort", () => response.destroy(options.signal!.reason), { once: true });
        callback(response as IncomingMessage);
      });
    };
    return outgoing;
  });
});
afterEach(() => {
  for (const response of incoming.splice(0)) response.destroy();
  vi.unstubAllEnvs();
});

describe("public provider address policy", () => {
  it.each([
    "fe80::1", "fe80::1%lo0", "fe90::1", "febf::1", "ff02::1", "::1", "0:0:0:0:0:0:0:1", "::", "fc00::1", "fd12::1",
    "::ffff:127.0.0.1", "::ffff:7f00:1", "64:ff9b::a00:1", "2001::1", "2001:db8::1", "2002:a00:1::", "3fff::1",
    "0.1.2.3", "100.64.0.1", "192.0.0.1", "192.0.2.1", "192.88.99.1", "198.18.0.1", "198.51.100.1", "203.0.113.1", "224.0.0.1", "255.255.255.255",
  ])("rejects reserved/private address %s including equivalent IPv6 spellings", (address) => {
    expect(isBlockedIp(address)).toBe(true);
  });

  it.each(["1.1.1.1", "8.8.8.8", "192.0.16.1", "2606:4700:4700::1111", "2001:4860:4860::8888"])("allows globally routed address %s", (address) => {
    expect(isBlockedIp(address)).toBe(false);
  });

  it("rejects an IPv6 private DNS answer and literal before creating a request", async () => {
    transport.lookup.mockResolvedValue([{ address: "fe90::1", family: 6 }]);
    await expect(customProviderRequest(endpoint, input())).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(customProviderRequest(new URL("https://[febf::1]/v1"), input())).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(transport.request).not.toHaveBeenCalled();
  });
});

describe("native custom-provider HTTPS connection", () => {
  it("rejects a public-to-private DNS change at actual connection lookup", async () => {
    transport.lookup.mockResolvedValueOnce([{ address: "1.1.1.1", family: 4 }]).mockResolvedValueOnce([{ address: "10.0.0.9", family: 4 }]);
    await expect(customProviderRequest(endpoint, input())).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(transport.lookup).toHaveBeenCalledTimes(2);
    expect(connected).toEqual([]);
  });

  it("pins a vetted public answer and preserves original hostname/TLS verification", async () => {
    const options = input();
    const response = await customProviderRequest(endpoint, options);
    expect(await readProviderResponse(response)).toBe('{"ok":true}');
    expect(connected).toEqual(["1.1.1.1"]);
    const [url, native] = transport.request.mock.calls[0];
    expect(url.hostname).toBe("custom.example");
    expect(native).toMatchObject({ servername: "custom.example", rejectUnauthorized: true, agent: false, method: "POST", signal: options.signal });
    expect(native.headers).toEqual({ authorization: "Bearer SYNTHETIC_SECRET_KEY", "content-type": "application/json", "accept-encoding": "identity" });
    expect(native.lookup).toBeTypeOf("function");
  });

  it("rejects a mixed public/private answer instead of choosing an apparently safe entry", async () => {
    const lookup = safeConnectionLookup(new AbortController().signal, false, async () => ["1.1.1.1", "fd00::9"]);
    await expect(new Promise((resolve, reject) => lookup("custom.example", { all: true }, (error, address) => error ? reject(error) : resolve(address)))).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("returns only a pinned single address even when Node requests all records", async () => {
    const lookup = safeConnectionLookup(new AbortController().signal, false, async () => ["1.1.1.1", "8.8.8.8"]);
    const records = await new Promise((resolve, reject) => lookup("custom.example", { all: true }, (error, addresses) => error ? reject(error) : resolve(addresses)));
    expect(records).toEqual([{ address: "1.1.1.1", family: 4 }]);
  });

  it("prefers a vetted IPv4 answer when address family is unspecified", async () => {
    const lookup = safeConnectionLookup(new AbortController().signal, false, async () => ["2606:4700:4700::1111", "1.1.1.1"]);
    const records = await new Promise((resolve, reject) => lookup("custom.example", { all: true }, (error, addresses) => error ? reject(error) : resolve(addresses)));
    expect(records).toEqual([{ address: "1.1.1.1", family: 4 }]);
  });

  it("aborts a pending DNS wait without creating a socket or waiting for DNS to return", async () => {
    transport.lookup.mockImplementation(() => new Promise(() => undefined));
    const controller = new AbortController();
    const pending = customProviderRequest(endpoint, input(controller.signal));
    controller.abort(new DOMException("timeout", "TimeoutError"));
    await expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
    expect(transport.request).not.toHaveBeenCalled();
  });

  it("propagates cancellation and oversize rejection to the native response stream", async () => {
    responseFactory = () => new Readable({ read() { this.push(Buffer.alloc(20)); } });
    const response = await customProviderRequest(endpoint, input());
    await response.body!.cancel();
    expect(incoming[0].destroyed).toBe(true);
    vi.stubEnv("CLEAR_PROVIDER_RESPONSE_MAX_BYTES", "4");
    const oversized = await customProviderRequest(endpoint, input());
    await expect(readProviderResponse(oversized)).rejects.toMatchObject({ code: "provider_error" });
    expect(incoming[1].destroyed).toBe(true);
  });

  it("limits native-to-web buffering in bytes while a consumer has not read the body", async () => {
    let chunks = 0;
    responseFactory = () => new Readable({ highWaterMark: 64 * 1024, read() { chunks++; this.push(Buffer.alloc(32 * 1024)); } });
    const response = await customProviderRequest(endpoint, input());
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(chunks).toBeLessThanOrEqual(8);
    await response.body!.cancel();
    expect(incoming[0].destroyed).toBe(true);
  });

  it("keeps the shared deadline active during body consumption", async () => {
    responseFactory = () => new Readable({ read() {} });
    const controller = new AbortController();
    const response = await customProviderRequest(endpoint, input(controller.signal));
    const pending = readProviderResponse(response);
    controller.abort(new DOMException("timeout", "TimeoutError"));
    await expect(pending).rejects.toMatchObject({ code: "provider_timeout", status: 504 });
    expect(incoming[0].destroyed).toBe(true);
  });

  it("retains a timeout rejection even if DNS resolves after the deadline", async () => {
    const controller = new AbortController();
    let complete!: (value: string) => void;
    const pending = abortable(new Promise<string>((resolve) => { complete = resolve; }), controller.signal);
    controller.abort(new DOMException("timeout", "TimeoutError"));
    await expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
    complete("late DNS");
    await expect(assertSafeProviderUrl("https://custom.example", { lookup: async () => ["0:0:0:0:0:0:0:1"] })).rejects.toBeInstanceOf(UnsafeUrlError);
  });
});
