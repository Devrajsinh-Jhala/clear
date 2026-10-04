import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { isUuid } from "@/src/lib/explanation/normalize";
import { shareSnapshotSchema, validShareSlug, type ShareSnapshot, type ShareStore } from "@/src/lib/sharing/types";

const pendingWrites = new Map<string, Promise<void>>();

/** A lesson has one atomic state file, so concurrent replacements cannot orphan active links. */
export function createFileShareStore(root = path.join(process.cwd(), ".data", "shares")): ShareStore {
  async function getForLesson(id: string): Promise<ShareSnapshot | null> {
    if (!isUuid(id)) return null;
    try {
      const raw = JSON.parse(await readFile(path.join(root, `${id}.json`), "utf8"));
      if (raw === null) return null;
      const parsed = shareSnapshotSchema.safeParse(raw);
      return parsed.success && parsed.data.conversationId === id ? parsed.data : null;
    } catch (error) {
      if (isMissing(error) || error instanceof SyntaxError) return null;
      throw error;
    }
  }

  async function atomicWrite(id: string, state: ShareSnapshot | null) {
    if (!isUuid(id)) throw new Error("Refusing to store a share for an invalid lesson.");
    const destination = path.join(root, `${id}.json`);
    const previous = pendingWrites.get(destination) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(async () => {
      await mkdir(root, { recursive: true });
      const temporary = path.join(root, `${id}.${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, JSON.stringify(state), "utf8");
        // Windows may briefly deny replacement while another worker/read holds the file.
        for (let attempt = 0; ; attempt += 1) {
          try { await rename(temporary, destination); break; }
          catch (error) {
            if (attempt >= 6 || !isBusy(error)) throw error;
            await new Promise((resolve) => setTimeout(resolve, 10 * 2 ** attempt));
          }
        }
      } finally {
        await unlink(temporary).catch((error) => { if (!isMissing(error)) throw error; });
      }
    });
    pendingWrites.set(destination, next);
    try { await next; }
    finally { if (pendingWrites.get(destination) === next) pendingWrites.delete(destination); }
  }

  return {
    getForLesson,
    async getBySlug(slug) {
      if (!validShareSlug(slug)) return null;
      let names: string[];
      try { names = await readdir(root); }
      catch (error) { if (isMissing(error)) return null; throw error; }
      for (const name of names) {
        if (!name.endsWith(".json")) continue;
        const record = await getForLesson(name.slice(0, -5));
        if (record?.slug === slug) return record;
      }
      return null;
    },
    async replace(snapshot) {
      const parsed = shareSnapshotSchema.parse(snapshot);
      await atomicWrite(parsed.conversationId, parsed);
    },
    async revoke(id) { await atomicWrite(id, null); },
  };
}

function isMissing(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isBusy(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && ["EPERM", "EBUSY", "EACCES"].includes(String(error.code));
}
