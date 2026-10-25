import { openExtra } from "./menu-helpers";
import { test, expect, type CDPSession, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type TouchPoint = { id: number; x: number; y: number };

async function touch(
  session: CDPSession,
  type: "touchStart" | "touchMove" | "touchEnd" | "touchCancel",
  touchPoints: TouchPoint[] = [],
): Promise<void> {
  await session.send("Input.dispatchTouchEvent", { type, touchPoints });
}

async function startPractice(page: Page): Promise<void> {
  await page.goto("./");
  await expect(page.locator("#quick-play")).toBeEnabled();
  await openExtra(page, "practice-button");
  await expect(page.locator("#battle")).toHaveAttribute("data-phase", "active");
}

for (const viewport of [
  { width: 568, height: 320 },
  { width: 667, height: 375 },
  { width: 844, height: 300 },
  { width: 844, height: 390 },
  { width: 932, height: 430 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
]) {
  test(`touch joystick steers and bombs together at ${viewport.width} × ${viewport.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:4174/inkblast/",
      viewport,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await startPractice(page);
    const joystick = page.getByRole("group", { name: "Movement joystick" });
    const bomb = page.getByRole("button", { name: "BOMB", exact: true });
    await expect(joystick).toBeVisible();
    await expect(page.locator("#practice-tip")).toContainText(
      "Slide the joystick",
    );
    const arenaBounds = (await page.locator("#arena-host").boundingBox())!;
    const joystickBounds = (await joystick.boundingBox())!;
    const bombBounds = (await bomb.boundingBox())!;
    const actionBounds = (await page
      .getByRole("button", { name: "ACTION", exact: true })
      .boundingBox())!;
    const scoreBounds = (await page
      .locator(".player-score.red")
      .boundingBox())!;
    const rivalBounds = (await page
      .locator(".player-score.blue")
      .boundingBox())!;
    for (const bounds of [
      arenaBounds,
      scoreBounds,
      rivalBounds,
      joystickBounds,
      bombBounds,
      actionBounds,
    ]) {
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
    }
    expect(arenaBounds.width).toBeGreaterThan(
      Math.min(viewport.width * 0.48, ((viewport.height - 90) * 15) / 11) - 1,
    );
    expect(arenaBounds.width / arenaBounds.height).toBeCloseTo(15 / 11, 1);
    expect(joystickBounds.x + joystickBounds.width).toBeLessThan(arenaBounds.x);
    expect(arenaBounds.x + arenaBounds.width).toBeLessThan(bombBounds.x);
    expect(scoreBounds.y + scoreBounds.height).toBeLessThan(joystickBounds.y);
    expect(rivalBounds.y + rivalBounds.height).toBeLessThan(actionBounds.y);
    expect(joystickBounds.width).toBeGreaterThanOrEqual(120);
    expect(actionBounds.height).toBeGreaterThanOrEqual(44);
    expect(bombBounds.width).toBeGreaterThanOrEqual(
      viewport.height < 320 ? 72 : 80,
    );
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth + 1 &&
          document.documentElement.scrollHeight <= innerHeight + 1,
      ),
    ).toBe(true);

    const session = await context.newCDPSession(page);
    const center = {
      id: 1,
      x: joystickBounds.x + joystickBounds.width / 2,
      y: joystickBounds.y + joystickBounds.height / 2,
    };
    await touch(session, "touchStart", [center]);
    await expect(joystick).toHaveAttribute("data-direction", "");
    const right = { ...center, x: center.x + 20 };
    await touch(session, "touchMove", [right]);
    await expect(joystick).toHaveAttribute("data-direction", "right");
    await touch(session, "touchMove", [{ ...right, y: center.y + 21 }]);
    await expect(joystick).toHaveAttribute("data-direction", "right");
    await touch(session, "touchMove", [{ ...center, y: center.y - 25 }]);
    await expect(joystick).toHaveAttribute("data-direction", "up");
    await touch(session, "touchMove", [right]);
    const bombTouch = {
      id: 2,
      x: bombBounds.x + bombBounds.width / 2,
      y: bombBounds.y + bombBounds.height / 2,
    };
    await touch(session, "touchStart", [right, bombTouch]);
    await expect(bomb).toHaveClass(/held/);
    await page.waitForTimeout(150);
    await touch(session, "touchEnd", [bombTouch]);
    await expect(bomb).not.toHaveClass(/held/);
    await expect(joystick).toHaveAttribute("data-direction", "right");
    const actionTouch = {
      id: 3,
      x: actionBounds.x + actionBounds.width / 2,
      y: actionBounds.y + actionBounds.height / 2,
    };
    await touch(session, "touchStart", [right, actionTouch]);
    await page.waitForTimeout(100);
    await touch(session, "touchEnd", [actionTouch]);
    await expect(joystick).toHaveAttribute("data-direction", "right");
    await touch(session, "touchEnd");
    await expect(joystick).not.toHaveClass(/engaged/);
    await expect(joystick).toHaveAttribute("data-direction", "");
    // An off-center touch becomes the neutral origin; a short slide starts moving.
    const offCenter = { ...center, x: joystickBounds.x + 18, y: center.y + 18 };
    await touch(session, "touchStart", [offCenter]);
    await expect(joystick).toHaveAttribute("data-direction", "");
    await touch(session, "touchMove", [{ ...offCenter, x: offCenter.x + 6 }]);
    await expect(joystick).toHaveAttribute("data-direction", "right");
    const far = { ...offCenter, x: offCenter.x + 180 };
    await touch(session, "touchMove", [far]);
    await expect(joystick).toHaveAttribute("data-direction", "right");
    await touch(session, "touchMove", [
      { ...far, x: far.x - joystickBounds.width / 4 - 8 },
    ]);
    await expect(joystick).toHaveAttribute("data-direction", "left");
    await touch(session, "touchEnd");
    await expect(joystick).not.toHaveAttribute("style", /--origin/);
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await page.locator("#pause-button").click();
    const downloaded = page.waitForEvent("download");
    await page.locator("#export-replay").click();
    const download = await downloaded;
    const replay = JSON.parse(
      await readFile((await download.path())!, "utf8"),
    ) as { inputs: number[][] };
    expect(
      replay.inputs.some((input) => input[0] === 4 && input[1] === 1),
    ).toBe(true);
    expect(replay.inputs.filter((input) => input[1] === 1)).toHaveLength(1);
    expect(
      replay.inputs.some((input) => input[0] === 4 && input[2] === 1),
    ).toBe(true);
    expect(replay.inputs.filter((input) => input[2] === 1)).toHaveLength(1);
    expect(replay.inputs.at(-1)![0]).toBe(0);
    await context.close();
  });
}

test("touch controls release on cancellation, pause and rotation without a second finger taking over", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:4174/inkblast/",
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await startPractice(page);
  const joystick = page.getByRole("group", { name: "Movement joystick" });
  const bounds = (await joystick.boundingBox())!;
  const first = {
    id: 1,
    x: bounds.x + bounds.width / 2 + 40,
    y: bounds.y + bounds.height / 2,
  };
  const second = { id: 2, x: bounds.x + bounds.width / 2, y: first.y - 35 };
  const session = await context.newCDPSession(page);
  await touch(session, "touchStart", [first]);
  await expect(joystick).toHaveAttribute("data-direction", "");
  const moved = { ...first, x: first.x + 20 };
  await touch(session, "touchMove", [moved]);
  await expect(joystick).toHaveAttribute("data-direction", "right");
  await touch(session, "touchStart", [moved, second]);
  await expect(joystick).toHaveAttribute("data-direction", "right");
  await touch(session, "touchEnd", [first]);
  await expect(joystick).toHaveAttribute("data-direction", "");
  await touch(session, "touchMove", [{ ...second, y: second.y - 10 }]);
  await expect(joystick).toHaveAttribute("data-direction", "");
  await touch(session, "touchEnd");

  await touch(session, "touchStart", [first]);
  await touch(session, "touchCancel");
  await expect(joystick).toHaveAttribute("data-direction", "");
  await expect(joystick).not.toHaveClass(/engaged/);
  await touch(session, "touchStart", [first]);
  await touch(session, "touchMove", [moved]);
  await expect(joystick).toHaveAttribute("data-direction", "right");
  await page.locator("#pause-button").click();
  await expect(joystick).not.toHaveClass(/engaged/);
  await touch(session, "touchEnd");
  await page.locator("#resume-button").click();
  await expect(joystick).toHaveAttribute("data-direction", "");
  await touch(session, "touchStart", [first]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(joystick).not.toHaveClass(/engaged/);
  await expect(joystick).toHaveAttribute("data-direction", "");
  await touch(session, "touchEnd");
  await context.close();
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
]) {
  test(`portrait play is blocked and rotation preserves pause at ${viewport.width} × ${viewport.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:4174/inkblast/",
      viewport,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("./");
    await expect(page.locator("#quick-play")).toBeEnabled();
    await openExtra(page, "practice-button");
    const rotate = page.getByRole("dialog", { name: "TURN UP THE CHAOS." });
    await expect(rotate).toBeVisible();
    await expect(page.locator("#battle")).toHaveAttribute(
      "data-paused",
      "true",
    );
    const phase = await page.locator("#battle").getAttribute("data-phase");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await expect(rotate).toBeVisible();
    await expect(page.locator("#battle")).toHaveAttribute("data-phase", phase!);
    await page.setViewportSize({
      width: viewport.height,
      height: viewport.width,
    });
    await expect(rotate).not.toBeVisible();
    await expect(page.locator("#pause-dialog")).toBeVisible();
    await expect(page.locator("#battle")).toHaveAttribute(
      "data-paused",
      "true",
    );
    await expect(page.locator("#practice-item")).toBeVisible();
    await page.locator("#practice-item").selectOption("kick");
    await page.locator("#practice-give").click();
    await page.locator("#resume-button").click();
    await expect(page.locator("#battle")).toHaveAttribute(
      "data-phase",
      "active",
    );
    await expect(page.locator("#battle")).toHaveAttribute(
      "data-paused",
      "false",
    );
    await expect(
      page.locator(".player-score.red .player-inventory"),
    ).toContainText("KICK");
    const joystick = page.locator("[data-joystick]");
    const box = (await joystick.boundingBox())!;
    const session = await context.newCDPSession(page);
    const point = {
      id: 1,
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    };
    await touch(session, "touchStart", [point]);
    await touch(session, "touchMove", [{ ...point, x: point.x + 20 }]);
    await expect(joystick).toHaveAttribute("data-direction", "right");
    await page.setViewportSize(viewport);
    await expect(rotate).toBeVisible();
    await expect(joystick).not.toHaveClass(/engaged/);
    await expect(joystick).toHaveAttribute("data-direction", "");
    await expect(page.locator("#battle")).toHaveAttribute(
      "data-paused",
      "true",
    );
    await touch(session, "touchEnd");
    await page
      .getByRole("button", { name: "Back to main menu", exact: true })
      .click();
    await expect(page.locator("#home")).toBeVisible();
    await expect(rotate).not.toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
  });
}

for (const insets of [
  { left: 44, right: 0, top: 0, bottom: 21 },
  { left: 0, right: 44, top: 0, bottom: 21 },
]) {
  test(`mobile CPU matches fit simulated safe areas with a ${insets.left ? "left" : "right"} notch`, async ({
    browser,
  }) => {
    const viewport = { width: 844, height: 390 };
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:4174/inkblast/",
      viewport,
      hasTouch: true,
      isMobile: true,
    });
    // Substitute browser-provided inset values because CDP cannot emulate them.
    await context.route("**/*.css", async (route) => {
      const response = await route.fetch();
      const css = (await response.text()).replace(
        /env\(safe-area-inset-(top|right|bottom|left)\)/g,
        (_, side: keyof typeof insets) => `${insets[side]}px`,
      );
      await route.fulfill({ response, body: css });
    });
    const page = await context.newPage();
    await page.goto("./");
    await expect(page.locator("#quick-play")).toBeEnabled();
    await page.locator("#quick-play").click();
    await expect(page.locator("#battle")).toHaveAttribute(
      "data-phase",
      "active",
    );
    await expect(page.locator("#battle-mode")).toBeVisible();
    await expect(page.locator("#battle-mode")).toHaveText("FIRST TO 3");
    for (const selector of [
      "#arena-host",
      ".player-score.red",
      ".player-score.blue",
      "[data-joystick]",
      "[data-control=bomb]",
      "[data-control=action]",
      "#pause-button",
      ".duel-label",
    ]) {
      const box = (await page.locator(selector).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(insets.left);
      expect(box.x + box.width).toBeLessThanOrEqual(
        viewport.width - insets.right,
      );
      expect(box.y + box.height).toBeLessThanOrEqual(
        viewport.height - insets.bottom,
      );
    }
    await page.locator("#pause-button").click();
    const clock = await page.locator("#clock").textContent();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("#rotate-dialog")).toBeVisible();
    await page.waitForTimeout(1100);
    await expect(page.locator("#clock")).toHaveText(clock!);
    await page.setViewportSize(viewport);
    await expect(page.locator("#pause-dialog")).toBeVisible();
    await expect(page.locator("#battle")).toHaveAttribute(
      "data-paused",
      "true",
    );
    await context.close();
  });
}
