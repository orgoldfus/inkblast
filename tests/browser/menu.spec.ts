import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page): Promise<void> {
  await page.goto("./");
  await expect(page.locator("#quick-play")).toBeEnabled();
  await expect(page.locator("#quick-play")).toBeFocused();
}

async function press(page: Page, key: string, times = 1): Promise<void> {
  for (let index = 0; index < times; index++) await page.keyboard.press(key);
}

async function options(page: Page): Promise<void> {
  await press(page, "ArrowUp", 2);
  await press(page, "Enter");
  await expect(page.locator('[data-settings-link="match"]')).toBeFocused();
}

test("main menu wraps, restores submenu focus, and starts solo with Enter", async ({
  page,
}) => {
  await ready(page);
  await expect(page.locator("#main-menu button")).toHaveCount(5);
  await expect(page.locator("#arena-host")).toBeHidden();
  await press(page, "ArrowUp");
  await expect(page.locator("#extras-button")).toBeFocused();
  await press(page, "Enter");
  await expect(page.locator("#practice-button")).toBeFocused();
  await press(page, "Escape");
  await expect(page.locator("#extras-button")).toBeFocused();
  await press(page, "ArrowDown");
  await press(page, "Enter");
  await expect(page.locator("#battle")).toBeVisible();
  await expect(page.locator("#p2-name")).toContainText("CPU");
  await press(page, "Escape");
  await press(page, "ArrowDown", 3);
  await expect(page.locator("#leave-button")).toBeFocused();
  await press(page, "Enter");
  await expect(page.locator("#quick-play")).toBeFocused();
});

test("two-player match is one down and Enter away", async ({ page }) => {
  await ready(page);
  await press(page, "ArrowDown");
  await press(page, "Enter");
  await expect(page.locator("#p2-name")).toHaveText("PLAYER TWO");
  await expect(page.locator("#controls-hint .p2-hint")).toBeVisible();
});

test("settings use up/down and Enter, cancel choices, and persist changes", async ({
  page,
}) => {
  await ready(page);
  await options(page);
  await press(page, "Enter");
  const difficulty = page.locator('select[name="difficulty"]');
  await press(page, "ArrowDown");
  await expect(difficulty).toBeFocused();
  await expect(difficulty).toHaveValue("normal");
  await press(page, "Enter");
  await expect(
    page.getByRole("button", { name: "Normal", exact: true }),
  ).toBeFocused();
  await press(page, "ArrowDown");
  await press(page, "Enter");
  await expect(difficulty).toBeFocused();
  await expect(difficulty).toHaveValue("hard");
  await press(page, "Enter");
  await press(page, "ArrowUp");
  await press(page, "Escape");
  await expect(difficulty).toHaveValue("hard");
  await expect(difficulty).toBeFocused();
  await press(page, "Escape");
  await expect(page.locator('[data-settings-link="match"]')).toBeFocused();
  await press(page, "Escape");
  await expect(page.locator("#custom-button")).toBeFocused();
  await page.reload();
  await expect(page.locator("#quick-play")).toBeEnabled();
  await press(page, "Enter");
  await expect(page.locator("#p2-name")).toHaveText("CPU / HARD");
});

test("checkboxes and sound levels need no horizontal keys", async ({
  page,
}) => {
  await ready(page);
  await options(page);
  await press(page, "Enter");
  await press(page, "ArrowDown", 6);
  const mystery = page.locator('input[name="mysteryPickups"]');
  await expect(mystery).toBeFocused();
  await press(page, "Enter");
  await expect(mystery).not.toBeChecked();
  await expect(page.locator("#battle")).toBeHidden();
  await press(page, "Escape");
  await press(page, "ArrowDown", 2);
  await press(page, "Enter");
  await expect(page.locator('input[name="music"]')).toBeFocused();
  await press(page, "Enter");
  await expect(
    page.getByRole("button", { name: "40%", exact: true }),
  ).toBeFocused();
  await press(page, "Enter");
  await expect(page.locator('input[name="music"]')).toHaveValue("0.4");
  await press(page, "ArrowDown", 3);
  const motion = page.locator('input[name="reducedMotion"]');
  await expect(motion).toBeFocused();
  await press(page, "Enter");
  await expect(motion).toBeChecked();
});

test("menus fit desktop and phone and remain usable by touch", async ({
  page,
}) => {
  await ready(page);
  for (const size of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(size);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator("#extras-button")).toBeInViewport();
  }
  await page.locator("#extras-button").click();
  await expect(page.locator("#practice-button")).toBeVisible();
  await page.locator("#help-button").click();
  await expect(page.locator("#help-dialog")).toBeVisible();
  await press(page, "Escape");
  await expect(page.locator("#help-button")).toBeFocused();
});

test("tour checkpoints and key remapping retain their keyboard paths", async ({
  page,
}) => {
  await ready(page);
  await press(page, "ArrowDown", 2);
  await press(page, "Enter");
  await expect(page.locator("#battle-mode")).toHaveText("STOP 1 / 5");
  await press(page, "Escape");
  await press(page, "ArrowDown", 3);
  await press(page, "Enter");
  await press(page, "ArrowDown", 2);
  await press(page, "Enter");
  await expect(page.locator("#resume-tour")).toBeFocused();
  await press(page, "Escape");
  await expect(page.locator("#tour-menu")).toBeFocused();
  await press(page, "ArrowDown");
  await press(page, "Enter");
  await press(page, "ArrowDown");
  await press(page, "Enter");
  await press(page, "ArrowDown", 2);
  const binding = page.locator('[data-binding="0-up"]');
  await expect(binding).toBeFocused();
  await press(page, "Enter");
  await expect(binding).toHaveText("Press a key…");
  await press(page, "Escape");
  await expect(binding).toHaveText("up: W");
  await expect(binding).toBeFocused();
  await expect(page.locator('[data-settings-page="controls"]')).toBeVisible();
});
