import { chromium, expect } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { arch, platform, release, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.resolve(
  process.env.INKBLAST_SOAK_OUTPUT ?? path.join(root, "artifacts/browser-soak"),
);
const vite = path.join(root, "node_modules/vite/bin/vite.js");
const url = "http://127.0.0.1:4187/inkblast/";
const started = Date.now();
const deadline = started + 300_000;
const git = (args) => {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(`Cannot inspect source: ${result.stderr}`);
  return result.stdout.trim();
};
const dirtyFiles = git(["status", "--porcelain"]);
const report = {
  date: new Date().toISOString(),
  host: `${platform()} ${release()} ${arch()}`,
  sourceRevision: git(["rev-parse", "HEAD"]),
  workspaceDirty: Boolean(dirtyFiles),
  dirtyFiles,
  url,
  maximumSeconds: 300,
  cycles: 3,
  rounds: [],
  samples: [],
  pageErrors: [],
  consoleErrors: [],
  requestFailures: [],
  passed: false,
  limitations:
    "Bounded headless native Chrome lifecycle observation; does not establish physical GPU, multi-hour, human gameplay, or leak-free behavior.",
};
let browser, page, server, build, buildDirectory;
let timedOut = false;
const watchdog = setTimeout(() => {
  timedOut = true;
  build?.kill("SIGKILL");
  server?.kill("SIGKILL");
  void browser?.close().catch(() => {});
}, deadline - Date.now());

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null || timedOut)
      throw new Error("Production preview stopped before becoming ready.");
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(500) })).ok) return;
    } catch {
      // A new preview may not have bound its port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    "Production preview did not become ready within ten seconds.",
  );
}

async function sampleMemory(cdp, cycle) {
  await cdp.send("HeapProfiler.collectGarbage");
  const heap = await cdp.send("Runtime.getHeapUsage");
  const dom = await cdp.send("Memory.getDOMCounters");
  const sample = {
    cycle,
    completedRounds: report.rounds.length,
    elapsedSeconds: (Date.now() - started) / 1000,
    heap,
    dom,
    canvasCount: await page.locator("canvas").count(),
  };
  report.samples.push(sample);
  console.log(JSON.stringify({ memorySample: sample }));
}

function observedGrowth(warm, final) {
  const difference = (a, b) =>
    Object.fromEntries(Object.keys(a).map((key) => [key, b[key] - a[key]]));
  return {
    fromCycle: warm.cycle,
    toCycle: final.cycle,
    heapBytes: difference(warm.heap, final.heap),
    dom: difference(warm.dom, final.dom),
    canvasCount: final.canvasCount - warm.canvasCount,
    usedHeapPercent:
      ((final.heap.usedSize - warm.heap.usedSize) / warm.heap.usedSize) * 100,
  };
}

await mkdir(output, { recursive: true });
try {
  buildDirectory = await mkdtemp(path.join(tmpdir(), "inkblast-browser-soak-"));
  await new Promise((resolve, reject) => {
    build = spawn(
      process.execPath,
      [
        vite,
        "build",
        "--base=/inkblast/",
        `--outDir=${buildDirectory}`,
        "--emptyOutDir",
      ],
      { cwd: root, stdio: "inherit" },
    );
    build.once("error", reject);
    build.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Production build exited ${code}.`)),
    );
  });
  report.buildEntry =
    (await readFile(path.join(buildDirectory, "index.html"), "utf8")).match(
      /src="([^\"]+\.js)"/,
    )?.[1] ?? "unknown";
  server = spawn(
    process.execPath,
    [
      vite,
      "preview",
      "--host=127.0.0.1",
      "--port=4187",
      "--strictPort",
      "--base=/inkblast/",
      `--outDir=${buildDirectory}`,
    ],
    { cwd: root, stdio: "inherit" },
  );
  await waitForServer();
  browser = await chromium.launch({ channel: "chrome", headless: true });
  report.browserVersion = browser.version();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) =>
    report.requestFailures.push({
      url: request.url(),
      error: request.failure(),
    }),
  );
  await page.goto(url);
  await expect(page.locator("#arena-host canvas")).toBeVisible();
  await page.locator("#custom-button").click();
  const themes = await page
    .locator('#setup-form select[name="themeId"] option')
    .evaluateAll((options) =>
      options
        .filter((option) => option.value !== "random")
        .map((option) => ({ id: option.value, name: option.textContent })),
    );
  expect(themes).toHaveLength(11);
  report.themes = themes;
  await page.getByRole("button", { name: "Close setup", exact: true }).click();
  const cdp = await context.newCDPSession(page);
  await sampleMemory(cdp, 0);
  for (let cycle = 1; cycle <= report.cycles; cycle++) {
    for (const theme of themes) {
      if (timedOut)
        throw new Error("Five-minute browser soak deadline exceeded.");
      const roundStarted = Date.now();
      await page.locator("#custom-button").click();
      const form = page.locator("#setup-form");
      await form.locator('select[name="mode"]').selectOption("local");
      await form.locator('select[name="targetScore"]').selectOption("1");
      await form.locator('select[name="schemeId"]').selectOption("classic");
      await form.locator('select[name="themeId"]').selectOption(theme.id);
      await page.locator("#input-assignment").selectOption("keyboard");
      await page.getByRole("button", { name: "START MATCH ↗" }).click();
      await expect(page.locator("#battle")).toHaveAttribute(
        "data-phase",
        "active",
      );
      await expect(page.locator("#battle-theme")).toHaveText(
        theme.name.toUpperCase(),
      );
      await expect(page.locator("#p2-name")).toHaveText("PLAYER TWO");
      if (report.rounds.length === 0)
        await page.screenshot({
          path: path.join(output, "first-round.png"),
          fullPage: true,
        });
      await page.keyboard.press("Space");
      await expect(page.locator("#result-dialog")).toBeVisible();
      await expect(page.locator("#result-p1")).toHaveText("0");
      await expect(page.locator("#result-p2")).toHaveText("1");
      await expect(page.locator("#result-kicker")).toHaveText("MATCH COMPLETE");
      if (cycle === report.cycles && theme.id === themes.at(-1).id)
        await page.screenshot({
          path: path.join(output, "last-result.png"),
          fullPage: true,
        });
      await page.locator("#result-home").click();
      await expect(page.locator("#home")).toBeVisible();
      await expect(page.locator("#result-dialog")).not.toBeVisible();
      await expect(page.locator("canvas")).toHaveCount(1);
      report.rounds.push({
        cycle,
        theme: theme.id,
        score: [0, 1],
        seconds: (Date.now() - roundStarted) / 1000,
      });
      console.log(
        `Completed browser round ${report.rounds.length}/33: cycle ${cycle}, ${theme.id}`,
      );
    }
    await sampleMemory(cdp, cycle);
  }
  report.growthFromWarmCycle = observedGrowth(
    report.samples[1],
    report.samples.at(-1),
  );
  expect(report.rounds).toHaveLength(33);
  expect(report.pageErrors).toEqual([]);
  expect(report.consoleErrors).toEqual([]);
  expect(report.requestFailures).toEqual([]);
  report.passed = true;
} catch (error) {
  report.failure = timedOut
    ? "Five-minute browser soak deadline exceeded."
    : error instanceof Error
      ? error.stack
      : String(error);
  if (page && !page.isClosed()) {
    try {
      await page.screenshot({
        path: path.join(output, "failure.png"),
        fullPage: true,
        timeout: 3000,
      });
    } catch {
      // A crashed or closed browser cannot produce a failure screenshot.
    }
  }
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
  if (buildDirectory)
    await rm(buildDirectory, { recursive: true, force: true });
  clearTimeout(watchdog);
  report.elapsedSeconds = (Date.now() - started) / 1000;
  await writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        passed: report.passed,
        completedRounds: report.rounds.length,
        elapsedSeconds: report.elapsedSeconds,
        growthFromWarmCycle: report.growthFromWarmCycle,
        failure: report.failure,
        output,
      },
      null,
      2,
    ),
  );
}
if (!report.passed) process.exitCode = 1;
