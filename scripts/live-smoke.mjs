import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const url = process.env.INKBLAST_URL ?? "https://orgoldfus.github.io/inkblast/";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
const requests = [];
const failed = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => requests.push(request.url()));
page.on("response", (response) => {
  if (response.status() >= 400)
    failed.push({ url: response.url(), status: response.status() });
});
await mkdir("artifacts", { recursive: true });
try {
  const response = await page.goto(url);
  if (response?.status() !== 200)
    throw new Error(`Hosted page returned ${response?.status()}`);
  await page.waitForFunction(
    () => !document.querySelector("#quick-play").disabled,
  );
  await page.screenshot({ path: "artifacts/live-home.png", fullPage: true });
  await page.reload();
  await page.waitForFunction(
    () => !document.querySelector("#quick-play").disabled,
  );
  await page.locator("#custom-button").click();
  await page.locator('[data-settings-link="match"]').click();
  await page.locator("#setup-form select[name=mode]").selectOption("local");
  await page.locator("#setup-form select[name=targetScore]").selectOption("1");
  await page.getByRole("button", { name: "START MATCH" }).click();
  await page.locator("#battle").waitFor({ state: "visible" });
  await page.waitForSelector('#battle[data-phase="active"]');
  await page.keyboard.press("Space");
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "artifacts/live-battle.png", fullPage: true });
  await page
    .locator("#result-dialog")
    .waitFor({ state: "visible", timeout: 12_000 });
  const resultTitle = await page.locator("#result-title").innerText();
  if ((await page.locator("#result-p2").innerText()) !== "1")
    throw new Error("The hosted round did not award the expected point.");
  await page.locator("#next-button").click();
  await page.keyboard.press("Escape");
  await page.locator("#pause-dialog").waitFor({ state: "visible" });
  await page.locator("#leave-button").click();
  const staticOnly = requests
    .filter((request) => /^https?:/.test(request))
    .every((request) => new URL(request).origin === new URL(url).origin);
  const report = {
    url,
    browser: await browser.version(),
    resultTitle,
    completedRound: true,
    rematch: true,
    refresh: true,
    staticOnly,
    errors,
    failed,
  };
  await writeFile("artifacts/live-smoke.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (errors.length || failed.length || !staticOnly) process.exitCode = 1;
} finally {
  await browser.close();
}
