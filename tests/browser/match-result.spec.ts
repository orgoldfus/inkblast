import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_SETTINGS } from "../../src/rules/settings";

test.use({ hasTouch: true });

async function startDuel(
  page: Page,
  targetScore = 1,
  solo = false,
): Promise<void> {
  await page.addInitScript(
    (settings) => {
      localStorage.setItem(
        "inkblast.settings.v1",
        JSON.stringify({ version: 1, settings }),
      );
    },
    {
      ...DEFAULT_SETTINGS,
      targetScore,
      mode: solo ? "cpu" : "local",
      difficulty: "easy",
      winnerBonus: false,
    },
  );
  await page.goto("./");
  await expect(page.locator("#quick-play")).toBeEnabled();
  await page.locator(solo ? "#quick-play" : "#local-play").click();
}

async function finishRound(page: Page, bomb = "Space"): Promise<void> {
  await expect(page.locator("#battle")).toHaveAttribute("data-phase", "active");
  await page.keyboard.press(bomb);
  await expect(page.locator("#result-dialog")).toBeVisible({ timeout: 12_000 });
}

test("the third win becomes a match finale and a new match resets the round flow", async ({
  page,
}) => {
  await startDuel(page, 3);
  for (let score = 1; score <= 3; score++) {
    await finishRound(page);
    await expect(page.locator("#result-p2")).toHaveText(String(score));
    if (score < 3) {
      await expect(page.locator("#result-dialog")).toHaveAttribute(
        "data-outcome",
        "round",
      );
      await expect(page.locator(".finale-score-label")).toBeHidden();
      await expect(page.locator("#next-button")).toHaveText("NEXT ROUND ↗");
      await page.locator("#next-button").click();
    }
  }
  await expect(
    page.getByRole("dialog", { name: "PLAYER TWO WINS!" }),
  ).toHaveClass(/match-finale/);
  await expect(page.locator("#result-copy")).toContainText("Match complete.");
  await expect(page.locator(".finale-score-label")).toBeVisible();
  await expect(page.locator("#next-button")).toHaveText("NEW MATCH ↗");
  await expect(page.locator("#next-button")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("#result-home")).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(page.locator("#result-dialog")).toBeHidden();
  await expect(page.locator("#round-label")).toHaveText("ROUND 1");
  await finishRound(page);
  await expect(page.locator("#result-p2")).toHaveText("1");
  await expect(page.locator("#result-dialog")).not.toHaveClass(/match-finale/);
  await page.locator("#result-home").click();
  await expect(page.locator("#home")).toBeVisible();
});

for (const reducedMotion of ["system", "game"] as const) {
  test(`player one finale fits a touch screen and respects ${reducedMotion} reduced motion`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.emulateMedia({
      reducedMotion: reducedMotion === "system" ? "reduce" : "no-preference",
    });
    await startDuel(page);
    if (reducedMotion === "game") {
      await page.keyboard.press("Escape");
      await page.locator("#leave-button").click();
      await page.locator("#custom-button").click();
      await page.locator('[data-settings-link="audio"]').click();
      await page.locator('input[name="reducedMotion"]').check();
      await page
        .getByRole("button", { name: "START MATCH", exact: true })
        .click();
    }
    await finishRound(page, "Enter");
    await expect(page.locator("#result-title")).toHaveText("PLAYER ONE WINS!");
    expect(
      await page
        .locator(".result-emblem")
        .evaluate((element) => getComputedStyle(element).animationName),
    ).toBe("none");
    const dialog = page.locator("#result-dialog");
    const bounds = await dialog.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(390);
    expect(
      await dialog.evaluate(
        (element) => element.scrollHeight <= element.clientHeight + 1,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("#rotate-dialog")).toBeHidden();
    await expect(page.locator("#result-home")).toBeInViewport();
    await page.locator("#result-home").click();
    await expect(page.locator("#home")).toBeVisible();
  });
}

test("losing a solo match explicitly says YOU LOSE and offers a new match", async ({
  page,
}) => {
  await startDuel(page, 1, true);
  await finishRound(page);
  await expect(page.locator("#result-title")).toHaveText("YOU LOSE");
  await expect(page.locator("#result-dialog")).toHaveAttribute(
    "data-outcome",
    "defeat",
  );
  await expect(page.locator(".finale-confetti")).toBeHidden();
  await expect(page.locator("#result-copy")).toContainText("Match complete.");
  await page.locator("#result-setup").click();
  await expect(page.locator("#setup-dialog")).toBeVisible();
});

for (const { scores, mode, title } of [
  { scores: [3, 0], mode: "local", title: "PLAYER ONE WINS!" },
  { scores: [1, 0], mode: "local", title: "MATCH DRAW!" },
  { scores: [3, 0], mode: "cpu", title: "YOU WIN!" },
]) {
  test(`${mode} tour finale at ${scores.join("–")} shows ${title}`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ settings, scores }) => {
        localStorage.setItem(
          "inkblast.tour.v1",
          JSON.stringify({ version: 1, round: 4, settings, scores }),
        );
      },
      {
        settings: { ...DEFAULT_SETTINGS, mode, winnerBonus: false },
        scores,
      },
    );
    await page.goto("./");
    await expect(page.locator("#quick-play")).toBeEnabled();
    await page.locator("#tour-menu").click();
    await page.locator("#resume-tour").click();
    await finishRound(page);
    await expect(page.locator("#result-title")).toHaveText(title);
    await expect(page.locator("#result-copy")).toContainText("Tour complete.");
    await expect(page.locator("#next-button")).toHaveText("NEW TOUR ↗");
  });
}
