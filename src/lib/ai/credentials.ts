import { BYOK_PROVIDERS, isByokProvider, type ByokProviderId } from "@/src/lib/ai/byok";
import { isUuid } from "@/src/lib/explanation/normalize";
import { decryptSecret, encryptSecret, type EncryptedSecret } from "@/src/lib/security/encryption";
import { deletePrivateState, readPrivateState, writePrivateState } from "@/src/lib/storage/state";

export type StoredCredential = EncryptedSecret & {
  provider: ByokProviderId;
  maskedSuffix: string;
  model: string;
  baseUrl?: string;
  updatedAt: string;
};

type VaultFile = { credentials: StoredCredential[] };

export async function listStoredCredentials(learnerId: string): Promise<StoredCredential[]> {
  if (!isUuid(learnerId)) return [];
  const legacy = (await readVault(learnerId)).credentials;
  const current = await Promise.all(BYOK_PROVIDERS.map(({ id }) => readPrivateState<StoredCredential>("credentials", `${learnerId}/${id}`)));
  return [...new Map([...legacy, ...current.filter(validCredential)].map((item) => [item.provider, item])).values()];
}

export async function readStoredCredential(
  learnerId: string,
  provider: ByokProviderId,
): Promise<StoredCredential | undefined> {
  if (!isUuid(learnerId)) return;
  const stored = await readPrivateState<StoredCredential>("credentials", `${learnerId}/${provider}`);
  return validCredential(stored) ? stored : (await readVault(learnerId)).credentials.find((item) => item.provider === provider);
}

export async function writeStoredCredential(learnerId: string, credential: StoredCredential): Promise<void> {
  if (!isUuid(learnerId) || !validCredential(credential)) throw new Error("Invalid encrypted provider credential.");
  await writePrivateState("credentials", `${learnerId}/${credential.provider}`, credential);
}

export async function deleteStoredCredential(learnerId: string, provider: ByokProviderId): Promise<void> {
  const vault = await readVault(learnerId);
  await deletePrivateState("credentials", `${learnerId}/${provider}`);
  if (vault.credentials.some((item) => item.provider === provider)) await writePrivateState("credentials", learnerId, { credentials: vault.credentials.filter((item) => item.provider !== provider) });
}

export function openCredential(credential: StoredCredential, key: Buffer): { apiKey: string; baseUrl?: string; model: string } {
  return {
    apiKey: decryptSecret(credential, key),
    baseUrl: credential.baseUrl,
    model: credential.model,
  };
}

export function sealCredential(
  input: { provider: ByokProviderId; apiKey: string; model: string; baseUrl?: string; maskedSuffix: string },
  key: Buffer,
): StoredCredential {
  return {
    ...encryptSecret(input.apiKey, key),
    provider: input.provider,
    maskedSuffix: input.maskedSuffix,
    model: input.model,
    baseUrl: input.baseUrl,
    updatedAt: new Date().toISOString(),
  };
}

async function readVault(learnerId: string): Promise<VaultFile> {
  if (!isUuid(learnerId)) return { credentials: [] };
  const parsed = await readPrivateState<VaultFile>("credentials", learnerId);
  return { credentials: Array.isArray(parsed?.credentials) ? parsed.credentials.filter(validCredential) : [] };
}

function validCredential(item: StoredCredential | null): item is StoredCredential {
  return Boolean(item && isByokProvider(item.provider) && typeof item.ciphertext === "string" && typeof item.nonce === "string" && typeof item.authTag === "string" && typeof item.model === "string");
}
