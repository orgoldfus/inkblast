import { firefox, webkit, expect } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir, platform, release, arch } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output =
  process.env.INKBLAST_SMOKE_OUTPUT ??
  path.join(tmpdir(), "inkblast-engine-smoke-results");
const buildDirectory = path.join(tmpdir(), "inkblast-engine-smoke-build");
const port = process.env.INKBLAST_SMOKE_PORT ?? "4188";
const url =
  process.env.INKBLAST_SMOKE_URL ?? `http://127.0.0.1:${port}/inkblast/`;
const vite = path.join(root, "node_modules/vite/bin/vite.js");
let server;
await mkdir(output, { recursive: true });
const revision = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
});
const dirty = spawnSync("git", ["status", "--porcelain"], {
  cwd: root,
  encoding: "utf8",
});
const report = {
  date: new Date().toISOString(),
  host: `${platform()} ${release()} ${arch()}`,
  url,
  sourceRevision:
    revision.status === 0 ? revision.stdout.trim() : "uncommitted workspace",
  workspaceDirty: dirty.status === 0 ? Boolean(dirty.stdout.trim()) : true,
  results: [],
};

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server?.exitCode !== null)
      throw new Error("Production preview exited before becoming ready.");
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* Preview has not finished binding its port. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    "Production preview did not become ready within ten seconds.",
  );
}

async function smoke(name, engine) {
  const result = {
    engine: name,
    passed: false,
    checks: [],
    pageErrors: [],
    consoleErrors: [],
    externalRequests: [],
  };
  let browser, context, page;
  const check = (text) => result.checks.push(text);
  try {
    browser = await engine.launch({ headless: true });
    result.version = browser.version();
    context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.on("pageerror", (error) => result.pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") result.consoleErrors.push(message.text());
    });
    page.on("request", (request) => {
      if (
        /^https?:/.test(request.url()) &&
        new URL(request.url()).origin !== new URL(url).origin
      )
        result.externalRequests.push(request.url());
    });
    await page.goto(url);
    await expect(page.locator("#arena-host canvas")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /SMALL ARENA/ }),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(output, `${name}-home.png`),
      fullPage: true,
    });
    check("Production static load and visible canvas");
    await page.locator("#quick-play").click();
    await expect(page.locator("#battle")).toBeVisible();
    check("Quick Player vs Computer start");
    await page.keyboard.press("Escape");
    await expect(page.locator("#pause-dialog")).toBeVisible();
    const clock = await page.locator("#clock").textContent();
    await page.waitForTimeout(300);
    await expect(page.locator("#clock")).toHaveText(clock);
    await page.locator("#resume-button").click();
    await expect(page.locator("#pause-dialog")).not.toBeVisible();
    check("Keyboard pause, stable clock and resume");
    await page.keyboard.press("Escape");
    await page.locator("#leave-button").click();
    await page.locator("#custom-button").click();
    await page.locator("#setup-form select[name=mode]").selectOption("local");
    await page
      .locator("#setup-form select[name=targetScore]")
      .selectOption("1");
    await page.getByRole("button", { name: "START MATCH ↗" }).click();
    await expect(page.locator("#battle")).toBeVisible();
    await expect(page.locator("#battle-announcement")).toHaveText("", {
      timeout: 12_000,
    });
    await page.keyboard.press("Space");
    await expect(page.locator("#result-dialog")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("#result-p2")).toHaveText("1");
    await expect(page.locator("#result-p1")).toHaveText("0");
    await page.screenshot({
      path: path.join(output, `${name}-result.png`),
      fullPage: true,
    });
    check("Keyboard bomb, death and match result");
    await page.locator("#next-button").click();
    await expect(page.locator("#result-dialog")).not.toBeVisible();
    await expect(page.locator("#battle")).toBeVisible();
    check("One-action rematch");
    await page.keyboard.press("Escape");
    await page.locator("#leave-button").click();
    await page.locator("#workshop-button").click();
    const mapName = `${name} persistence smoke`;
    await page.getByLabel("Map name", { exact: true }).fill(mapName);
    await page.getByLabel("Map name", { exact: true }).blur();
    await page.getByRole("button", { name: "Save map", exact: true }).click();
    await expect(page.locator(".editor-status")).toContainText("Saved");
    await page.reload();
    await page.locator("#workshop-button").click();
    await expect(
      page
        .getByLabel("Load a preset or saved map")
        .locator("option", { hasText: mapName }),
    ).toHaveCount(1);
    check("Workshop IndexedDB save survives reload");
    await page.screenshot({
      path: path.join(output, `${name}-workshop.png`),
      fullPage: true,
    });
    expect(result.pageErrors).toEqual([]);
    expect(result.externalRequests).toEqual([]);
    check("No uncaught page errors or external application requests");
    result.passed = true;
  } catch (error) {
    result.failure = error instanceof Error ? error.stack : String(error);
    if (page) {
      try {
        await page.screenshot({
          path: path.join(output, `${name}-failure.png`),
          fullPage: true,
        });
        result.failurePage = await page.locator("body").innerText();
      } catch {
        /* Launch failures have no page to capture. */
      }
    }
  } finally {
    await context?.close();
    await browser?.close();
  }
  report.results.push(result);
  console.log(JSON.stringify(result, null, 2));
}

try {
  if (!process.env.INKBLAST_SMOKE_URL) {
    const build = spawnSync(
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
    if (build.status !== 0) throw new Error("Production smoke build failed.");
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
        `--port=${port}`,
        "--strictPort",
        "--base=/inkblast/",
        `--outDir=${buildDirectory}`,
      ],
      { cwd: root, stdio: "inherit" },
    );
    await waitForServer();
  }
  await smoke("firefox", firefox);
  await smoke("webkit", webkit);
} catch (error) {
  report.failure = error instanceof Error ? error.stack : String(error);
} finally {
  server?.kill("SIGTERM");
  await writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2),
  );
}
if (
  report.failure ||
  report.results.length !== 2 ||
  report.results.some((result) => !result.passed)
)
  process.exitCode = 1;
