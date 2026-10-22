import { expect, it } from "vitest";
import { botInput } from "../src/ai/bot";
import { SCHEMES, THEMES } from "../src/content/catalog";
import { createGame, plantBomb, stepGame } from "../src/core/simulation";
import type { MatchSettings } from "../src/core/types";
import { DEFAULT_SETTINGS } from "../src/rules/settings";
import { createTestGame } from "./core-fixture";

it("sustains every theme/layout combination with bounded entities and CPU work", () => {
  const frameTimes: number[] = [];
  const difficulties: MatchSettings["difficulty"][] = [
    "easy",
    "normal",
    "hard",
  ];
  const summary = {
    combinations: 0,
    frames: 0,
    plants: 0,
    deaths: 0,
    draws: 0,
    minTicks: Infinity,
    maxTicks: 0,
  };
  const earlyRounds: string[] = [];
  for (const [themeIndex, theme] of THEMES.entries())
    for (const [schemeIndex, scheme] of SCHEMES.entries()) {
      const difficulty =
        difficulties[(themeIndex + schemeIndex) % difficulties.length];
      const state = createGame(
        scheme,
        theme,
        {
          ...DEFAULT_SETTINGS,
          roundSeconds: 30,
          enclosureDepth: 5,
          difficulty,
        },
        9000 + themeIndex * 100 + schemeIndex,
      );
      state.phase = "active";
      for (let tick = 0; tick < 4000; tick++) {
        if ((state.phase as string) === "finished") break;
        const start = performance.now();
        stepGame(state, [
          botInput(state, 0, difficulty),
          botInput(state, 1, difficulty),
        ]);
        frameTimes.push(performance.now() - start);
        summary.plants += state.events.filter(
          (event) => event.type === "plant",
        ).length;
        summary.deaths += state.events.filter(
          (event) => event.type === "death",
        ).length;
        for (const player of state.players) {
          expect(Number.isFinite(player.x) && Number.isFinite(player.y)).toBe(
            true,
          );
          expect(
            state.bombs.filter((bomb) => bomb.owner === player.id).length,
          ).toBeLessThanOrEqual(player.capacity);
        }
      }
      expect(
        state.phase,
        `${theme.name} / ${scheme.name} / ${difficulty}`,
      ).toBe("finished");
      summary.combinations++;
      summary.frames += state.tick;
      summary.draws += Number(state.winner === null);
      summary.minTicks = Math.min(summary.minTicks, state.tick);
      summary.maxTicks = Math.max(summary.maxTicks, state.tick);
      if (state.tick < 600)
        earlyRounds.push(
          `${theme.id}/${scheme.id}/${difficulty}:${state.tick}:${state.players.map((player) => player.kills).join(",")}`,
        );
    }
  frameTimes.sort((a, b) => a - b);
  console.info(
    JSON.stringify({
      ...summary,
      earlyRounds,
      cpuP95Ms: frameTimes[Math.floor(frameTimes.length * 0.95)],
      cpuMaxMs: frameTimes.at(-1),
    }),
  );
  expect(summary.combinations).toBe(132);
  expect(summary.plants).toBeGreaterThan(132);
}, 120000);

it("handles maximum-capacity jelly chains with two hard planners", () => {
  const state = createTestGame();
  state.theme = THEMES.find((theme) => theme.hazard === "conveyor")!;
  state.remaining = Infinity;
  for (const player of state.players) {
    player.capacity = 10;
    player.range = 13;
    player.speed = 5;
    player.abilities = ["kick", "punch", "grab", "jelly"];
    player.invulnerableUntil = 10000;
  }
  const times: number[] = [];
  let peakBombs = 0,
    peakFlames = 0;
  for (let tick = 0; tick < 1800; tick++) {
    if (tick % 120 === 0)
      for (let number = 0; number < 20; number++) {
        const bomb = plantBomb(
          state,
          state.players[number < 10 ? 0 : 1],
          2 + (number % 10),
          3 + Math.floor(number / 10) * 4,
        );
        if (bomb) {
          bomb.fuse = 80;
          bomb.state = "kicked";
        }
      }
    const start = performance.now();
    stepGame(state, [botInput(state, 0, "hard"), botInput(state, 1, "hard")]);
    times.push(performance.now() - start);
    peakBombs = Math.max(peakBombs, state.bombs.length);
    peakFlames = Math.max(peakFlames, state.flames.length);
    expect(state.bombs.length).toBeLessThanOrEqual(20);
    expect(state.flames.length).toBeLessThanOrEqual(1100);
  }
  times.sort((a, b) => a - b);
  console.info(
    JSON.stringify({
      stressFrames: times.length,
      peakBombs,
      peakFlames,
      cpuP95Ms: times[Math.floor(times.length * 0.95)],
      cpuMaxMs: times.at(-1),
    }),
  );
  expect(peakBombs).toBe(20);
  expect(peakFlames).toBeGreaterThan(100);
}, 20000);
