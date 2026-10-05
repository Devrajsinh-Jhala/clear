import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const origin = "http://127.0.0.1:3102";
const email = "synthetic@example.test";
const password = "  synthetic UI password  ";

test.beforeEach(async ({ page, context }) => {
  await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route("**/api/auth/**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "Unexpected synthetic auth request." } }) }));
});

async function ready(page: Page) {
  await page.goto("/auth");
  await expect(page.getByLabel("Email address", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("Password", { exact: true })).toBeEnabled();
}
async function credentials(page: Page) {
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
}

test("password modes use correct autofill and lengths without retaining a password across switches", async ({ page }) => {
  await ready(page);
  const input = page.getByLabel("Password", { exact: true });
  await expect(input).toHaveAttribute("type", "password");
  await expect(input).toHaveAttribute("autocomplete", "current-password");
  await expect(input).toHaveAttribute("minlength", "1");
  await expect(input).toHaveAttribute("maxlength", "128");
  await expect(page.locator("form")).toHaveAttribute("method", "post");
  await credentials(page);
  await page.getByRole("group", { name: "Account access" }).getByRole("button", { name: "Create account", exact: true }).click();
  await expect(input).toHaveValue("");
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(email);
  await expect(input).toHaveAttribute("autocomplete", "new-password");
  await expect(input).toHaveAttribute("minlength", "8");
  await expect(page.getByText("Use at least 8 characters.", { exact: true })).toBeVisible();
  await input.fill(password);
  await page.getByRole("group", { name: "Account access" }).getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(input).toHaveValue("");
  await expect(input).toHaveAttribute("autocomplete", "current-password");
});

test("wrong credentials preserve the draft and duplicate submits share one pending request", async ({ page }) => {
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/auth/sign-in", async (route) => {
    calls += 1;
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({ email, password });
    await gate;
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: { message: "The email or password was not accepted. Please try again." } }) });
  });
  await ready(page);
  await credentials(page);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole("button", { name: "Signing in…", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Password", { exact: true })).toBeDisabled();
  await page.locator("form").evaluate((element) => { const form = element as HTMLFormElement; form.requestSubmit(); form.requestSubmit(); });
  release();
  await expect(page.getByRole("alert").filter({ hasText: "The email or password was not accepted." })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(password);
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(email);
  await expect(page.locator('button[type="submit"]')).toBeEnabled();
  expect(calls).toBe(1);
  expect(page.url()).toBe(`${origin}/auth`);
});

test("signup confirmation returns to sign-in with email retained and password cleared", async ({ page }) => {
  await page.route("**/api/auth/sign-up", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ email, password });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ signedIn: false, needsConfirmation: true }) });
  });
  await ready(page);
  await page.getByRole("group", { name: "Account access" }).getByRole("button", { name: "Create account", exact: true }).click();
  await credentials(page);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole("status")).toHaveText("Check your email to confirm your account, then sign in.");
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(email);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "current-password");
  await expect(page.getByRole("group", { name: "Account access" }).getByRole("button", { name: "Sign in", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(page.url()).toBe(`${origin}/auth`);
});

for (const action of ["sign-in", "sign-up"] as const) {
  test(`synthetic successful ${action} navigates with the real Next router`, async ({ page }) => {
    await page.route(`**/api/auth/${action}`, async (route) => {
      expect(route.request().postDataJSON()).toEqual({ email, password });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ signedIn: true, needsConfirmation: false }) });
    });
    await ready(page);
    if (action === "sign-up") await page.getByRole("group", { name: "Account access" }).getByRole("button", { name: "Create account", exact: true }).click();
    await credentials(page);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(`${origin}/library`);
    await expect(page.getByRole("heading", { name: "Synthetic library navigation", exact: true })).toBeVisible();
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`${theme} password forms remain accessible and keyboard usable at 390 pixels`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ready(page);
    await page.evaluate((selected) => document.documentElement.classList.toggle("dark", selected === "dark"), theme);
    for (const mode of ["sign-in", "sign-up"] as const) {
      if (mode === "sign-up") await page.getByRole("group", { name: "Account access" }).getByRole("button", { name: "Create account", exact: true }).click();
      const bounds = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
      expect(bounds.content).toBeLessThanOrEqual(bounds.viewport + 1);
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(result.violations).toEqual([]);
      await page.getByLabel("Email address", { exact: true }).focus();
      await page.keyboard.press("Tab");
      await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.locator('button[type="submit"]')).toBeFocused();
    }
    const screenshot = testInfo.outputPath(`password-form-${theme}-390.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    await testInfo.attach(`Synthetic password form · ${theme} · 390 pixels`, { path: screenshot, contentType: "image/png" });
  });
}
