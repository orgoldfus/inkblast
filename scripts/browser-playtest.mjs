import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const url = process.env.INKBLAST_URL ?? "http://127.0.0.1:5173/";
await page.goto(url);
await page.waitForFunction(
  () => !document.querySelector("#quick-play").disabled,
);
await page.screenshot({ path: "artifacts/home-desktop.png", fullPage: true });
await page.locator("#quick-play").click();
await page.waitForTimeout(2700);
const initial = await page.evaluate(() => window.inkblastQA.snapshot());
await page.keyboard.down("d");
await page.waitForTimeout(250);
await page.keyboard.up("d");
await page.keyboard.press("Space");
await page.keyboard.down("a");
await page.waitForTimeout(300);
await page.keyboard.up("a");
await page.keyboard.down("s");
await page.waitForTimeout(300);
await page.keyboard.up("s");
const moved = await page.evaluate(() => window.inkblastQA.snapshot());
await page.screenshot({ path: "artifacts/battle-desktop.png", fullPage: true });
await page.keyboard.press("Escape");
await page.waitForTimeout(150);
const paused = await page.evaluate(() => window.inkblastQA.snapshot());
await page.waitForTimeout(400);
const stillPaused = await page.evaluate(() => window.inkblastQA.snapshot());
await page.locator("#resume-button").click();
await page.waitForTimeout(3000);
const afterFuse = await page.evaluate(() => window.inkblastQA.snapshot());
await page.keyboard.press("Escape");
if (await page.locator("#pause-dialog").isVisible())
  await page.locator("#leave-button").click();
else await page.locator("#result-home").click();
await page.locator("#extras-button").click();
await page.locator("#practice-button").click();
await page.waitForTimeout(4000);
const practice = await page.evaluate(() => window.inkblastQA.snapshot());
await page.keyboard.press("Escape");
await page.locator("#leave-button").click();
await page.locator("#extras-button").click();
await page.locator("#workshop-button").click();
await page.screenshot({
  path: "artifacts/workshop-desktop.png",
  fullPage: true,
});
await page.getByRole("button", { name: "← Back", exact: true }).click();
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "artifacts/home-mobile.png", fullPage: true });
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth > innerWidth,
);
await page.locator("#quick-play").click();
await page.waitForTimeout(2800);
await page.screenshot({ path: "artifacts/battle-mobile.png", fullPage: true });
const performance = await page.evaluate(() => window.inkblastQA.performance());
const result = {
  browser: await browser.version(),
  movement: {
    initial: initial.state.players[0],
    moved: moved.state.players[0],
  },
  bombPlanted: moved.state.bombs.some((bomb) => bomb.owner === 0),
  pauseStable: paused.paused && paused.state.tick === stillPaused.state.tick,
  escapedOwnBomb: afterFuse.state.players[0].alive,
  practiceActive: practice.state.phase === "active",
  mobileOverflow: overflow,
  performance,
  errors,
};
await writeFile(
  "artifacts/browser-playtest.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
await browser.close();
