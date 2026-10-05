import "server-only";

import { ClearError } from "@/src/lib/api/errors";
import { configuredNumber } from "@/src/lib/security/limits/config";

export function requestBodyLimit(contentType: string): number {
  if (!contentType.toLowerCase().includes("multipart/form-data")) return configuredNumber("CLEAR_MAX_JSON_BYTES", 64 * 1024, 1024 * 1024, 1024);
  const uploadBytes = configuredNumber("MAX_UPLOAD_MB", 10, 20, 1) * 1024 * 1024;
  const deploymentCap = process.env.VERCEL ? 4 * 1024 * 1024 : 64 * 1024 * 1024;
  return Math.min(configuredNumber("CLEAR_MAX_MULTIPART_BYTES", 3 * uploadBytes + 64 * 1024, 64 * 1024 * 1024, 1024), 3 * uploadBytes + 64 * 1024, deploymentCap);
}

export function assertBodySize(request: Request, maxBytes = requestBodyLimit(request.headers.get("content-type") ?? "")): void {
  const length = request.headers.get("content-length");
  if (length === null) return;
  if (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length))) {
    throw new ClearError("invalid_request", "The request size is not valid.", { status: 400 });
  }
  if (Number(length) > maxBytes) throw payloadTooLarge();
}

function payloadTooLarge(): ClearError {
  return new ClearError("payload_too_large", "That request is too large. Shorten the text or use smaller files.", { status: 413 });
}

export async function readBoundedBody(request: Request, maxBytes = requestBodyLimit(request.headers.get("content-type") ?? "")): Promise<Uint8Array> {
  assertBodySize(request, maxBytes);
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw payloadTooLarge();
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function readBoundedJson(request: Request, maxBytes?: number): Promise<unknown> {
  const body = await readBoundedBody(request, maxBytes);
  try { return JSON.parse(new TextDecoder().decode(body)); }
  catch { throw new ClearError("invalid_request", "Send a valid JSON request and try again.", { status: 400 }); }
}

export async function readBoundedFormData(request: Request, maxBytes?: number): Promise<FormData> {
  const body = await readBoundedBody(request, maxBytes);
  try { return await new Response(new Uint8Array(body), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData(); }
  catch { throw new ClearError("invalid_request", "CLEAR could not read those files. Attach them again and retry.", { status: 400 }); }
}
