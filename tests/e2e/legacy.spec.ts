import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { MUTEX_FIXTURE } from "../../src/lib/explanation/fixtures/mutex";
import { expectNoPageOverflow, MUTEX_TITLE, ORIGIN, sendFollowUp } from "./helpers";

test("an earlier ownerless URL stays read-only and its private copy retains the first follow-up in both transcripts", async ({ page }) => {
  const root = path.resolve(process.env.CLEAR_E2E_DATA_DIR ?? "");
  if (path.dirname(root) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith("clear-e2e-")) throw new Error("Legacy fixtures must use this test run's isolated storage.");
  const id = randomUUID();
  const now = new Date().toISOString();
  const record = {
    id,
    title: MUTEX_TITLE,
    createdAt: now,
    updatedAt: now,
    activeProvider: "byok:openai",
    activeModel: "synthetic-previous-owner-model",
    level: "engineer",
    depth: "balanced",
    document: { ...structuredClone(MUTEX_FIXTURE), id },
    messages: [{ id: randomUUID(), role: "user", content: "SYNTHETIC_OLD_PRIVATE_MESSAGE", createdAt: now }],
    attachments: [{ id: randomUUID(), filename: "synthetic-old-private-upload.pdf", mimeType: "application/pdf" }],
  };
  await mkdir(path.join(root, "conversations"), { recursive: true });
  await writeFile(path.join(root, "conversations", `${id}.json`), JSON.stringify(record), "utf8");
  await page.goto(`/learn/${id}`);
  await expect(page.getByRole("heading", { name: "Keep learning in a private copy", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: MUTEX_TITLE, exact: true })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(8);
  await expect(page.getByRole("textbox", { name: "Ask a follow-up", exact: true })).toHaveCount(0);
  expect((await page.request.post(`/api/explanations/${id}/follow-up`, { headers: { Origin: ORIGIN }, data: { message: "Never claim the old owner" } })).status()).toBe(404);
  await page.getByRole("button", { name: "Make a private copy", exact: true }).click();
  await expect(page).toHaveURL(/\/learn\/[a-f0-9-]{36}$/);
  await expect(page).not.toHaveURL(new RegExp(`/learn/${id}$`));
  await expect(page.getByText(/Private copy · Follow-ups:.*CLEAR Free/)).toBeVisible();
  await expect(page.getByText("SYNTHETIC_OLD_PRIVATE_MESSAGE", { exact: false })).toHaveCount(0);
  await expect(page.getByText("synthetic-old-private-upload.pdf", { exact: false })).toHaveCount(0);
  const firstFollowup = "My first private-copy follow-up remains visible.";
  await sendFollowUp(page, firstFollowup);
  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: firstFollowup })).toBeVisible();
  await page.getByRole("tab", { name: "Voice Tutor", exact: true }).click();
  await expect(page.getByText(firstFollowup, { exact: true })).toBeVisible();
  await expectNoPageOverflow(page);
});
