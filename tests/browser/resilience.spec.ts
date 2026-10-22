import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function exportDeviceBackup(page: Page) {
  const downloaded = page.waitForEvent("download");
  await page.locator("#export-backup").click();
  const download = await downloaded;
  return JSON.parse(await readFile((await download.path())!, "utf8"));
}

test("backup preserves newer session values and deletions when existing device records cannot be overwritten", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator("#arena-host canvas")).toBeVisible();
  await page.locator("#workshop-button").click();
  await page.getByLabel("Map name", { exact: true }).fill("Old persisted map");
  await page.getByLabel("Map name", { exact: true }).blur();
  await page.getByRole("button", { name: "Save map", exact: true }).click();
  await expect(page.locator(".editor-status")).toContainText("Saved");
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await page.locator("#about-button").click();
  const baseline = await exportDeviceBackup(page);
  baseline.settings.difficulty = "normal";
  baseline.progress.played = 2;
  await page.locator("#backup-file").setInputFiles({
    name: "baseline.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(baseline)),
  });
  await expect(page.locator("#toast")).toContainText("Restored settings");
  await page.evaluate(() => {
    const quota = () => {
      throw new DOMException(
        "Test device quota exhausted",
        "QuotaExceededError",
      );
    };
    Storage.prototype.setItem = quota;
    IDBObjectStore.prototype.put = quota;
    IDBObjectStore.prototype.delete = quota;
  });
  const updated = structuredClone(baseline);
  updated.settings.difficulty = "hard";
  updated.progress.played = 7;
  updated.maps[0].name = "New session map";
  await page.locator("#backup-file").setInputFiles({
    name: "updated.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(updated)),
  });
  await expect(page.locator("#toast")).toContainText("session only");
  const backup = await exportDeviceBackup(page);
  expect(backup.settings.difficulty).toBe("hard");
  expect(backup.progress.played).toBe(7);
  expect(backup.maps[0].name).toBe("New session map");
  await page.getByRole("button", { name: "Close about", exact: true }).click();
  await page.locator("#workshop-button").click();
  const maps = page.getByLabel("Load a preset or saved map");
  await maps.selectOption(updated.maps[0].id);
  await expect(page.getByLabel("Map name", { exact: true })).toHaveValue(
    "New session map",
  );
  await page
    .getByRole("button", { name: "Delete saved map", exact: true })
    .click();
  await expect(page.locator(".editor-status")).toContainText(
    "may reappear after reload",
  );
  await expect(
    maps.locator("option", { hasText: "New session map" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await page.locator("#about-button").click();
  expect((await exportDeviceBackup(page)).maps).toEqual([]);
});

test("settings quota failure is visible while the chosen difficulty stays usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException(
        "Test settings quota exhausted",
        "QuotaExceededError",
      );
    };
  });
  await page.goto("./");
  await expect(page.locator("#arena-host canvas")).toBeVisible();
  await page.locator("#custom-button").click();
  await page
    .locator("#setup-form select[name=difficulty]")
    .selectOption("hard");
  await page.getByRole("button", { name: "START MATCH ↗" }).click();
  await expect(page.locator("#toast")).toContainText("session only");
  await expect(page.locator("#p2-name")).toContainText("HARD");
  await expect(page.locator("#battle")).toHaveAttribute("data-phase", "active");
});

test("a full device store preserves the map for this session and JSON export", async ({
  page,
}) => {
  await page.addInitScript(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException(
        "Test device quota exhausted",
        "QuotaExceededError",
      );
    };
  });
  await page.goto("./");
  await expect(page.locator("#arena-host canvas")).toBeVisible();
  await page.locator("#workshop-button").click();
  await page
    .getByLabel("Map name", { exact: true })
    .fill("Keep my unsaved map");
  await page.getByLabel("Map name", { exact: true }).blur();
  await page.getByRole("button", { name: "Save map", exact: true }).click();
  await expect(page.locator(".editor-status")).toContainText("session only");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const download = await downloaded;
  const saved = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(saved.scheme.name).toBe("Keep my unsaved map");
  expect(saved.scheme.cells).toHaveLength(165);
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await page.locator("#workshop-button").click();
  await expect(
    page
      .getByLabel("Load a preset or saved map")
      .locator("option", { hasText: "Keep my unsaved map" }),
  ).toHaveCount(1);
});

test("WebGL loss pauses the battle and restoration allows a complete round", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await expect(page.locator("#arena-host canvas")).toBeVisible();
  await page.locator("#custom-button").click();
  await page.locator("#setup-form select[name=mode]").selectOption("local");
  await page.getByRole("button", { name: "START MATCH ↗" }).click();
  await expect(page.locator("#battle")).toHaveAttribute("data-phase", "active");
  await page.evaluate(() => {
    const canvas =
      document.querySelector<HTMLCanvasElement>("#arena-host canvas")!;
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) throw new Error("No WebGL context to test");
    const extension = gl.getExtension("WEBGL_lose_context");
    if (!extension) throw new Error("WebGL loss extension unavailable");
    Object.assign(window, {
      restoreTestContext: () => extension.restoreContext(),
    });
    extension.loseContext();
  });
  await expect(page.locator("#pause-dialog")).toBeVisible();
  await expect(page.locator("#pause-reason")).toContainText(
    "graphics connection",
  );
  await page.locator("#resume-button").click();
  await expect(page.locator("#pause-dialog")).toBeVisible();
  await expect(page.locator("#pause-reason")).toContainText("still recovering");
  const clock = await page.locator("#clock").textContent();
  await page.waitForTimeout(300);
  await expect(page.locator("#clock")).toHaveText(clock!);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        document
          .querySelector("canvas")!
          .addEventListener("webglcontextrestored", () => resolve(), {
            once: true,
          });
        (
          window as unknown as { restoreTestContext: () => void }
        ).restoreTestContext();
      }),
  );
  await page.locator("#resume-button").click();
  await expect(page.locator("#pause-dialog")).not.toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("restored-arena.png") });
  await page.keyboard.press("Space");
  await expect(page.locator("#result-dialog")).toBeVisible({ timeout: 12_000 });
  await expect(page.locator("#result-p2")).toHaveText("1");
  expect(errors).toEqual([]);
});
