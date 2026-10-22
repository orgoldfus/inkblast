import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function ready(page: Page): Promise<void> {
  await page.goto("./");
  await expect(page.locator("#arena-host canvas")).toBeVisible();
}

async function startLocal(page: Page, assignment = "keyboard"): Promise<void> {
  await ready(page);
  await page.locator("#custom-button").click();
  await page.locator("#setup-form select[name=mode]").selectOption("local");
  await page.locator("#setup-form select[name=targetScore]").selectOption("1");
  await page
    .locator("#setup-form select[name=schemeId]")
    .selectOption("classic");
  await page
    .locator("#setup-form select[name=themeId]")
    .selectOption("classic");
  await page.locator("#input-assignment").selectOption(assignment);
  await page.getByRole("button", { name: "START MATCH ↗" }).click();
  await expect(page.locator("#battle")).toBeVisible();
  await expect(page.locator("#p2-name")).toHaveText("PLAYER TWO");
}

test("built project path loads local assets without runtime services", async ({
  page,
}) => {
  const errors: string[] = [],
    requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => requests.push(request.url()));
  await ready(page);
  await expect(
    page.getByRole("heading", { name: /SMALL ARENA/ }),
  ).toBeVisible();
  await expect(page.locator("#home input[name=mode]")).toHaveCount(2);
  await page.reload();
  await expect(page.locator("#arena-host canvas")).toBeVisible();
  expect(errors).toEqual([]);
  expect(
    requests
      .filter((url) => /^https?:/.test(url))
      .every((url) => new URL(url).origin === "http://127.0.0.1:4174"),
  ).toBe(true);
});

test("local duel receives a keyboard bomb, pauses, resolves, and rematches", async ({
  page,
}) => {
  await startLocal(page);
  await page.keyboard.press("Escape");
  await expect(page.locator("#pause-dialog")).toBeVisible();
  const clock = await page.locator("#clock").textContent();
  await page.waitForTimeout(300);
  await expect(page.locator("#clock")).toHaveText(clock!);
  await page.locator("#resume-button").click();
  await expect(page.locator("#pause-dialog")).not.toBeVisible();
  // Wait for the real countdown before placing a bomb under the stationary player.
  await expect(page.locator("#battle")).toHaveAttribute(
    "data-phase",
    "active",
    { timeout: 10_000 },
  );
  await page.keyboard.press("Space");
  await expect(page.locator("#result-dialog")).toBeVisible({ timeout: 12_000 });
  await expect(page.locator("#result-p2")).toHaveText("1");
  await expect(page.locator("#result-p1")).toHaveText("0");
  await page.locator("#next-button").click();
  await expect(page.locator("#result-dialog")).not.toBeVisible();
  await expect(page.locator("#battle")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator("#leave-button").click();
  await expect(page.locator("#home")).toBeVisible();
});

test("solo keyboard choice persists, reaches gameplay and leaves local bindings intact", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#custom-button").click();
  const keyboard = page.getByRole("combobox", {
    name: "Solo keyboard",
    exact: true,
  });
  await expect(keyboard).toHaveValue("wasd");
  await keyboard.selectOption("arrows");
  await page.getByText("Sound, motion & keyboard", { exact: true }).click();
  await expect(page.locator("#key-bindings .binding-row")).toHaveCount(1);
  await expect(page.locator("#key-bindings")).toContainText("up: Up");
  await page.reload();
  await expect(page.locator("#arena-host canvas")).toBeVisible();
  await page.locator("#custom-button").click();
  await expect(keyboard).toHaveValue("arrows");
  await page.getByRole("button", { name: "START MATCH ↗" }).click();
  await expect(page.locator("#controls-hint")).toContainText("UpLeftDownRight");
  await expect(page.locator("#battle")).toHaveAttribute("data-phase", "active");
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(200);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.press("Space");
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(100);
  await page.keyboard.press("Escape");
  const downloaded = page.waitForEvent("download");
  await page.locator("#export-replay").click();
  const download = await downloaded;
  const replay = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(replay.inputs.some((input: number[]) => input[0] === 4)).toBe(true);
  expect(replay.inputs.some((input: number[]) => input[1] === 1)).toBe(true);
  expect(replay.inputs.some((input: number[]) => input[2] === 1)).toBe(true);
  await page.locator("#leave-button").click();
  await page.locator("#practice-button").click();
  await expect(page.locator("#controls-hint")).toContainText("UpLeftDownRight");
  await expect(page.locator("#practice-tip")).toContainText(
    "Use Up / Left / Down / Right",
  );
  await page.keyboard.press("Escape");
  await page.locator("#leave-button").click();
  await page.locator("#custom-button").click();
  await page.locator("#setup-form select[name=mode]").selectOption("local");
  await expect(keyboard).toBeHidden();
  await page.getByText("Sound, motion & keyboard", { exact: true }).click();
  await expect(page.locator("#key-bindings .binding-row")).toHaveCount(2);
  await expect(page.locator("#key-bindings .binding-row").nth(0)).toContainText(
    "up: W",
  );
  await expect(page.locator("#key-bindings .binding-row").nth(1)).toContainText(
    "up: Up",
  );
  await page.locator("#setup-form select[name=mode]").selectOption("cpu");
  await expect(keyboard).toHaveValue("arrows");
  await keyboard.selectOption("wasd");
  await page.getByRole("button", { name: "START MATCH ↗" }).click();
  await expect(page.locator("#controls-hint")).toContainText("WASD");
});

test("solo custom keys survive reload and accept keys used by local player two", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#custom-button").click();
  await page.getByText("Sound, motion & keyboard", { exact: true }).click();
  await page.getByRole("button", { name: "up: W", exact: true }).click();
  await page.keyboard.press("ArrowUp");
  await expect(
    page.getByRole("button", { name: "up: Up", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Solo keyboard", exact: true }),
  ).toHaveValue("custom");
  await page.reload();
  await expect(page.locator("#arena-host canvas")).toBeVisible();
  await page.locator("#custom-button").click();
  await expect(
    page.getByRole("combobox", { name: "Solo keyboard", exact: true }),
  ).toHaveValue("custom");
  await page.getByText("Sound, motion & keyboard", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "up: Up", exact: true }),
  ).toBeVisible();
});

test("two keyboard players can both plant bombs and produce a drawn round", async ({
  page,
}) => {
  await startLocal(page);
  await expect(page.locator("#battle")).toHaveAttribute(
    "data-phase",
    "active",
    { timeout: 10_000 },
  );
  await page.keyboard.press("Space");
  await page.keyboard.press("Enter");
  await expect(page.locator("#result-dialog")).toBeVisible({ timeout: 12_000 });
  await expect(page.locator("#result-p1")).toHaveText("0");
  await expect(page.locator("#result-p2")).toHaveText("0");
  await expect(page.locator("#result-title")).toContainText("DRAW");
  await page.keyboard.press("Escape");
  await expect(page.locator("#result-dialog")).not.toBeVisible();
  await expect(page.locator("#home")).toBeVisible();
});

test("device backup exports and restores settings and local records", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#workshop-button").click();
  await page.getByLabel("Map name", { exact: true }).fill("Backup map");
  await page.getByLabel("Map name", { exact: true }).blur();
  await page.getByRole("button", { name: "Save map", exact: true }).click();
  await expect(page.locator(".editor-status")).toContainText("Saved");
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await page.locator("#about-button").click();
  const downloaded = page.waitForEvent("download");
  await page.locator("#export-backup").click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("inkblast-backup.json");
  const backup = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(backup.format).toBe("inkblast-backup");
  expect(backup.version).toBe(1);
  expect(backup.maps).toHaveLength(1);
  backup.maps[0].name = "Restored backup map";
  backup.settings.music = 0.17;
  backup.progress = {
    played: 7,
    wins: 3,
    tourBest: 2,
    seenThemes: ["classic"],
  };
  await page.locator("#backup-file").setInputFiles({
    name: "restore.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.locator("#toast")).toContainText("Restored settings");
  await page.getByRole("button", { name: "Close about", exact: true }).click();
  await page.locator("#about-button").click();
  await expect(page.locator("#local-record")).toContainText(
    "7 rounds played · 3 wins",
  );
  await page.reload();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("inkblast.settings.v1")!).settings
          .music,
    ),
  ).toBe(0.17);
  await page.locator("#workshop-button").click();
  await expect(
    page
      .getByLabel("Load a preset or saved map")
      .locator("option", { hasText: "Restored backup map" }),
  ).toHaveCount(1);
});

test("two mocked gamepads are assigned, deliver a bomb and pause after disconnect", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const pads = [0, 1].map((index) => ({
      index,
      id: `Test controller ${index}`,
      connected: true,
      mapping: "standard",
      axes: [0, 0],
      buttons: Array.from({ length: 16 }, () => ({
        pressed: false,
        touched: false,
        value: 0,
      })),
      timestamp: 0,
    }));
    Object.assign(window, { testGamepads: pads });
    Object.defineProperty(navigator, "getGamepads", { value: () => pads });
  });
  await startLocal(page, "gamepads");
  await page.evaluate(() =>
    window.dispatchEvent(new Event("gamepaddisconnected")),
  );
  await expect(page.locator("#pause-dialog")).toBeVisible();
  await expect(page.locator("#pause-reason")).toContainText("disconnected");
  await page.locator("#resume-button").click();
  await expect(page.locator("#battle")).toHaveAttribute(
    "data-phase",
    "active",
    { timeout: 10_000 },
  );
  await page.evaluate(() => {
    const pads = (
      window as unknown as {
        testGamepads: { buttons: { pressed: boolean }[] }[];
      }
    ).testGamepads;
    pads[1].buttons[0].pressed = true;
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    const pads = (
      window as unknown as {
        testGamepads: { buttons: { pressed: boolean }[] }[];
      }
    ).testGamepads;
    pads[1].buttons[0].pressed = false;
  });
  await expect(page.locator("#result-dialog")).toBeVisible({ timeout: 12_000 });
  await expect(page.locator("#result-p1")).toHaveText("1");
  await expect(page.locator("#result-p2")).toHaveText("0");
});

test("workshop edits tiles, undoes, saves in IndexedDB and imports an inert map name", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#workshop-button").click();
  await page
    .getByLabel("Map name", { exact: true })
    .fill("Browser workshop test");
  await page.getByLabel("Map name", { exact: true }).blur();
  const tile = page.getByRole("gridcell", {
    name: "Row 2, column 4: floor",
    exact: true,
  });
  await page.getByRole("button", { name: "▦ Brick", exact: true }).click();
  await tile.click();
  await expect(
    page.getByRole("gridcell", { name: "Row 2, column 4: brick", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("gridcell", { name: "Row 2, column 4: floor", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(
    page.getByRole("gridcell", { name: "Row 2, column 4: brick", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Save map", exact: true }).click();
  await expect(page.locator(".editor-status")).toContainText("Saved");
  await page.reload();
  await page.locator("#workshop-button").click();
  const saved = page.getByLabel("Load a preset or saved map");
  await expect(
    saved.locator("option", { hasText: "Browser workshop test" }),
  ).toHaveCount(1);
  const map = await page.evaluate(
    async () =>
      new Promise<unknown>((resolve, reject) => {
        const request = indexedDB.open("inkblast-local", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const read = db.transaction("maps").objectStore("maps").getAll();
          read.onsuccess = () => {
            resolve(read.result[0]);
            db.close();
          };
          read.onerror = () => reject(read.error);
        };
      }),
  );
  const payload = {
    format: "inkblast-scheme",
    version: 1,
    scheme: {
      ...(map as Record<string, unknown>),
      name: "<img src=x onerror=alert(1)>",
    },
  };
  await page.locator("#workshop input[type=file]").setInputFiles({
    name: "hostile-name.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(payload)),
  });
  await expect(page.getByLabel("Map name", { exact: true })).toHaveValue(
    "<img src=x onerror=alert(1)>",
  );
  expect(await page.locator("#workshop img").count()).toBe(0);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/\.json$/);
  await expect(page.locator(".editor-status")).toContainText("Exported JSON");
  const cells = (map as { cells: string[] }).cells;
  const sch = [
    "-V,2",
    "-N,Original multi (3)",
    "-B,75",
    ...Array.from(
      { length: 11 },
      (_, y) =>
        `-R,${y},${cells
          .slice(y * 15, y * 15 + 15)
          .map((c) => (c === "wall" ? "#" : c === "brick" ? ":" : "."))
          .join("")}`,
    ),
    "-S,0,1,1,0",
    "-S,1,13,9,0",
    "-S,2,3,1,0",
  ].join("\r\n");
  await page.locator("#workshop input[type=file]").setInputFiles({
    name: "multi.sch",
    mimeType: "text/plain",
    buffer: Buffer.from(sch),
  });
  const selection = page.getByRole("dialog", {
    name: "Choose two player starts",
  });
  await expect(selection).toBeVisible();
  await selection
    .getByRole("button", { name: "Use these starts", exact: true })
    .click();
  await expect(selection).not.toBeVisible();
  await expect(page.getByLabel("Map name", { exact: true })).toHaveValue(
    "Original multi (3)",
  );
  await page.getByRole("button", { name: "Save map", exact: true }).click();
  await expect(page.locator(".editor-status")).toContainText("Saved");
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page.getByLabel("Map name", { exact: true })).toHaveValue(
    "Original multi (3) copy",
  );
  await page.getByRole("button", { name: "Save map", exact: true }).click();
  await expect(page.locator(".editor-status")).toContainText("Saved");
  await page
    .getByRole("button", { name: "Delete saved map", exact: true })
    .click();
  await expect(page.locator(".editor-status")).toContainText("deleted");
  await page.reload();
  await page.locator("#workshop-button").click();
  await expect(
    page
      .getByLabel("Load a preset or saved map")
      .locator("option", { hasText: "Original multi (3) copy" }),
  ).toHaveCount(0);
});

test("mystery pickups default on, persist opt-out, and can be re-enabled", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#custom-button").click();
  const mystery = page.getByRole("checkbox", {
    name: "Mystery pickups",
    exact: true,
  });
  await expect(mystery).toBeChecked();
  await mystery.uncheck();
  await page.getByRole("button", { name: "START MATCH ↗" }).click();
  await page.reload();
  await page.locator("#custom-button").click();
  await expect(mystery).not.toBeChecked();
  await mystery.check();
  await page.getByRole("button", { name: "START MATCH ↗" }).click();
  await page.reload();
  await page.locator("#custom-button").click();
  await expect(mystery).toBeChecked();
});

test("pickup reveals and penalty countdowns stay readable and freeze while paused", async ({
  page,
}, testInfo) => {
  await ready(page);
  await page.locator("#practice-button").click();
  await expect(page.locator("#battle")).toHaveAttribute("data-phase", "active");
  await page.locator("#practice-item").selectOption("skate");
  await page.locator("#practice-give").click();
  await expect(page.locator("#p1-pickup")).toHaveText("SPEED UP!");
  await page.locator("#practice-item").selectOption("mystery");
  for (let attempt = 0; attempt < 60; attempt++) {
    await page.locator("#practice-give").click();
    if (await page.locator("#p1-effects").textContent()) break;
  }
  const countdown = page.locator("#p1-effects");
  await expect(countdown).toHaveText(
    /(SLOW MOTION|LEAKING BOMBS|WEAK FLAMES|REVERSED CONTROLS) · [67]s/,
  );
  await expect(page.locator("#p1-pickup")).toHaveClass(/harmful/);
  await page.screenshot({
    path: testInfo.outputPath("mystery-desktop.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  const frozen = await countdown.textContent();
  await page.waitForTimeout(1100);
  await expect(countdown).toHaveText(frozen!);
  await page.locator("#resume-button").click();
  await expect(countdown).toHaveText("", { timeout: 9000 });
  await expect(page.locator("#p1-pickup")).toHaveText("");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#practice-item").selectOption("disease");
  await page.locator("#practice-give").click();
  await expect(page.locator("#p1-pickup")).not.toHaveText("");
  await page.screenshot({
    path: testInfo.outputPath("mystery-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
