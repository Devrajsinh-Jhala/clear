import { expect, test } from "@playwright/test";

import { expectNoPageOverflow, ORIGIN } from "./helpers";

test("unconfigured accounts keep guest lessons usable and deny saved-library access", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.getByRole("heading", { name: "Guest lessons are ready", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email address", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  const credentials = { email: "synthetic@example.test", password: " synthetic-browser-password " };
  for (const action of ["sign-in", "sign-up"]) {
    const result = await page.request.post(`/api/auth/${action}`, { headers: { Origin: ORIGIN }, data: credentials });
    expect(result.status()).toBe(503);
    expect((await result.json()).error.code).toBe("auth_unavailable");
  }
  const shortPassword = await page.request.post("/api/auth/sign-up", { headers: { Origin: ORIGIN }, data: { ...credentials, password: "short" } });
  expect(shortPassword.status()).toBe(400);
  const unexpectedField = await page.request.post("/api/auth/sign-in", { headers: { Origin: ORIGIN }, data: { ...credentials, userId: "29b354a8-de05-40bd-98c1-0a890ae67ef5" } });
  expect(unexpectedField.status()).toBe(400);
  const library = await page.request.get("/api/auth/library");
  expect(library.status()).toBe(401);
  expect((await library.json()).error.code).toBe("sign_in_required");
  const foreignLesson = "/api/auth/library/29b354a8-de05-40bd-98c1-0a890ae67ef5";
  const mutation = await page.request.patch(foreignLesson, { headers: { Origin: ORIGIN }, data: { action: "rename", title: "Unauthorized synthetic rename" } });
  expect(mutation.status()).toBe(401);
  const deletion = await page.request.delete(foreignLesson, { headers: { Origin: ORIGIN } });
  expect(deletion.status()).toBe(401);
  await page.goto("/library");
  await expect(page.getByRole("heading", { name: "Keep learning as a guest", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Start a lesson", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "What are you trying to understand?", exact: true })).toBeVisible();
  await expectNoPageOverflow(page);
});
