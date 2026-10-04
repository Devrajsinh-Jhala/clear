import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { isByokProvider, type ByokProviderId } from "@/src/lib/ai/byok";
import { isUuid } from "@/src/lib/explanation/normalize";
import { decryptSecret, encryptSecret, type EncryptedSecret } from "@/src/lib/security/encryption";

export type StoredCredential = EncryptedSecret & {
  provider: ByokProviderId;
  maskedSuffix: string;
  model: string;
  baseUrl?: string;
  updatedAt: string;
};

type VaultFile = { credentials: StoredCredential[] };

const root = path.join(process.cwd(), ".data", "credentials");

export async function listStoredCredentials(learnerId: string): Promise<StoredCredential[]> {
  return (await readVault(learnerId)).credentials;
}

export async function readStoredCredential(
  learnerId: string,
  provider: ByokProviderId,
): Promise<StoredCredential | undefined> {
  return (await readVault(learnerId)).credentials.find((item) => item.provider === provider);
}

export async function writeStoredCredential(learnerId: string, credential: StoredCredential): Promise<void> {
  const vault = await readVault(learnerId);
  const credentials = vault.credentials.filter((item) => item.provider !== credential.provider);
  credentials.push(credential);
  await writeVault(learnerId, { credentials });
}

export async function deleteStoredCredential(learnerId: string, provider: ByokProviderId): Promise<void> {
  const vault = await readVault(learnerId);
  await writeVault(learnerId, {
    credentials: vault.credentials.filter((item) => item.provider !== provider),
  });
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
  try {
    const parsed = JSON.parse(await readFile(vaultPath(learnerId), "utf8")) as VaultFile;
    if (!parsed || !Array.isArray(parsed.credentials)) return { credentials: [] };
    return {
      credentials: parsed.credentials.filter(
        (item): item is StoredCredential =>
          Boolean(item) && isByokProvider(item.provider) && typeof item.ciphertext === "string" && typeof item.model === "string",
      ),
    };
  } catch {
    return { credentials: [] };
  }
}

async function writeVault(learnerId: string, vault: VaultFile): Promise<void> {
  if (!isUuid(learnerId)) throw new Error("Refusing to store a provider key with an invalid id.");
  await mkdir(root, { recursive: true });
  const destination = vaultPath(learnerId);
  const temporary = path.join(root, `${learnerId}.${process.pid}.tmp`);
  await writeFile(temporary, JSON.stringify(vault), "utf8");
  await rename(temporary, destination);
}

function vaultPath(learnerId: string): string {
  return path.join(root, `${learnerId}.json`);
}
