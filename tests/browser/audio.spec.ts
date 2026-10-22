import { expect, test } from "@playwright/test";

interface AudioQA {
  sources: { loop: boolean; duration: number; stopped: boolean }[];
  gains: GainNode[];
}

declare global {
  interface Window {
    audioQA: AudioQA;
  }
}

test("generated local audio decodes, follows mute and pause, and plays through a round", async ({
  page,
}) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/audio/")) requests.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const qa: AudioQA = { sources: [], gains: [] };
    Object.assign(window, { audioQA: qa });
    const createGain = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function () {
      const gain = createGain.call(this);
      qa.gains.push(gain);
      return gain;
    };
    const createSource = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const node = createSource.call(this);
      const start = node.start.bind(node);
      const stop = node.stop.bind(node);
      const record = { loop: false, duration: 0, stopped: false };
      node.start = (...args) => {
        record.loop = node.loop;
        record.duration = node.buffer?.duration ?? 0;
        qa.sources.push(record);
        start(...args);
      };
      node.stop = (...args) => {
        record.stopped = true;
        stop(...args);
      };
      return node;
    };
  });
  const sources = () => page.evaluate(() => window.audioQA.sources);
  await page.goto("./");
  await expect(page.locator("#arena-host canvas")).toBeVisible();
  expect(requests).toEqual([]);
  await page.locator("#custom-button").click();
  await page.locator("select[name=mode]").selectOption("local");
  await page.locator("select[name=targetScore]").selectOption("1");
  await page.getByRole("button", { name: "START MATCH ↗" }).click();
  await expect
    .poll(
      async () => (await sources()).filter((s) => s.loop && !s.stopped).length,
    )
    .toBe(1);
  expect((await sources()).find((s) => s.loop)!.duration).toBeCloseTo(63.84, 1);
  await page.locator("#sound-toggle").click();
  expect(
    await page.evaluate(() =>
      window.audioQA.gains.slice(0, 3).map((gain) => gain.gain.value),
    ),
  ).toEqual([0, 0, 0]);
  await page.locator("#sound-toggle").click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#pause-dialog")).toBeVisible();
  expect((await sources()).filter((s) => s.loop).every((s) => s.stopped)).toBe(
    true,
  );
  await page.locator("#resume-button").click();
  await expect
    .poll(
      async () => (await sources()).filter((s) => s.loop && !s.stopped).length,
    )
    .toBe(1);
  await expect(page.locator("#battle")).toHaveAttribute("data-phase", "active");
  await page.keyboard.press("Space");
  await expect(page.locator("#result-dialog")).toBeVisible({ timeout: 12_000 });
  const played = await sources();
  expect(
    played.some((s) => !s.loop && s.duration > 0.5 && s.duration < 0.7),
  ).toBe(true);
  expect(
    played.some((s) => !s.loop && s.duration > 1.6 && s.duration < 1.9),
  ).toBe(true);
  expect(played.filter((s) => s.loop).every((s) => s.stopped)).toBe(true);
  expect(new Set(requests).size).toBe(4);
  expect(
    requests.every((url) =>
      url.startsWith("http://127.0.0.1:4174/inkblast/audio/"),
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
