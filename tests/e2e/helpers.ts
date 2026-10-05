import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const ORIGIN = "https://localhost:3100";
export const MUTEX_TITLE = "How a mutex prevents a race condition";
export const MUTEX_ESSENCE = "A mutex lets only one thread at a time enter a protected critical section.";

export async function openSample(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "See an example", exact: true }).click();
  await expect(page).toHaveURL(/\/learn\/[a-f0-9-]{36}$/);
  await expect(page.getByRole("heading", { name: MUTEX_TITLE, exact: true })).toBeVisible();
  return new URL(page.url()).pathname.split("/").at(-1)!;
}

export async function openSharing(page: Page) {
  await page.locator("summary").filter({ hasText: "Share & export" }).click();
  await expect(page.getByRole("button", { name: "Create share link", exact: true })).toBeEnabled();
}

export async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content, "The page should fit the viewport; tab lists may scroll inside their own container.").toBeLessThanOrEqual(dimensions.viewport + 1);
}

export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

export async function sendFollowUp(page: Page, message: string) {
  await page.getByRole("textbox", { name: "Ask a follow-up", exact: true }).fill(message);
  const response = page.waitForResponse((result) => result.url().endsWith("/follow-up") && result.request().method() === "POST");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const result = await response;
  expect(result.status()).toBe(200);
  await expect(page.getByRole("listitem").filter({ hasText: message })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Local mock: I kept the existing lesson. No model reviewed or answered this follow-up." })).toBeVisible();
  return result.json();
}
