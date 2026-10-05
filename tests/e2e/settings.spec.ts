import { expect, test } from "@playwright/test";

import { expectNoPageOverflow, ORIGIN, sendFollowUp } from "./helpers";

test("routing and learning preferences persist, unavailable providers stop, and fallback requires an explicit choice", async ({ page }) => {
  await page.route("**/api/routing", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "Synthetic routing settings could not be loaded." } }) });
  });
  await page.goto("/settings");
  await expect(page.getByRole("alert").filter({ hasText: "Synthetic routing settings could not be loaded." })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Auto routing", exact: true })).toHaveCount(0);
  await page.unroute("**/api/routing");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  const auto = page.getByRole("checkbox", { name: "Auto routing", exact: true });
  const fallback = page.getByRole("checkbox", { name: "If the chosen provider fails, use CLEAR Free and say so", exact: true });
  const memory = page.getByRole("checkbox", { name: "Remember what I am learning", exact: true });
  await expect(auto).toBeEnabled();
  await expect(fallback).not.toBeChecked();
  await expect(memory).not.toBeChecked();
  // This setting reflects the saved server response rather than an optimistic local toggle.
  await expect(memory).toBeEnabled();
  await memory.click();
  await expect(memory).toBeChecked();
  await expect(memory).toBeEnabled();
  await auto.check();
  await page.getByRole("combobox", { name: "Coding provider", exact: true }).selectOption("clear-free");
  await page.getByRole("button", { name: "Save routing", exact: true }).click();
  await expect(page.getByText("Routing saved for this browser.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(auto).toBeChecked();
  await expect(fallback).not.toBeChecked();
  await expect(memory).toBeChecked();
  await expect(page.getByRole("combobox", { name: "Coding provider", exact: true })).toHaveValue("clear-free");
  const stopped = await page.request.post("/api/explanations", {
    headers: { Origin: ORIGIN },
    data: { question: "Explain a synthetic counter", provider: "openai", model: "synthetic-unconnected", level: "student", depth: "balanced" },
  });
  expect(stopped.status()).toBe(400);
  const failure = await stopped.json();
  expect(failure.conversationId).toBeUndefined();
  expect(failure.error.code).toBe("provider_not_configured");
  expect(failure.error.message).toContain("Fallback is off");

  await fallback.check();
  await page.getByRole("button", { name: "Save routing", exact: true }).click();
  await expect(page.getByText("Routing saved for this browser.", { exact: true })).toBeVisible();
  const resumed = await page.request.post("/api/explanations", {
    headers: { Origin: ORIGIN },
    data: { question: "Explain a synthetic counter", provider: "openai", model: "synthetic-unconnected", level: "student", depth: "balanced" },
  });
  expect(resumed.status()).toBe(200);
  const created = await resumed.json();
  await page.goto(`/learn/${created.conversationId}`);
  await expect(page.getByText("The requested provider was not available. Fallback is on, so this lesson used CLEAR Free.", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Provider for the next turn", exact: true })).toHaveValue("same");
  const update = await sendFollowUp(page, "Keep the current synthetic model for this follow-up.");
  expect(update.activeProvider).toBe("mock");
  expect(update.activeModel).toBe("clear-mock");
  await page.goto("/settings");
  await expect(fallback).toBeChecked();
  await expect(memory).toBeEnabled();
  await memory.click();
  await expect(memory).not.toBeChecked();
  await expect(memory).toBeEnabled();
  await page.reload();
  await expect(memory).not.toBeChecked();
  await expectNoPageOverflow(page);
});

test("two synthetic model results can be compared, rated, and selected before continuing the lesson", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "What are you trying to understand?", exact: true }).fill("Explain this synthetic comparison of a counter.");
  await page.locator("summary").filter({ hasText: "Explanation preferences" }).click();
  await page.getByRole("combobox", { name: "Explanation provider", exact: true }).selectOption("clear-free");
  await page.getByRole("combobox", { name: "CLEAR Free model", exact: true }).selectOption("gemini-2.5-flash");
  await page.getByRole("checkbox", { name: "Compare with another model", exact: true }).check();
  await page.getByRole("combobox", { name: "Comparison provider", exact: true }).selectOption("clear-free");
  await page.getByRole("combobox", { name: "Comparison CLEAR Free model", exact: true }).selectOption("gemini-3.5-flash");
  await page.getByRole("button", { name: "Help me understand", exact: true }).click();
  await expect(page).toHaveURL(/\/learn\/[a-f0-9-]{36}$/);
  await expect(page.getByRole("heading", { name: "Compare", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Use this version", exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Clearer", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Clearer · saved", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Use this version", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Compare", exact: true })).toHaveCount(0);
  await sendFollowUp(page, "Continue the selected synthetic comparison result.");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Compare", exact: true })).toHaveCount(0);
  await expect(page.getByRole("listitem").filter({ hasText: "Continue the selected synthetic comparison result." })).toBeVisible();
  await expectNoPageOverflow(page);
});
