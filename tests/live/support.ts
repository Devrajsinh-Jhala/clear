import { expect, type Page } from "@playwright/test";

export const LIVE_URL = (process.env.CLEAR_LIVE_URL ?? "https://clear-explainer.vercel.app").replace(/\/+$/, "");
export const SAMPLE_TITLE = "How a mutex prevents a race condition";
export const LESSON_URL = /\/learn\/[a-f0-9-]{36}$/;
export const VIEWS = ["Understand", "Mental Model", "Visual", "Interactive", "Examples", "Deep Dive", "Verify", "Quiz", "Teach it back", "Voice Tutor"];

/** Collects script errors and blocked resources, which is how a broken security policy shows up. */
export function watchPage(page: Page): string[] {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`script error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });
  return problems;
}

export async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "The page should fit the viewport.").toBeLessThanOrEqual(1);
}

/** Opens the built-in mutex lesson. It makes no model call. */
export async function openSample(page: Page): Promise<string> {
  await page.goto("/ask");
  await page.getByRole("button", { name: "See an example", exact: true }).click();
  await expect(page).toHaveURL(LESSON_URL, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: SAMPLE_TITLE, exact: true })).toBeVisible();
  return lessonId(page);
}

export function lessonId(page: Page): string {
  return new URL(page.url()).pathname.split("/").at(-1)!;
}

/** Asks a real question and waits for the lesson. One or two model calls. */
export async function ask(page: Page, question: string): Promise<string> {
  await page.getByRole("textbox", { name: "What are you trying to understand?", exact: true }).fill(question);
  await page.getByRole("button", { name: "Help me understand", exact: true }).click();
  await expect(page, "The lesson should open. An alert on the page says why it did not.").toHaveURL(LESSON_URL, { timeout: 200_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return lessonId(page);
}
