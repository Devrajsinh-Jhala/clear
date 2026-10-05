import { ClearError } from "@/src/lib/api/errors";

const DEFAULT_LIMIT = 1024 * 1024;
const MAXIMUM_LIMIT = 4 * 1024 * 1024;

export function providerResponseByteLimit(): number {
  const value = process.env.CLEAR_PROVIDER_RESPONSE_MAX_BYTES;
  if (value === undefined || value === "") return DEFAULT_LIMIT;
  const limit = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(limit) || limit < 1 || limit > MAXIMUM_LIMIT) {
    throw new ClearError("provider_not_configured", "CLEAR's provider response limit is not configured correctly.", { status: 503 });
  }
  return limit;
}

export function discardProviderResponse(response: Response): void {
  // Cancellation can itself wait on an upstream socket. Start it without making
  // the error response wait for an untrusted provider to finish cleanup.
  void response.body?.cancel().catch(() => undefined);
}

export async function readProviderResponse(response: Response): Promise<string> {
  let limit: number;
  try { limit = providerResponseByteLimit(); } catch (error) { discardProviderResponse(response); throw error; }
  const declared = response.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > limit) {
    discardProviderResponse(response);
    throw oversizedResponse();
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  // A bounded byte buffer avoids per-chunk string/array overhead from providers
  // deliberately sending tiny chunks. Limits apply to decoded fetch bytes, even
  // if a compressed or misleading Content-Length header is smaller.
  const bytes = new Uint8Array(limit);
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (chunk.value.byteLength > limit - length) throw oversizedResponse();
      bytes.set(chunk.value, length);
      length += chunk.value.byteLength;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length));
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    if (error instanceof ClearError) throw error;
    const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new ClearError(timeout ? "provider_timeout" : "provider_error", timeout ? "The provider took too long to return its response." : "The provider returned an unreadable response.", { status: timeout ? 504 : 502, retryable: true });
  } finally { reader.releaseLock(); }
}

function oversizedResponse(): ClearError {
  return new ClearError("provider_error", "The provider's response exceeded CLEAR's safe size limit. Try a shorter request.", { status: 502, retryable: false });
}

export function tokenCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}
