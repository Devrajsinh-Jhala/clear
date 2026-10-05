import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ account: null as { id: string } | null }));
vi.mock("@/src/lib/auth/session", () => ({ currentAccount: async () => auth.account }));
vi.mock("@/src/lib/storage/admin", () => ({ storageAdmin: () => null }));
import { deletePrivateState, readPrivateState, writePrivateState } from "@/src/lib/storage/state";

let directory: string;
const key = "11111111-1111-4111-8111-111111111111";
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "clear-private-state-"));
  vi.stubEnv("CLEAR_DATA_DIR", directory);
  vi.stubEnv("VERCEL", "");
  auth.account = null;
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });
describe("durable private state boundaries", () => {
  it("keeps account keys inaccessible to a guest who knows the learner identifier", async () => {
    auth.account = { id: "22222222-2222-4222-8222-222222222222" };
    await writePrivateState("credentials", `${key}/openai`, { ciphertext: "synthetic-ciphertext" });
    await expect(readPrivateState("credentials", `${key}/openai`)).resolves.toEqual({ ciphertext: "synthetic-ciphertext" });
    auth.account = null;
    await expect(readPrivateState("credentials", `${key}/openai`)).resolves.toBeNull();
    auth.account = { id: "33333333-3333-4333-8333-333333333333" };
    await expect(readPrivateState("credentials", `${key}/openai`)).resolves.toBeNull();
  });
  it("retains independent provider connections and deletes only the selected one", async () => {
    await Promise.all([writePrivateState("credentials", `${key}/gemini`, { value: "one" }), writePrivateState("credentials", `${key}/openai`, { value: "two" })]);
    await deletePrivateState("credentials", `${key}/gemini`);
    await expect(readPrivateState("credentials", `${key}/gemini`)).resolves.toBeNull();
    await expect(readPrivateState("credentials", `${key}/openai`)).resolves.toEqual({ value: "two" });
  });
  it("refuses local fallback on Vercel and unsafe storage paths", async () => {
    vi.stubEnv("VERCEL", "1");
    await expect(writePrivateState("learning", key, {})).rejects.toThrow("Configure Supabase");
    await expect(readPrivateState("credentials", "../secrets")).rejects.toThrow("Invalid private storage key");
  });
});
