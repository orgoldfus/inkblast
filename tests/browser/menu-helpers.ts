import { expect, type Page } from "@playwright/test";

export async function openSettings(
  page: Page,
  section = "match",
): Promise<void> {
  if (!(await page.locator("#setup-dialog").isVisible())) {
    await expect(page.locator("#quick-play")).toBeEnabled();
    await page.locator("#custom-button").click();
  }
  const target = page.locator(`[data-settings-page="${section}"]`);
  if (await target.isVisible()) return;
  if (!(await page.locator("#options-menu").isVisible()))
    await page.locator("#options-back").click();
  await page.locator(`[data-settings-link="${section}"]`).click();
}

export async function openExtra(page: Page, id: string): Promise<void> {
  await expect(page.locator("#quick-play")).toBeEnabled();
  if (!(await page.locator("#extras-menu").isVisible()))
    await page.locator("#extras-button").click();
  await page.locator(`#${id}`).click();
}
