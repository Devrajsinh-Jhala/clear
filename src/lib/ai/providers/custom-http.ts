import "server-only";

import { lookup } from "node:dns/promises";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { Readable } from "node:stream";

import { assertSafeProviderUrl, isBlockedIp, UnsafeUrlError, type DnsLookup } from "@/src/lib/security/ssrf";

export async function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) { void operation.catch(() => undefined); throw signal.reason; }
  return new Promise<T>((resolve, reject) => {
    const aborted = () => reject(signal.reason);
    signal.addEventListener("abort", aborted, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", aborted));
  });
}

const resolveAddresses: DnsLookup = async (hostname) => (await lookup(hostname, { all: true, verbatim: true })).map((record) => record.address);

// The lookup used by the actual socket validates every answer and returns one
// vetted address. Node cannot subsequently perform an unrestricted second lookup.
export function safeConnectionLookup(signal: AbortSignal, allowLocal = false, resolve: DnsLookup = resolveAddresses): LookupFunction {
  return (hostname, options, callback) => {
    void abortable(resolve(hostname), signal).then((addresses) => {
      if (!addresses.length) throw new UnsafeUrlError("Provider URL did not resolve.");
      if (addresses.some((address) => isBlockedIp(address) && !(allowLocal && loopback(address)))) {
        throw new UnsafeUrlError("Provider URL resolves to a blocked address.");
      }
      const candidates = addresses.filter((address) => !options.family || isIP(address) === options.family);
      if (!candidates.length) throw new UnsafeUrlError("Provider URL did not resolve to a supported address.");
      // Prefer IPv4 when unspecified; some serverless egress supports only IPv4.
      const address = !options.family ? candidates.find((candidate) => isIP(candidate) === 4) ?? candidates[0] : candidates[0];
      signal.throwIfAborted();
      if (options.all) callback(null, [{ address, family: isIP(address) }]);
      else callback(null, address, isIP(address));
    }).catch((error: unknown) => callback(error instanceof Error ? error : new Error("Provider DNS lookup failed."), "", 0));
  };
}

function loopback(address: string): boolean {
  let canonical: string;
  try { canonical = isIP(address) === 6 ? new URL(`http://[${address}]/`).hostname.slice(1, -1) : address; }
  catch { return false; }
  return canonical === "::1" || canonical.startsWith("127.");
}

export async function customProviderRequest(endpoint: URL, input: { body: string; apiKey: string; signal: AbortSignal }): Promise<Response> {
  const allowLocal = process.env.NODE_ENV !== "production";
  // Also validate literals and host syntax, which Node does not send through lookup.
  await abortable(assertSafeProviderUrl(endpoint.toString(), { allowLocal, lookup: resolveAddresses }), input.signal);
  input.signal.throwIfAborted();
  return new Promise<Response>((resolve, reject) => {
    const nativeRequest = endpoint.protocol === "https:" ? httpsRequest : httpRequest;
    const hostname = endpoint.hostname.replace(/^\[|\]$/g, "");
    const outgoing = nativeRequest(endpoint, {
      method: "POST",
      agent: false,
      // Keep the URL's hostname for Host, SNI, and normal TLS certificate checks.
      ...(endpoint.protocol === "https:" ? { servername: isIP(hostname) ? "" : hostname, rejectUnauthorized: true } : {}),
      lookup: safeConnectionLookup(input.signal, allowLocal),
      signal: input.signal,
      headers: { authorization: `Bearer ${input.apiKey}`, "content-type": "application/json", "accept-encoding": "identity" },
    }, (incoming: IncomingMessage) => {
      try {
        const headers = new Headers();
        for (let index = 0; index < incoming.rawHeaders.length; index += 2) headers.append(incoming.rawHeaders[index], incoming.rawHeaders[index + 1]);
        // The native stream retains backpressure and cancellation. No response is
        // buffered here; the existing byte-bounded reader consumes the body.
        const body = Readable.toWeb(incoming, { strategy: { highWaterMark: 64 * 1024, size: (chunk: Uint8Array) => chunk.byteLength } }) as ReadableStream<Uint8Array>;
        resolve(new Response(body, { status: incoming.statusCode ?? 502, headers }));
      } catch (error) { incoming.destroy(); reject(error); }
    });
    outgoing.once("error", (error) => reject(input.signal.aborted ? input.signal.reason : error));
    outgoing.end(input.body);
  });
}
