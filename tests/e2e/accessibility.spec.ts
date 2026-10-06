import { expect, test } from "@playwright/test";

import { expectAccessible, expectNoPageOverflow, MUTEX_TITLE, openSample, openSharing } from "./helpers";

for (const theme of ["light", "dark"] as const) {
  test(`${theme} core screens and shared keyboard navigation meet WCAG checks at 390 pixels`, async ({ page }, testInfo) => {
    // Thirteen full WCAG scans across the landing page, the app and a shared lesson.
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const chooser = page.getByRole("combobox", { name: "Color theme", exact: true });
    await expect(chooser).toBeEnabled();
    await chooser.selectOption(theme);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("theme"))).toBe(theme);
    await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
    await expect(page.getByRole("heading", { level: 1, name: "Understand anything.", exact: true })).toBeVisible();
    await expectNoPageOverflow(page);
    await expectAccessible(page);
    await page.getByRole("button", { name: "Is CLEAR free?", exact: true }).click();
    await expect(page.getByText("CLEAR Free runs on Google Gemini with a daily allowance")).toBeVisible();
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    const menu = page.getByRole("dialog", { name: "Menu", exact: true });
    await expect(menu.getByRole("link", { name: "Library", exact: true })).toBeVisible();
    await expectAccessible(page);
    await menu.getByRole("link", { name: "Ask", exact: true }).click();
    await expect(page).toHaveURL(/\/ask$/);
    await expect(page.getByRole("textbox", { name: "What are you trying to understand?", exact: true })).toBeVisible();
    await expectNoPageOverflow(page);
    await expectAccessible(page);
    await page.goto("/auth");
    await expect(page.getByRole("heading", { name: "Guest lessons are ready", exact: true })).toBeVisible();
    await expectNoPageOverflow(page);
    await expectAccessible(page);
    if (testInfo.project.name === "chromium") {
      const screenshot = testInfo.outputPath(`account-${theme}-390.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      await testInfo.attach(`Account · ${theme} · 390 pixels`, { path: screenshot, contentType: "image/png" });
    }
    await page.goto("/library");
    await expect(page.getByRole("heading", { name: "Keep learning as a guest", exact: true })).toBeVisible();
    await expectNoPageOverflow(page);
    await expectAccessible(page);
    if (testInfo.project.name === "chromium") {
      const screenshot = testInfo.outputPath(`library-${theme}-390.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      await testInfo.attach(`Library · ${theme} · 390 pixels`, { path: screenshot, contentType: "image/png" });
    }
    await page.goto("/settings");
    await expect(page.getByRole("checkbox", { name: "Auto routing", exact: true })).toBeEnabled();
    await expectNoPageOverflow(page);
    await expectAccessible(page);
    await page.goto("/skill");
    await expect(page.getByRole("combobox", { name: "Preview file", exact: true })).toBeVisible();
    await expectNoPageOverflow(page);
    await expectAccessible(page);
    await openSample(page);
    await expectNoPageOverflow(page);
    await expectAccessible(page);
    await page.getByRole("tab", { name: "Quiz", exact: true }).click();
    await expectAccessible(page);
    await openSharing(page);
    await page.getByRole("button", { name: "Preview the shared explanation", exact: true }).click();
    const preview = page.getByRole("dialog", { name: "Preview before sharing", exact: true });
    await expect(preview).toBeVisible();
    await expectAccessible(page);
    await preview.getByRole("tab", { name: "Understand", exact: true }).focus();
    await preview.getByRole("tab", { name: "Understand", exact: true }).press("ArrowRight");
    await expect(preview.getByRole("tab", { name: "Mental Model", exact: true })).toBeFocused();
    await preview.press("Escape");
    await expect(preview).not.toBeVisible();
    await page.getByRole("button", { name: "Create share link", exact: true }).click();
    const link = page.getByRole("textbox", { name: "Public share link", exact: true });
    await expect(link).toBeVisible();
    await page.goto(await link.inputValue());
    await expect(page.getByRole("heading", { name: MUTEX_TITLE, exact: true })).toBeVisible();
    await expectNoPageOverflow(page);
    await expectAccessible(page);
    const understand = page.getByRole("tab", { name: "Understand", exact: true });
    await understand.focus();
    await understand.press("End");
    const quiz = page.getByRole("tab", { name: "Quiz", exact: true });
    await expect(quiz).toBeFocused();
    await expect(quiz).toHaveAttribute("aria-selected", "true");
    await quiz.press("Home");
    await expect(understand).toBeFocused();
    await expectAccessible(page);
    await page.reload();
    await expect(page.getByRole("combobox", { name: "Color theme", exact: true })).toHaveValue(theme);
  });
}
