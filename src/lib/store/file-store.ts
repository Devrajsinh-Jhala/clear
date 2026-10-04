import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { isUuid } from "@/src/lib/explanation/normalize";
import type { ConversationRecord, ConversationStore } from "@/src/lib/store/types";

export function createFileStore(root = path.join(process.cwd(), ".data", "conversations")): ConversationStore {
  return {
    async get(id) {
      if (!isUuid(id)) return null;
      try {
        const text = await readFile(path.join(root, `${id}.json`), "utf8");
        return JSON.parse(text) as ConversationRecord;
      } catch {
        return null;
      }
    },
    async save(record) {
      if (!isUuid(record.id)) {
        throw new Error("Refusing to store a conversation with an invalid id.");
      }
      await mkdir(root, { recursive: true });
      const destination = path.join(root, `${record.id}.json`);
      const temporary = path.join(root, `${record.id}.${randomUUID()}.tmp`);
      await writeFile(temporary, JSON.stringify(record), "utf8");
      await rename(temporary, destination);
    },
  };
}
