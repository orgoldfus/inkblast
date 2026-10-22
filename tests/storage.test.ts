import { describe, expect, it } from "vitest";
import {
  normalizeProgress,
  normalizeSettings,
  saveMap,
  loadMaps,
  deleteMap,
} from "../src/storage/storage";
import { DEFAULT_SETTINGS } from "../src/rules/settings";
import { SCHEMES } from "../src/content/catalog";

describe("device persistence boundaries", () => {
  it("defaults corrupted settings and accepts only bounded recognized fields", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    const settings = normalizeSettings({
      mode: "third-player",
      effects: 20,
      targetScore: 2,
      roundSeconds: 0,
      music: 0,
      randomStarts: true,
      inherited: "ignored",
    });
    expect(settings.mode).toBe("cpu");
    expect(settings.effects).toBe(DEFAULT_SETTINGS.effects);
    expect(settings.targetScore).toBe(2);
    expect(settings.roundSeconds).toBe(0);
    expect(settings.music).toBe(0);
    expect(settings.randomStarts).toBe(true);
    expect(settings).not.toHaveProperty("inherited");
  });
  it("sanitizes local progress rather than trusting imported values", () => {
    expect(
      normalizeProgress({
        played: -2,
        wins: Infinity,
        tourBest: 4,
        seenThemes: ["classic", "classic", {}, "bad id"],
      }),
    ).toEqual({ played: 0, wins: 0, tourBest: 4, seenThemes: ["classic"] });
  });
  it("keeps session maps usable when IndexedDB is unavailable and returns defensive copies", async () => {
    const map = { ...SCHEMES[0], id: "user-test" };
    await saveMap(map);
    const loaded = (await loadMaps()).find((item) => item.id === map.id)!;
    expect(loaded).toBeDefined();
    loaded.cells[0] = "floor";
    expect(
      (await loadMaps()).find((item) => item.id === map.id)!.cells[0],
    ).toBe("wall");
    await deleteMap(map.id);
    expect(
      (await loadMaps()).find((item) => item.id === map.id),
    ).toBeUndefined();
    await expect(
      saveMap({ ...map, spawns: [] } as unknown as typeof map),
    ).rejects.toThrow("exactly two");
  });
});
