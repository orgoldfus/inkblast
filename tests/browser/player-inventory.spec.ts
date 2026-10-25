import { openSettings, openExtra } from "./menu-helpers";
import { expect, test, type Page } from "@playwright/test";

async function giveItem(page: Page, item: string): Promise<void> {
  await page.locator("#practice-item").selectOption(item);
  await page.locator("#practice-give").click();
}

test("all pickup icons load in the field guide", async ({ page }) => {
  await page.goto("./");
  await openExtra(page, "help-button");
  const icons = page.locator(".item-guide img");
  await expect(icons).toHaveCount(13);
  await expect
    .poll(() =>
      icons.evaluateAll((images) =>
        images.every(
          (image) =>
            (image as HTMLImageElement).complete &&
            (image as HTMLImageElement).naturalWidth > 0,
        ),
      ),
    )
    .toBe(true);
});

test("the game's reduced-motion setting keeps temporary icons steady", async ({
  page,
}) => {
  await page.goto("./");
  await openSettings(page);
  await openSettings(page, "audio");
  await page.locator('input[name="reducedMotion"]').check();
  await page.getByRole("button", { name: "START MATCH" }).click();
  await page.locator("#pause-button").click();
  await page.locator("#leave-button").click();
  await openExtra(page, "practice-button");
  await expect(page.locator("#battle")).toHaveAttribute("data-phase", "active");
  await giveItem(page, "superDisease");
  await expect(
    page.locator("#p1-items .inventory-effect img").first(),
  ).toHaveCSS("animation-name", "none");
  await expect(page.locator("#p1-items .effect-time").first()).toBeVisible();
});

test("temporary icons blink without restarting on countdown updates and respect pause and reduced motion", async ({
  page,
}, testInfo) => {
  await page.goto("./");
  await openExtra(page, "practice-button");
  await expect(page.locator("#battle")).toHaveAttribute("data-phase", "active");
  await giveItem(page, "kick");
  const effects = page.locator("#p1-items .inventory-effect");
  for (let attempt = 0; attempt < 30; attempt++) {
    await giveItem(page, "superDisease");
    if (await effects.count()) break;
  }
  const effect = effects.first();
  const icon = effect.locator("img");
  const timer = effect.locator(".effect-time");
  await expect(icon).toHaveCSS("animation-duration", "2.4s");
  await expect(page.locator('#p1-items [data-item="kick"] img')).toHaveCSS(
    "animation-name",
    "none",
  );
  const original = await effect.elementHandle();
  const animation = await icon.evaluateHandle(
    (image) => image.getAnimations()[0],
  );
  const before = await timer.textContent();
  await expect(timer).not.toHaveText(before!);
  expect(await original!.evaluate((node) => node.isConnected)).toBe(true);
  expect(
    await animation.evaluate((entry) => Number(entry.currentTime)),
  ).toBeGreaterThan(500);
  expect(await icon.evaluate((image) => image.getAnimations().length)).toBe(1);
  await expect
    .poll(() =>
      effects
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await page
    .locator(".score-strip")
    .screenshot({ path: testInfo.outputPath("temporary-effects-desktop.png") });

  await page.keyboard.press("Escape");
  await expect(icon).toHaveCSS("animation-play-state", "paused");
  const frozen = await timer.textContent();
  const pausedTime = await animation.evaluate((entry) =>
    Number(entry.currentTime),
  );
  await page.waitForTimeout(1100);
  await expect(timer).toHaveText(frozen!);
  expect(
    await animation.evaluate((entry) => Number(entry.currentTime)),
  ).toBeCloseTo(pausedTime, -2);
  await page.locator("#resume-button").click();
  await expect(icon).toHaveCSS("animation-play-state", "running");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(icon).toHaveCSS("animation-name", "none");
  await expect(timer).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator(".score-strip")
    .screenshot({ path: testInfo.outputPath("temporary-effects-mobile.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("#practice-reset").click();
  await expect(effects).toHaveCount(0);
  await expect(page.locator("#p1-items .inventory-empty")).toBeVisible();
});

test("inventory icons track upgrades, exclusive abilities and reset", async ({
  page,
}, testInfo) => {
  await page.goto("./");
  await openExtra(page, "practice-button");
  await expect(page.locator("#battle")).toHaveAttribute("data-phase", "active");
  const inventory = page.locator("#p1-items");
  await expect(
    inventory.getByRole("group", { name: "Bomb capacity: 1", exact: true }),
  ).toBeVisible();
  await expect(
    inventory.getByRole("group", { name: "Flame range: 2", exact: true }),
  ).toBeVisible();
  await expect(inventory.locator(".inventory-empty")).toBeVisible();

  for (const item of ["bomb", "bomb", "flame", "flame", "kick", "punch"]) {
    await giveItem(page, item);
  }
  await expect(page.locator("#p1-pickup")).toHaveText("");
  await page
    .locator(".score-strip")
    .screenshot({ path: testInfo.outputPath("inventory-selected.png") });
  for (const item of ["skate", "skate", "grab", "spooge", "trigger"]) {
    await giveItem(page, item);
  }
  await expect(
    inventory.getByRole("group", { name: "Bomb capacity: 3", exact: true }),
  ).toBeVisible();
  await expect(
    inventory.getByRole("group", { name: "Flame range: 4", exact: true }),
  ).toBeVisible();
  await expect(inventory.locator(".inventory-power")).toHaveCount(6);
  await expect(inventory.locator('[data-item="skate"]')).toHaveText("SPEED +2");
  await giveItem(page, "kick");
  await expect(inventory.locator('[data-item="kick"]')).toHaveCount(1);
  await giveItem(page, "jelly");
  await expect(inventory.locator('[data-item="trigger"]')).toHaveCount(0);
  await expect(inventory.locator('[data-item="jelly"]')).toBeVisible();
  await giveItem(page, "trigger");
  await expect(inventory.locator('[data-item="jelly"]')).toHaveCount(0);
  await expect(inventory.locator('[data-item="trigger"]')).toBeVisible();
  await expect
    .poll(() =>
      inventory
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);

  await page.locator("#practice-reset").click();
  await expect(inventory.locator(".inventory-power")).toHaveCount(0);
  await expect(
    inventory.getByRole("group", { name: "Bomb capacity: 1", exact: true }),
  ).toBeVisible();
  await expect(
    inventory.getByRole("group", { name: "Flame range: 2", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#p1-pickup")).toHaveText("");
  await expect(page.locator("#p2-items .inventory-power")).toHaveCount(0);
});

test("full inventories remain inside the player panels at narrow widths", async ({
  page,
}, testInfo) => {
  await page.goto("./");
  await openExtra(page, "practice-button");
  await expect(page.locator("#battle")).toHaveAttribute("data-phase", "active");
  for (const item of [
    "bomb",
    "goldflame",
    "skate",
    "kick",
    "punch",
    "grab",
    "spooge",
    "trigger",
  ]) {
    await giveItem(page, item);
  }
  for (const width of [1440, 800, 390, 340]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page.locator(".player-score").evaluateAll((panels) =>
        panels.every((panel) => {
          const bounds = panel.getBoundingClientRect();
          return [
            ...panel.querySelectorAll(
              ".inventory-stat, .inventory-power, .player-name, .score-dots",
            ),
          ].every((element) => {
            const rect = element.getBoundingClientRect();
            return rect.left >= bounds.left && rect.right <= bounds.right;
          });
        }),
      ),
    ).toBe(true);
    await page
      .locator(".score-strip")
      .screenshot({ path: testInfo.outputPath(`inventory-${width}.png`) });
  }
});
