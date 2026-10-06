import { chromium } from "@playwright/test";
// usage: node .shots.mjs <outdir> <scheme> <width> <height> <paths,comma> [fullpage=1]
const [out, scheme, w, h, paths, full = "1"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, colorScheme: scheme, reducedMotion: "reduce" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
for (const p of paths.split(",")) {
  if (p === "@sample") {
    await page.goto("http://localhost:3000/ask", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "See an example", exact: true }).click();
    await page.waitForURL(/\/learn\//);
    await page.waitForLoadState("networkidle");
  } else if (p.startsWith("@tab:")) {
    await page.getByRole("tab", { name: p.slice(5), exact: true }).click();
  } else {
    await page.goto("http://localhost:3000" + p, { waitUntil: "networkidle" });
  }
  await page.waitForTimeout(700);
  const name = `${out}/${scheme}-${w}-${p.replace(/[^a-z0-9]+/gi, "_")}.png`;
  await page.screenshot({ path: name, fullPage: full === "1" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(p, "overflow", overflow);
}
console.log("errors", errors.slice(0, 5));
await browser.close();
