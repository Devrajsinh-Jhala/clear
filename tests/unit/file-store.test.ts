import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { MUTEX_FIXTURE } from "@/src/lib/explanation/fixtures/mutex";
import { createFileStore } from "@/src/lib/store/file-store";

describe("file store", () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  it("saves and reloads a lesson", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "clear-"));
    directories.push(root);
    const store = createFileStore(root);
    const record = {
      id: "11111111-1111-4111-8111-111111111111",
      title: MUTEX_FIXTURE.topic,
      createdAt: MUTEX_FIXTURE.metadata.generatedAt,
      updatedAt: MUTEX_FIXTURE.metadata.generatedAt,
      activeProvider: "sample",
      activeModel: "clear-example",
      level: "engineer" as const,
      depth: "balanced" as const,
      messages: [],
      document: MUTEX_FIXTURE,
    };
    await store.save(record);
    await expect(store.get(record.id)).resolves.toMatchObject({ title: record.title });
    await expect(store.get("../package")).resolves.toBeNull();
  });
});
