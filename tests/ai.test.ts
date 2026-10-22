import { describe, expect, it } from "vitest";
import { botInput, dangerForecast } from "../src/ai/bot";
import { createGame, plantBomb, stepGame } from "../src/core/simulation";
import { COLS, ROWS, UNIT, cellIndex } from "../src/core/types";
import { DEFAULT_SETTINGS } from "../src/rules/settings";
import { SCHEMES, THEMES } from "../src/content/catalog";
import { createTestGame } from "./core-fixture";

const arena = () => createTestGame(true);

describe("observable tactical bot", () => {
  it("propagates an early fuse through a chain forecast", () => {
    const state = arena(),
      player = state.players[0];
    player.capacity = 2;
    plantBomb(state, player, 3, 3)!.fuse = 20;
    plantBomb(state, player, 5, 3)!.fuse = 150;
    expect(dangerForecast(state).get(cellIndex(7, 3))?.[0].start).toBe(20);
  });

  it("refuses to plant with no escape route", () => {
    const state = arena();
    state.cells[cellIndex(2, 1)] = "brick";
    state.cells[cellIndex(1, 2)] = "wall";
    expect(botInput(state, 0, "hard").bomb).toBe(false);
  });

  it.each(["easy", "normal", "hard"] as const)(
    "escapes a planted bomb before its fuse expires on %s",
    (difficulty) => {
      const state = arena(),
        player = state.players[0];
      plantBomb(state, player)!.fuse = 100;
      for (let tick = 0; tick < 150; tick++)
        stepGame(state, [
          botInput(state, 0, difficulty),
          { direction: null, bomb: false, action: false },
        ]);
      expect(player.alive).toBe(true);
      expect(
        Math.abs(player.x - UNIT) + Math.abs(player.y - UNIT),
      ).toBeGreaterThan(2 * UNIT);
    },
  );

  it("never uses hidden pickup placement to make decisions", () => {
    const a = arena(),
      b = arena();
    a.hiddenItems = { 30: "bomb" };
    b.hiddenItems = { 130: "disease" };
    for (let tick = 0; tick < 100; tick++) {
      const left = botInput(a, 0, "normal"),
        right = botInput(b, 0, "normal");
      expect(left).toEqual(right);
      const idle = { direction: null, bomb: false, action: false } as const;
      stepGame(a, [left, idle]);
      stepGame(b, [right, idle]);
    }
  });

  it("makes progress through a demolition map without exceeding bomb capacity", () => {
    const state = arena();
    for (let y = 1; y < ROWS - 1; y++)
      for (let x = 1; x < COLS - 1; x++) {
        if (
          state.cells[cellIndex(x, y)] === "floor" &&
          x > 2 &&
          x < 12 &&
          (x + y) % 3 === 0
        )
          state.cells[cellIndex(x, y)] = "brick";
      }
    const before = state.cells.filter((c) => c === "brick").length;
    for (let tick = 0; tick < 3600 && state.phase !== "finished"; tick++) {
      stepGame(state, [
        botInput(state, 0, "hard"),
        botInput(state, 1, "normal"),
      ]);
      for (const player of state.players)
        expect(
          state.bombs.filter((b) => b.owner === player.id).length,
        ).toBeLessThanOrEqual(player.capacity);
    }
    expect(state.cells.filter((c) => c === "brick").length).toBeLessThan(
      before,
    );
    expect(
      state.players.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
    ).toBe(true);
  });

  it("plays every curated layout with finite positions and active demolition", () => {
    let totalPlants = 0;
    const outcomes: string[] = [];
    for (const [index, scheme] of SCHEMES.entries()) {
      const state = createGame(
        scheme,
        THEMES[index % THEMES.length],
        { ...DEFAULT_SETTINGS, roundSeconds: 60 },
        700 + index,
      );
      state.phase = "active";
      let plants = 0;
      for (let tick = 0; tick < 6000; tick++) {
        if ((state.phase as string) === "finished") break;
        stepGame(state, [
          botInput(state, 0, "hard"),
          botInput(state, 1, "normal"),
        ]);
        plants += state.events.filter((e) => e.type === "plant").length;
      }
      totalPlants += plants;
      outcomes.push(
        `${scheme.name}: ${state.phase}, ${plants} bombs, ${state.tick} ticks`,
      );
      expect(
        state.players.every(
          (player) => Number.isFinite(player.x) && Number.isFinite(player.y),
        ),
      ).toBe(true);
      expect(state.phase).toBe("finished");
      if (scheme.id === "classic") expect(state.tick).toBeGreaterThan(600);
    }
    expect(totalPlants).toBeGreaterThan(SCHEMES.length);
    console.info(outcomes.join("\n"));
  }, 20000);

  it("does not plant while halfway through a cell and needing to turn", () => {
    const state = arena(),
      player = state.players[0];
    player.x = 1500;
    state.cells[cellIndex(1, 2)] = "brick";
    expect(botInput(state, 0, "normal").bomb).toBe(false);
  });
});
