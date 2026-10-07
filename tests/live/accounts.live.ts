import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { expectNoPageOverflow, LESSON_URL, LIVE_URL, openSample, SAMPLE_TITLE } from "./support";

// Signed-in checks with two real accounts. The owner runs this; the passwords stay in
// `.env.live.local` or the shell and are never printed, traced or committed.
const first = { email: process.env.CLEAR_LIVE_EMAIL_A ?? "", password: process.env.CLEAR_LIVE_PASSWORD_A ?? "" };
const second = { email: process.env.CLEAR_LIVE_EMAIL_B ?? "", password: process.env.CLEAR_LIVE_PASSWORD_B ?? "" };
const configured = Boolean(first.email && first.password && second.email && second.password);

type Account = typeof first;

async function fillCredentials(page: Page, account: Account, password = account.password) {
  await page.goto("/auth");
  await expect(page.getByLabel("Email address", { exact: true })).toBeEnabled();
  await page.getByLabel("Email address", { exact: true }).fill(account.email);
  // Playwright prints a failed action's arguments. Never let a password reach that log.
  await page.getByLabel("Password", { exact: true }).fill(password).catch(() => {
    throw new Error("The password field could not be filled.");
  });
  await page.locator('form button[type="submit"]').click();
}

async function signIn(page: Page, account: Account) {
  await fillCredentials(page, account);
  await expect(page, "Signing in should open the library. An alert on the page says why it did not.").toHaveURL(/\/library$/, { timeout: 45_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Your library", exact: true })).toBeVisible();
}

async function newSession(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: LIVE_URL, reducedMotion: "reduce" });
  return { context, page: await context.newPage() };
}

const card = (page: Page, id: string) => page.getByRole("listitem").filter({ has: page.locator(`a[href="/learn/${id}"]`) });

test("two accounts keep separate libraries across devices, and sharing crosses between them", async ({ page, browser }) => {
  test.skip(!configured, "Set CLEAR_LIVE_EMAIL_A, CLEAR_LIVE_PASSWORD_A, CLEAR_LIVE_EMAIL_B and CLEAR_LIVE_PASSWORD_B (see tests/live/README.md).");
  expect(first.email, "Use two different accounts.").not.toBe(second.email);
  const title = `Live check ${new Date().toISOString().slice(0, 19).replace("T", " ")}`;
  const sessions: BrowserContext[] = [];
  let id = "";

  try {
    await test.step("a wrong password is refused", async () => {
      await fillCredentials(page, first, `${first.password}-wrong`);
      await expect(page.getByRole("alert").filter({ hasText: /email or password was not accepted/i })).toBeVisible();
      await expect(page).toHaveURL(/\/auth$/);
    });

    await test.step("the first account signs in and saves a lesson", async () => {
      await signIn(page, first);
      id = await openSample(page);
      await page.goto("/library");
      await expect(card(page, id).getByRole("link", { name: SAMPLE_TITLE, exact: true })).toBeVisible();
    });

    await test.step("the library can favourite, rename, search, archive and restore", async () => {
      await card(page, id).getByRole("button", { name: "Favorite", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Your library is updated." })).toBeVisible();
      await card(page, id).getByRole("button", { name: "Rename", exact: true }).click();
      await page.getByLabel("Lesson title", { exact: true }).fill(title);
      await page.getByRole("button", { name: "Save title", exact: true }).click();
      await expect(card(page, id).getByRole("link", { name: title, exact: true })).toBeVisible();
      await page.locator("#library-search").fill(title);
      await expect(page.locator('ul > li a[href^="/learn/"]')).toHaveCount(1);
      await page.locator("#library-search").fill("");
      await page.locator("#library-view").selectOption("favorites");
      await expect(card(page, id)).toBeVisible();
      await card(page, id).getByRole("button", { name: "Archive", exact: true }).click();
      await page.locator("#library-view").selectOption("recent");
      await expect(card(page, id)).toHaveCount(0);
      await page.locator("#library-view").selectOption("archived");
      await card(page, id).getByRole("button", { name: "Restore", exact: true }).click();
      await page.locator("#library-view").selectOption("recent");
      await expect(card(page, id)).toBeVisible();
      await expectNoPageOverflow(page);
    });

    await test.step("the same account sees the lesson on another device", async () => {
      const device = await newSession(browser);
      sessions.push(device.context);
      await signIn(device.page, first);
      await expect(card(device.page, id).getByRole("link", { name: title, exact: true })).toBeVisible();
      await device.page.goto(`/learn/${id}`);
      await expect(device.page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(device.page).toHaveURL(LESSON_URL);
    });

    let link = "";
    await test.step("the first account shares the lesson", async () => {
      await page.goto(`/learn/${id}`);
      await page.locator("summary").filter({ hasText: "Share & export" }).click();
      await page.getByRole("button", { name: "Create share link", exact: true }).click();
      const input = page.getByRole("textbox", { name: "Public share link", exact: true });
      await expect(input).toHaveValue(new RegExp(`^${LIVE_URL}/shared/`));
      link = await input.inputValue();
    });

    await test.step("the second account cannot see or change it, but can read the shared copy", async () => {
      const other = await newSession(browser);
      sessions.push(other.context);
      await signIn(other.page, second);
      await expect(card(other.page, id)).toHaveCount(0);
      await other.page.goto(`/learn/${id}`);
      await expect(other.page.getByRole("heading", { name: "That page is not here.", exact: true })).toBeVisible();
      for (const denied of await Promise.all([
        other.context.request.post(`/api/explanations/${id}/follow-up`, { headers: { Origin: LIVE_URL }, data: { message: "Another account's follow-up" } }),
        other.context.request.get(`/api/explanations/${id}/export?format=json`),
        other.context.request.delete(`/api/auth/library/${id}`, { headers: { Origin: LIVE_URL } }),
      ])) expect(denied.status()).toBe(404);
      await other.page.goto(link);
      await expect(other.page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(other.page.getByRole("textbox", { name: "Ask a follow-up", exact: true })).toHaveCount(0);
    });

    await test.step("signing out returns this browser to a guest", async () => {
      await page.goto("/auth");
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
      await page.goto("/library");
      await expect(page.getByRole("heading", { name: "Sign in to find your saved lessons", exact: true })).toBeVisible();
      await page.goto(`/learn/${id}`);
      await expect(page.getByRole("heading", { name: "That page is not here.", exact: true })).toBeVisible();
    });

    await test.step("deleting the lesson removes it and its share link", async () => {
      await signIn(page, first);
      await card(page, id).getByRole("button", { name: "Delete", exact: true }).click();
      await card(page, id).getByRole("button", { name: "Delete this lesson", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: /deleted/i })).toBeVisible();
      await expect(card(page, id)).toHaveCount(0);
      id = "";
      await page.goto(link);
      await expect(page.getByRole("heading", { name: "This link is unavailable", exact: true })).toBeVisible();
    });
  } finally {
    // Leave no test lesson behind if a step failed part-way.
    if (id) await page.request.delete(`/api/auth/library/${id}`, { headers: { Origin: LIVE_URL } }).catch(() => undefined);
    await Promise.all(sessions.map((context) => context.close()));
  }
});
