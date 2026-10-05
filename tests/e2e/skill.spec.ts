import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

import { expectNoPageOverflow } from "./helpers";

test("all seven skill previews match the real ZIP with the learner's selected preferences", async ({ page }, testInfo) => {
  await page.goto("/skill");
  await page.getByRole("combobox", { name: "Learner level", exact: true }).selectOption("engineer");
  await page.getByRole("combobox", { name: "How far to go", exact: true }).selectOption("deep");
  await page.getByRole("combobox", { name: "Writing style", exact: true }).selectOption("detailed");
  await page.getByRole("checkbox", { name: /Make it familiar/ }).uncheck();
  await page.getByRole("checkbox", { name: /Show the connections/ }).uncheck();
  await page.getByRole("checkbox", { name: /Check my understanding/ }).uncheck();
  await page.getByRole("checkbox", { name: /Practice for interviews/ }).check();
  await expect(page.locator("pre")).toContainText("Learner level: engineer.");
  await expect(page.locator("pre")).toContainText("Preferred depth: deep.");
  await expect(page.locator("pre")).toContainText("Interview mode: on.");
  const fileSelect = page.getByRole("combobox", { name: "Preview file", exact: true });
  const paths = await fileSelect.locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
  expect(paths).toHaveLength(7);
  const preview = new Map<string, string>();
  for (const file of paths) {
    await fileSelect.selectOption(file);
    // HTML parsing normalizes checked-out Windows line endings; compare the visible file text.
    preview.set(`clear-explainer/${file}`, (await page.locator("pre").textContent() ?? "").replace(/\r\n/g, "\n"));
  }
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CLEAR skill", exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("clear-explainer.zip");
  expect(await download.failure()).toBeNull();
  const destination = testInfo.outputPath("clear-explainer.zip");
  await download.saveAs(destination);
  const archive = unzipSync(await readFile(destination));
  expect(Object.keys(archive).sort()).toEqual([...preview.keys()].sort());
  for (const [file, content] of Object.entries(archive)) expect(strFromU8(content).replace(/\r\n/g, "\n")).toBe(preview.get(file));
  expect(strFromU8(archive["clear-explainer/SKILL.md"])).toContain("Recall checks: do not add unsolicited quizzes");
  await expect(page.getByRole("status").filter({ hasText: "Your package is ready." })).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await fileSelect.selectOption("SKILL.md");
  await expect(page.locator("pre")).toContainText("Learner level: beginner.");
  await expect(page.getByRole("checkbox", { name: /Check my understanding/ })).toBeChecked();
  await expectNoPageOverflow(page);
});
