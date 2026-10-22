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
  await expect(page.locator("#arena-host canvas")).toBeVisible();
  await page.locator("#practice-button").click();
  await expect(page.locator("#battle")).toHaveAttribute("data-phase", "active");
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 844, height: 390 },
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
      "Drag the joystick",
    );
    const arenaBounds = (await page.locator("#arena-host").boundingBox())!;
    const joystickBounds = (await joystick.boundingBox())!;
    const bombBounds = (await bomb.boundingBox())!;
    const actionBounds = (await page
      .getByRole("button", { name: "ACTION", exact: true })
      .boundingBox())!;
    const scoreBounds = (await page.locator(".score-strip").boundingBox())!;
    for (const bounds of [
      arenaBounds,
      scoreBounds,
      joystickBounds,
      bombBounds,
      actionBounds,
    ]) {
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
    }
    expect(arenaBounds.width).toBeGreaterThan(200);
    expect(joystickBounds.width).toBeGreaterThanOrEqual(120);
    expect(actionBounds.height).toBeGreaterThanOrEqual(44);
    expect(bombBounds.width).toBeGreaterThanOrEqual(80);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
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
    const right = { ...center, x: center.x + 40 };
    await touch(session, "touchMove", [right]);
    await expect(joystick).toHaveAttribute("data-direction", "right");
    await touch(session, "touchMove", [{ ...right, y: center.y + 42 }]);
    await expect(joystick).toHaveAttribute("data-direction", "right");
    await touch(session, "touchMove", [{ ...center, y: center.y - 45 }]);
    await expect(joystick).toHaveAttribute("data-direction", "up");
    await touch(session, "touchMove", [
      { ...center, x: joystickBounds.x + joystickBounds.width + 30 },
    ]);
    await expect(joystick).toHaveAttribute("data-direction", "right");
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
    viewport: { width: 390, height: 844 },
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
  await expect(joystick).toHaveAttribute("data-direction", "right");
  await touch(session, "touchStart", [first, second]);
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
  await page.locator("#pause-button").click();
  await expect(joystick).not.toHaveClass(/engaged/);
  await touch(session, "touchEnd");
  await page.locator("#resume-button").click();
  await expect(joystick).toHaveAttribute("data-direction", "");
  await touch(session, "touchStart", [first]);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(joystick).not.toHaveClass(/engaged/);
  await expect(joystick).toHaveAttribute("data-direction", "");
  await touch(session, "touchEnd");
  await context.close();
});
