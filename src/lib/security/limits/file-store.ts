import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";

import { emptyLimitState, consumeState, releaseState } from "@/src/lib/security/limits/engine";
import type { LimitState, LimitStore } from "@/src/lib/security/limits/types";

function isState(input: unknown): input is LimitState {
  if (!input || typeof input !== "object") return false;
  const state = input as LimitState;
  return state.version === 1 && !!state.events && !!state.leases
    && Object.values(state.events).every((events) => Array.isArray(events) && events.every((item) => Number.isSafeInteger(item) && item >= 0))
    && Object.values(state.leases).every((leases) => Array.isArray(leases) && leases.every((item) => typeof item.token === "string" && Number.isSafeInteger(item.expiresAt)));
}

function filesystemCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
}

// Exclusive files serialize separate Node processes as well as simultaneous requests.
// A crashed writer leaves its lock in place: fail closed until the stopped service's
// lock is cleared, rather than risk resetting a daily budget or racing a slow writer.
export function createFileLimitStore(directory: string, clock = Date.now): LimitStore {
  const statePath = path.join(directory, "state.json");
  const lockPath = path.join(directory, "state.lock");

  async function transaction<T>(mutate: (state: LimitState) => T): Promise<T> {
    await mkdir(directory, { recursive: true });
    const deadline = Date.now() + 10_000;
    let lock;
    while (!lock) {
      try {
        lock = await open(lockPath, "wx", 0o600);
      } catch (error) {
        // Windows can report access denied while a closed lock is being removed.
        // Retrying never grants admission: only successful exclusive creation does.
        if (!["EEXIST", "EPERM", "EBUSY"].includes(filesystemCode(error) ?? "") || Date.now() >= deadline) throw error;
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
    }
    const temporary = `${statePath}.${randomUUID()}.tmp`;
    try {
      let state = emptyLimitState();
      try {
        const parsed = JSON.parse(await readFile(statePath, "utf8"));
        if (!isState(parsed)) throw new Error("Invalid limit state");
        state = parsed;
      } catch (error) {
        if (filesystemCode(error) !== "ENOENT") throw error;
      }
      const result = mutate(state);
      const output = await open(temporary, "wx", 0o600);
      try {
        await output.writeFile(JSON.stringify(state));
        await output.sync();
      } finally {
        await output.close();
      }
      await rename(temporary, statePath);
      return result;
    } finally {
      await unlink(temporary).catch(() => undefined);
      await lock.close();
      await unlink(lockPath);
    }
  }

  return {
    consume: (charges, lease) => transaction((state) => consumeState(state, charges, lease, clock())),
    release: (key, token) => transaction((state) => releaseState(state, key, token)),
  };
}
