import "server-only";

import { ClearError } from "@/src/lib/api/errors";
import { assertModelId, byokProviderLabel, isByokProvider, type ByokProviderId } from "@/src/lib/ai/byok";
import {
  deleteStoredCredential,
  listStoredCredentials,
  openCredential,
  readStoredCredential,
  sealCredential,
  writeStoredCredential,
} from "@/src/lib/ai/credentials";
import { selectGeneration } from "@/src/lib/ai/router";
import type { ProviderCredential } from "@/src/lib/ai/types";
import { currentLearnerId, ensureLearnerId } from "@/src/lib/learning/session";
import { decodeEncryptionKey, maskedSuffix } from "@/src/lib/security/encryption";
import { UnsafeUrlError } from "@/src/lib/security/ssrf";

export type PublicCredential = {
  id: ByokProviderId;
  label: string;
  maskedSuffix: string;
  model: string;
  baseHost?: string;
};

// Reading never creates a browser identity. Two requests that each created one on a first
// visit could leave the browser holding a different id from the one that owns its lesson.
export async function listPublicCredentials(): Promise<PublicCredential[]> {
  const learnerId = await currentLearnerId();
  if (!learnerId) return [];
  const stored = await listStoredCredentials(learnerId);
  return stored.map(toPublic);
}

export async function connectProvider(input: {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
}): Promise<PublicCredential> {
  const provider = requireProvider(input.provider);
  const apiKey = input.apiKey.trim();
  if (apiKey.length < 8 || apiKey.length > 400) {
    throw new ClearError("invalid_request", "Paste the API key for that provider.", { status: 400 });
  }
  const model = validModel(input.model);
  const baseUrl = provider === "compatible" ? validBaseUrl(input.baseUrl) : undefined;
  const credential = { apiKey, baseUrl };
  await testProvider(provider, model, credential);
  const learnerId = await ensureLearnerId();
  const sealed = sealCredential(
    { provider, apiKey, model, baseUrl, maskedSuffix: maskedSuffix(apiKey) },
    encryptionKey(),
  );
  await writeStoredCredential(learnerId, sealed);
  const saved = await readStoredCredential(learnerId, provider);
  if (!saved) throw new ClearError("internal_error", "CLEAR could not save that key.", { status: 500 });
  return toPublic(saved);
}

export async function removeProvider(providerId: string): Promise<void> {
  const provider = requireProvider(providerId);
  const learnerId = await currentLearnerId();
  if (learnerId) await deleteStoredCredential(learnerId, provider);
}

export async function testSavedProvider(providerId: string): Promise<void> {
  const loaded = await loadOwnCredential(providerId);
  await testProvider(loaded.provider, loaded.model, loaded.credential);
}

export async function loadLessonCredential(providerId: string): Promise<{
  provider: ByokProviderId;
  model: string;
  credential: ProviderCredential;
}> {
  const provider = requireProvider(providerId);
  const learnerId = await currentLearnerId();
  if (!learnerId) {
    throw new ClearError(
      "provider_not_configured",
      `This lesson uses your ${byokProviderLabel(provider)} key, and that key is not in this browser. CLEAR did not switch to CLEAR Free.`,
      { status: 400 },
    );
  }
  return openSaved(provider, learnerId);
}

export async function loadOwnCredential(providerId: string): Promise<{
  provider: ByokProviderId;
  model: string;
  credential: ProviderCredential;
}> {
  const provider = requireProvider(providerId);
  return openSaved(provider, await ensureLearnerId());
}

async function openSaved(provider: ByokProviderId, learnerId: string): Promise<{
  provider: ByokProviderId;
  model: string;
  credential: ProviderCredential;
}> {
  const stored = await readStoredCredential(learnerId, provider);
  if (!stored) {
    throw new ClearError(
      "provider_not_configured",
      `Connect ${byokProviderLabel(provider)} in Settings. CLEAR did not switch to CLEAR Free.`,
      { status: 400 },
    );
  }
  let opened: { apiKey: string; baseUrl?: string; model: string };
  try {
    opened = openCredential(stored, encryptionKey());
  } catch {
    throw new ClearError(
      "provider_not_configured",
      "CLEAR could not read that saved key. Connect it again in Settings. CLEAR did not switch to CLEAR Free.",
      { status: 400 },
    );
  }
  return { provider, model: opened.model, credential: { apiKey: opened.apiKey, baseUrl: opened.baseUrl } };
}

async function testProvider(provider: ByokProviderId, model: string, credential: ProviderCredential): Promise<void> {
  const selected = selectGeneration({ adapterId: provider, model, credential });
  await selected.provider.generate(
    {
      model: selected.model,
      system: "Reply with JSON only.",
      messages: [{ role: "user", content: 'Return this JSON object and nothing else: {"ok":true}' }],
      temperature: 0,
      maxOutputTokens: 64,
    },
    selected.credential,
  );
}

function requireProvider(value: string): ByokProviderId {
  if (!isByokProvider(value)) {
    throw new ClearError("invalid_request", "Choose Gemini, OpenAI, Anthropic, xAI, or a custom endpoint.", { status: 400 });
  }
  return value;
}

function validModel(model: string): string {
  try {
    return assertModelId(model);
  } catch (error) {
    throw new ClearError("invalid_request", error instanceof Error ? error.message : "Choose a model.", { status: 400 });
  }
}

function validBaseUrl(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ClearError("invalid_request", "Enter the HTTPS base URL for that endpoint.", { status: 400 });
  }
  if (url.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new ClearError("unsafe_provider_url", new UnsafeUrlError("Provider URL must use HTTPS.").message, { status: 400 });
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ClearError("unsafe_provider_url", "Provider URL must use HTTPS.", { status: 400 });
  }
  return trimmed.replace(/\/$/, "");
}

function encryptionKey(): Buffer {
  const encoded = process.env.APP_ENCRYPTION_KEY;
  if (!encoded) {
    throw new ClearError("encryption_not_configured", "Set APP_ENCRYPTION_KEY in .env.local before saving an API key.", {
      status: 503,
    });
  }
  try {
    return decodeEncryptionKey(encoded);
  } catch {
    throw new ClearError("encryption_not_configured", "APP_ENCRYPTION_KEY must be 32 bytes of base64.", { status: 503 });
  }
}

function toPublic(item: { provider: ByokProviderId; maskedSuffix: string; model: string; baseUrl?: string }): PublicCredential {
  let baseHost: string | undefined;
  if (item.baseUrl) {
    try {
      baseHost = new URL(item.baseUrl).host;
    } catch {
      baseHost = undefined;
    }
  }
  return {
    id: item.provider,
    label: byokProviderLabel(item.provider),
    maskedSuffix: item.maskedSuffix,
    model: item.model,
    baseHost,
  };
}
