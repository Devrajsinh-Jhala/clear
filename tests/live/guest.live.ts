import { readFile } from "node:fs/promises";

import { devices, expect, test } from "@playwright/test";
import { unzipSync } from "fflate";

import { ask, expectNoPageOverflow, LESSON_URL, LIVE_URL, openSample, SAMPLE_TITLE, VIEWS, watchPage } from "./support";

// Everything a visitor can do without an account, on the deployed site.

test("public pages load with a working security policy", async ({ page, request }) => {
  const problems = watchPage(page);
  const home = await page.goto("/");
  expect(home?.status()).toBe(200);
  const headers = home!.headers();
  expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-/);
  expect(headers["strict-transport-security"]).toContain("max-age");
  expect(headers["x-frame-options"]).toBe("DENY");
  await expect(page.getByRole("heading", { level: 1, name: "Understand anything.", exact: true })).toBeVisible();
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", new RegExp(`^${LIVE_URL}/?$`));
  await page.getByRole("button", { name: "Is CLEAR free?", exact: true }).click();
  await expect(page.getByText("CLEAR Free runs on Google Gemini with a daily allowance")).toBeVisible();
  await expect(page.getByRole("link", { name: /Buy me a chai/ }).first()).toHaveAttribute("href", /^https:\/\/buymeachai\.ezee\.li\//);

  for (const path of ["/ask", "/about", "/privacy", "/terms", "/skill", "/settings", "/progress", "/library", "/auth"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }), path).toBeVisible();
    await expectNoPageOverflow(page);
  }

  const health = await request.get("/api/health");
  expect(await health.json()).toEqual({ ready: true });
  expect((await request.get("/opengraph-image")).headers()["content-type"]).toContain("image/png");
  expect(problems, "No script errors or blocked resources on public pages.").toEqual([]);
});

test.describe("on a phone", () => {
  const { defaultBrowserType: _browser, ...phone } = devices["Pixel 7"];
  void _browser;
  test.use(phone);

  test("the menu, the landing page and a lesson fit a small screen", async ({ page }) => {
    const problems = watchPage(page);
    await page.goto("/");
    await expectNoPageOverflow(page);
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    const menu = page.getByRole("dialog", { name: "Menu", exact: true });
    await menu.getByRole("link", { name: "Ask", exact: true }).click();
    await expect(page).toHaveURL(/\/ask$/);
    await openSample(page);
    await expectNoPageOverflow(page);
    await page.getByRole("tab", { name: "Quiz", exact: true }).click();
    await expect(page.getByRole("tabpanel")).toBeVisible();
    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });
});

test("a guest asks a real question, explores every view, follows up and teaches it back", async ({ page }) => {
  const problems = watchPage(page);
  await page.goto("/ask");
  const id = await ask(page, "Why does ice float on water?");
  await expect(page.getByText(/CLEAR Free · Gemini/).first()).toBeVisible();

  for (const view of VIEWS) {
    await page.getByRole("tab", { name: view, exact: true }).click();
    const panel = page.getByRole("tabpanel");
    await expect(panel, view).toBeVisible();
    await expect(panel, `${view} should finish drawing`).not.toContainText("Drawing the diagram…", { timeout: 45_000 });
    expect((await panel.innerText()).trim().length, `${view} should have content`).toBeGreaterThan(20);
    await expect(panel, view).not.toContainText("could not be drawn");
  }

  await page.getByRole("tab", { name: "Quiz", exact: true }).click();
  const choices = page.getByRole("tabpanel").getByRole("radio");
  if (await choices.count()) {
    await choices.first().check();
    await page.getByRole("tabpanel").getByRole("button", { name: "Check", exact: true }).first().click();
    await expect(page.getByRole("tabpanel").getByRole("status").first()).toBeVisible();
  }

  await page.getByRole("tab", { name: "Teach it back", exact: true }).click();
  await page.getByRole("textbox", { name: "Teach it back", exact: true }).fill("Water molecules lock into an open pattern when they freeze, so ice takes up more space than the same water and is less dense. Less dense things float.");
  const reviewed = page.waitForResponse((response) => response.url().endsWith("/teach-back") && response.request().method() === "POST", { timeout: 200_000 });
  await page.getByRole("button", { name: "Check my explanation", exact: true }).click();
  expect((await reviewed).status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Repaired explanation", exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Understand", exact: true }).click();
  const followUp = "Does salt water change this?";
  await page.getByRole("textbox", { name: "Ask a follow-up", exact: true }).fill(followUp);
  const updated = page.waitForResponse((response) => response.url().endsWith("/follow-up") && response.request().method() === "POST", { timeout: 200_000 });
  await page.getByRole("button", { name: "Send", exact: true }).click();
  expect((await updated).status()).toBe(200);
  await expect(page.getByRole("listitem").filter({ hasText: followUp })).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/learn/${id}$`));
  await expect(page.getByRole("listitem").filter({ hasText: followUp })).toBeVisible();
  await expectNoPageOverflow(page);
  expect(problems).toEqual([]);
});

test("a lesson can be downloaded, shared, opened by a stranger and revoked", async ({ page, browser }, testInfo) => {
  const id = await openSample(page);
  await page.locator("summary").filter({ hasText: "Share & export" }).click();
  await expect(page.getByRole("button", { name: "Create share link", exact: true })).toBeEnabled();

  for (const [label, check] of [["Markdown", (content: Buffer) => expect(content.toString()).toContain("mutex")], ["JSON", (content: Buffer) => expect(JSON.parse(content.toString()).metadata.provider).toBe("hidden")], ["PDF", (content: Buffer) => expect(content.subarray(0, 5).toString()).toBe("%PDF-")]] as const) {
    const started = page.waitForEvent("download");
    await page.getByRole("button", { name: label, exact: true }).click();
    const download = await started;
    expect(await download.failure()).toBeNull();
    const file = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(file);
    const content = await readFile(file);
    expect(content.byteLength, label).toBeGreaterThan(200);
    expect(content.toString("latin1"), `${label} must not contain the private lesson id`).not.toContain(id);
    check(content);
  }

  await page.getByRole("button", { name: "Create share link", exact: true }).click();
  const linkInput = page.getByRole("textbox", { name: "Public share link", exact: true });
  await expect(linkInput).toHaveValue(new RegExp(`^${LIVE_URL}/shared/[A-Za-z0-9_-]{32}$`));
  const link = await linkInput.inputValue();
  const slug = new URL(link).pathname.split("/").at(-1)!;

  const stranger = await browser.newContext({ baseURL: LIVE_URL });
  try {
    const other = await stranger.newPage();
    await other.goto(`/learn/${id}`);
    await expect(other.getByRole("heading", { name: "That page is not here.", exact: true })).toBeVisible();
    for (const denied of await Promise.all([
      stranger.request.get(`/api/explanations/${id}/share`),
      stranger.request.get(`/api/explanations/${id}/export?format=json`),
      stranger.request.post(`/api/explanations/${id}/follow-up`, { headers: { Origin: LIVE_URL }, data: { message: "A stranger's follow-up" } }),
      stranger.request.post(`/api/explanations/${id}/share`, { headers: { Origin: LIVE_URL }, data: { showProvider: false } }),
      stranger.request.delete(`/api/explanations/${id}/share`, { headers: { Origin: LIVE_URL } }),
    ])) expect(denied.status()).toBe(404);

    await other.goto(link);
    await expect(other.getByRole("heading", { name: SAMPLE_TITLE, exact: true })).toBeVisible();
    await expect(other.getByRole("textbox", { name: "Ask a follow-up", exact: true })).toHaveCount(0);
    for (const format of ["markdown", "json", "pdf"]) expect((await stranger.request.get(`/api/shared/${slug}/export?format=${format}`)).status(), format).toBe(200);

    await page.getByRole("button", { name: "Revoke link", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "No public link." })).toBeVisible();
    await other.goto(link);
    await expect(other.getByRole("heading", { name: "This link is unavailable", exact: true })).toBeVisible();
    expect((await stranger.request.get(`/api/shared/${slug}/export?format=json`)).status()).toBe(404);
  } finally {
    await stranger.close();
  }
});

test("the portable skill downloads as seven files", async ({ page }, testInfo) => {
  await page.goto("/skill");
  const started = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CLEAR skill", exact: true }).click();
  const download = await started;
  const file = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(file);
  const names = Object.keys(unzipSync(new Uint8Array(await readFile(file)))).filter((name) => !name.endsWith("/"));
  expect(names).toHaveLength(7);
  expect(names).toContain("clear-explainer/SKILL.md");
});

test("settings are saved for this browser", async ({ page }) => {
  await page.goto("/settings");
  const memory = page.getByRole("checkbox", { name: "Remember what I am learning", exact: true });
  const auto = page.getByRole("checkbox", { name: "Auto routing", exact: true });
  await expect(memory).toBeEnabled();
  await expect(memory).not.toBeChecked();
  await memory.click();
  await expect(memory).toBeChecked();
  await auto.check();
  await page.getByRole("button", { name: "Save routing", exact: true }).click();
  await expect(page.getByText("Routing saved for this browser.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(memory).toBeChecked();
  await expect(auto).toBeChecked();
  await page.goto("/progress");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("a question can include an image or a PDF", async ({ page, context }) => {
  // Draw the two files in the browser so the repository needs no binary fixtures.
  const canvas = await context.newPage();
  await canvas.setViewportSize({ width: 900, height: 320 });
  await canvas.setContent('<body style="margin:0;font:600 34px sans-serif;display:flex;align-items:center;justify-content:center;height:320px;gap:28px"><span style="border:3px solid #111;padding:18px">Browser</span>→<span style="border:3px solid #111;padding:18px">Load balancer</span>→<span style="border:3px solid #111;padding:18px">Database</span></body>');
  const image = await canvas.screenshot({ type: "png" });
  await canvas.setContent('<body style="font:18px serif;padding:48px"><h1>Greenfield Library lending rules</h1><p>A member may borrow at most seven books at one time.</p><p>Each loan lasts twenty-one days and can be renewed once.</p></body>');
  const pdf = await canvas.pdf({ format: "A4" });
  await canvas.close();

  await page.goto("/ask");
  await page.getByRole("button", { name: "Add material", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "request-path.png", mimeType: "image/png", buffer: image });
  await expect(page.getByRole("button", { name: "1 attachment", exact: true })).toBeVisible();
  await ask(page, "Explain what this diagram shows and name each box.");
  await expect(page.getByText(/request-path\.png.*sent to the selected provider/)).toBeVisible();
  await expect(page.locator("main")).toContainText(/load balancer/i);

  await page.goto("/ask");
  await page.getByRole("button", { name: "Add material", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "lending-rules.pdf", mimeType: "application/pdf", buffer: pdf });
  await expect(page.getByRole("button", { name: "1 attachment", exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Whole document", exact: true })).toBeChecked();
  await ask(page, "Using the attached document, how many books may a member borrow and for how long?");
  await expect(page.getByText(/lending-rules\.pdf.*sent to the selected provider/)).toBeVisible();
  await expect(page.locator("main")).toContainText(/seven|\b7\b/i);
  await expect(page).toHaveURL(LESSON_URL);
});
