import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { expectNoPageOverflow, MUTEX_ESSENCE, MUTEX_TITLE, openSample, openSharing, ORIGIN, sendFollowUp } from "./helpers";

test("private ownership, frozen public snapshots, replacement, revocation, and real downloads remain consistent", async ({ page, browser }, testInfo) => {
  const id = await openSample(page);
  await openSharing(page);
  await page.getByRole("button", { name: "Preview the shared explanation", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Preview before sharing", exact: true });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole("heading", { name: MUTEX_TITLE, exact: true })).toBeVisible();
  const beforePublish = await page.request.get(`/api/explanations/${id}/share`);
  expect(beforePublish.ok()).toBe(true);
  expect((await beforePublish.json()).share.active).toBe(false);
  await preview.getByRole("tab", { name: "Understand", exact: true }).focus();
  await preview.getByRole("tab", { name: "Understand", exact: true }).press("End");
  await expect(preview.getByRole("tab", { name: "Quiz", exact: true })).toBeFocused();
  await preview.press("Escape");
  await expect(preview).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Preview the shared explanation", exact: true })).toBeFocused();

  const outsider = await browser.newContext({ baseURL: ORIGIN, ignoreHTTPSErrors: true });
  try {
    const foreignPage = await outsider.newPage();
    await foreignPage.goto(`/learn/${id}`);
    await expect(foreignPage.getByRole("heading", { name: "That page is not here.", exact: true })).toBeVisible();
    await expect(foreignPage.getByRole("heading", { name: MUTEX_TITLE, exact: true })).toHaveCount(0);
    const deniedRequests = [
      outsider.request.get(`/api/explanations/${id}/share`),
      outsider.request.get(`/api/explanations/${id}/export?format=json`),
      outsider.request.post(`/api/explanations/${id}/follow-up`, { headers: { Origin: ORIGIN }, data: { message: "Unauthorized synthetic follow-up" } }),
      outsider.request.post(`/api/explanations/${id}/teach-back`, { headers: { Origin: ORIGIN }, data: { explanation: "Unauthorized synthetic explanation" } }),
      outsider.request.post(`/api/explanations/${id}/share`, { headers: { Origin: ORIGIN }, data: { showProvider: false } }),
      outsider.request.delete(`/api/explanations/${id}/share`, { headers: { Origin: ORIGIN } }),
    ];
    for (const result of await Promise.all(deniedRequests)) {
      expect(result.status()).toBe(404);
      expect(await result.text()).not.toContain(MUTEX_ESSENCE);
    }

    for (const format of ["markdown", "json", "pdf"] as const) {
      const label = format === "markdown" ? "Markdown" : format.toUpperCase();
      const downloadEvent = page.waitForEvent("download");
      await page.getByRole("button", { name: label, exact: true }).click();
      const download = await downloadEvent;
      expect(await download.failure()).toBeNull();
      const output = testInfo.outputPath(download.suggestedFilename());
      await download.saveAs(output);
      const content = await readFile(output);
      expect(content.byteLength).toBeGreaterThan(200);
      if (format === "pdf") expect(content.subarray(0, 5).toString()).toBe("%PDF-");
      else if (format === "markdown") expect(content.toString()).toContain(MUTEX_ESSENCE);
      else {
        const document = JSON.parse(content.toString());
        expect(document.id).toBe("clear-export");
        expect(document.metadata.provider).toBe("hidden");
        expect(document.audience.assumedKnowledge).toEqual([]);
        expect(document.essence).toBe(MUTEX_ESSENCE);
        expect(content.toString()).not.toContain(id);
        expect(content.toString()).not.toMatch(/ownerLearnerId|ownerUserId|apiKey|messages|attachments/);
      }
      await expect(page.getByRole("status").filter({ hasText: `${label} is ready.` })).toBeVisible();
    }

    await page.getByRole("button", { name: "Create share link", exact: true }).click();
    const linkInput = page.getByRole("textbox", { name: "Public share link", exact: true });
    await expect(linkInput).toHaveValue(new RegExp(`^${ORIGIN}/shared/[A-Za-z0-9_-]{32}$`));
    const initialLink = await linkInput.inputValue();
    const slug = new URL(initialLink).pathname.split("/").at(-1)!;
    await foreignPage.goto(initialLink);
    await expect(foreignPage.getByRole("heading", { name: MUTEX_TITLE, exact: true })).toBeVisible();
    await expect(foreignPage.getByRole("tab")).toHaveCount(8);
    await expect(foreignPage.getByRole("tab", { name: "Teach it back", exact: true })).toHaveCount(0);
    await expect(foreignPage.getByRole("textbox", { name: "Ask a follow-up", exact: true })).toHaveCount(0);
    await expect(foreignPage.getByText(/Explanation model:/)).toHaveCount(0);
    await foreignPage.getByRole("tab", { name: "Interactive", exact: true }).click();
    await foreignPage.getByRole("button", { name: "Next", exact: true }).click();
    await expect(foreignPage.getByRole("heading", { name: "A updates shared state", exact: true })).toBeVisible();
    await foreignPage.getByRole("tab", { name: "Quiz", exact: true }).click();
    await foreignPage.getByRole("radio", { name: "No. They must coordinate with the same synchronization protocol.", exact: true }).check();
    await foreignPage.getByRole("button", { name: "Check", exact: true }).click();
    await expect(foreignPage.getByRole("tabpanel").getByRole("status")).toContainText("Correct.");
    const initialJsonResponse = await outsider.request.get(`/api/shared/${slug}/export?format=json&includeProvider=true`);
    expect(initialJsonResponse.status()).toBe(200);
    expect(initialJsonResponse.headers()["cache-control"]).toContain("no-store");
    const initialJson = await initialJsonResponse.json();
    expect(initialJson.metadata.provider).toBe("hidden");

    await sendFollowUp(page, "This synthetic private follow-up must never appear in the frozen share.");
    await expect(page.getByText("This lesson has changed since you shared it.", { exact: false })).toBeVisible();
    expect(await (await outsider.request.get(`/api/shared/${slug}/export?format=json`)).json()).toEqual(initialJson);
    await page.getByRole("checkbox", { name: "Show the provider and model on the shared page", exact: true }).check();
    await page.getByRole("button", { name: "Replace link with current lesson", exact: true }).click();
    await expect(linkInput).not.toHaveValue(initialLink);
    const replacementLink = await linkInput.inputValue();
    const replacementSlug = new URL(replacementLink).pathname.split("/").at(-1)!;
    for (const format of ["markdown", "json", "pdf"]) expect((await outsider.request.get(`/api/shared/${slug}/export?format=${format}`)).status()).toBe(404);
    await foreignPage.goto(initialLink);
    await expect(foreignPage.getByRole("heading", { name: "This link is unavailable", exact: true })).toBeVisible();
    await foreignPage.goto(replacementLink);
    await expect(foreignPage.getByText(/Explanation model:.*clear-mock/)).toBeVisible();
    for (const format of ["markdown", "json", "pdf"]) {
      const result = await outsider.request.get(`/api/shared/${replacementSlug}/export?format=${format}`);
      expect(result.status()).toBe(200);
      expect((await result.body()).byteLength).toBeGreaterThan(200);
    }
    await page.getByRole("button", { name: "Revoke link", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "No public link." })).toBeVisible();
    for (const format of ["markdown", "json", "pdf"]) expect((await outsider.request.get(`/api/shared/${replacementSlug}/export?format=${format}`)).status()).toBe(404);
    await foreignPage.goto(replacementLink);
    await expect(foreignPage.getByRole("heading", { name: "This link is unavailable", exact: true })).toBeVisible();
    await expectNoPageOverflow(page);
  } finally {
    await outsider.close();
  }
});
