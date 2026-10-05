import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { ClearError } from "@/src/lib/api/errors";
import { currentAccount } from "@/src/lib/auth/session";
import { isUuid } from "@/src/lib/explanation/normalize";
import { storageAdmin } from "@/src/lib/storage/admin";
import { assertLocalPersistence, dataDirectory } from "@/src/lib/storage/path";

type Namespace = "credentials" | "learning" | "routing" | "lesson-meta";

function validateKey(key: string) {
  if (!/^[a-f0-9-]{36}(?:\/[a-z-]{1,20})?$/i.test(key) || !isUuid(key.split("/")[0])) throw new Error("Invalid private storage key.");
}

async function scopedKey(namespace: Namespace, key: string) {
  validateKey(key);
  if (namespace === "lesson-meta") return key;
  const account = await currentAccount();
  // Even a disclosed account learner identifier never becomes a guest bearer key.
  return account ? `account/${account.id}/${key}` : key;
}

export async function readPrivateState<T>(namespace: Namespace, key: string): Promise<T | null> {
  key = await scopedKey(namespace, key);
  const db = storageAdmin();
  if (db) {
    const { data, error } = await db.from("clear_private_state").select("value").eq("namespace", namespace).eq("record_key", key).maybeSingle();
    if (error) throw unavailable();
    return data ? data.value as T : null;
  }
  assertLocalPersistence();
  try { return JSON.parse(await readFile(localPath(namespace, key), "utf8")) as T; }
  catch (error) {
    if (missing(error)) return null;
    throw unavailable();
  }
}

export async function writePrivateState(namespace: Namespace, key: string, value: unknown): Promise<void> {
  key = await scopedKey(namespace, key);
  const db = storageAdmin();
  if (db) {
    const { error } = await db.from("clear_private_state").upsert({ namespace, record_key: key, value, updated_at: new Date().toISOString() }, { onConflict: "namespace,record_key" });
    if (error) throw unavailable();
    return;
  }
  assertLocalPersistence();
  const destination = localPath(namespace, key);
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, JSON.stringify(value), "utf8"); await rename(temporary, destination); }
  finally { await unlink(temporary).catch((error) => { if (!missing(error)) throw error; }); }
}

export async function deletePrivateState(namespace: Namespace, key: string): Promise<void> {
  key = await scopedKey(namespace, key);
  const db = storageAdmin();
  if (db) {
    const { error } = await db.from("clear_private_state").delete().eq("namespace", namespace).eq("record_key", key);
    if (error) throw unavailable();
    return;
  }
  assertLocalPersistence();
  await unlink(localPath(namespace, key)).catch((error) => { if (!missing(error)) throw unavailable(); });
}

function localPath(namespace: Namespace, key: string) { return dataDirectory(namespace, `${key.replaceAll("/", "--")}.json`); }
function missing(error: unknown) { return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"; }
function unavailable() { return new ClearError("storage_unavailable", "Your saved data could not be reached. Check the storage setup and try again.", { status: 503, retryable: true }); }
