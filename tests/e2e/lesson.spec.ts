import { expect, test } from "@playwright/test";

import { expectNoPageOverflow, MUTEX_ESSENCE, MUTEX_TITLE, openSample, sendFollowUp } from "./helpers";

test("a guest explores one lesson, checks recall, teaches it back, and keeps a follow-up after reload", async ({ page }) => {
  const id = await openSample(page);
  await expect(page.getByRole("tabpanel")).toContainText(MUTEX_ESSENCE);
  const first = page.getByRole("tab", { name: "Understand", exact: true });
  await first.focus();
  await first.press("ArrowRight");
  const mental = page.getByRole("tab", { name: "Mental Model", exact: true });
  await expect(mental).toBeFocused();
  await expect(mental).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toContainText("Only the thread that holds the lock");

  await page.getByRole("tab", { name: "Examples", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A shared counter", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Deep Dive", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Two mutexes, one variable", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Verify", exact: true }).click();
  await expect(page.getByRole("tabpanel").getByRole("status")).toContainText("External verification was not performed. This lesson is a conceptual explanation.");

  await page.getByRole("tab", { name: "Visual", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Thread B's lock request waits");
  await page.getByRole("tab", { name: "Interactive", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A requests the lock", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A updates shared state", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A requests the lock", exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Quiz", exact: true }).click();
  await page.getByRole("radio", { name: "No. They must coordinate with the same synchronization protocol.", exact: true }).check();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByRole("tabpanel").getByRole("status")).toContainText("Correct.");

  await page.getByRole("tab", { name: "Teach it back", exact: true }).click();
  await page.getByRole("textbox", { name: "Teach it back", exact: true }).fill("A mutex lets one thread own the lock before entering the critical section. Other threads wait before changing shared state.");
  await page.getByRole("button", { name: "Check my explanation", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Repaired explanation", exact: true })).toBeVisible();
  await expect(page.getByRole("tabpanel")).toContainText(MUTEX_ESSENCE);

  await page.getByRole("tab", { name: "Understand", exact: true }).click();
  const followup = "Show me why two different locks cannot protect the same counter.";
  const update = await sendFollowUp(page, followup);
  expect(update.activeProvider).toBe("mock");
  expect(update.activeModel).toBe("clear-mock");
  expect(update.document.topic).toBe(MUTEX_TITLE);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/learn/${id}$`));
  await expect(page.getByRole("heading", { name: MUTEX_TITLE, exact: true })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: followup })).toBeVisible();
  await page.getByRole("tab", { name: "Voice Tutor", exact: true }).click();
  await expect(page.getByText(followup, { exact: true })).toBeVisible();
  await expectNoPageOverflow(page);
});

test("a failed request retains the question and offers an explicit retry", async ({ page }) => {
  await page.goto("/");
  const question = "Explain a synthetic counter without losing my draft.";
  await page.getByRole("textbox", { name: "What are you trying to understand?", exact: true }).fill(question);
  await page.route("**/api/explanations", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "The synthetic provider is unavailable. Try again.", retryable: true } }) });
  });
  await page.getByRole("button", { name: "Help me understand", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "The synthetic provider is unavailable." })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "What are you trying to understand?", exact: true })).toHaveValue(question);
  await page.unroute("**/api/explanations");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page).toHaveURL(/\/learn\/[a-f0-9-]{36}$/);
  await expect(page.getByRole("heading", { name: question, exact: true })).toBeVisible();
  await expectNoPageOverflow(page);
});
