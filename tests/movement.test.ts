import { describe, expect, it } from "vitest";
import { movementSpeed, plantBomb, stepGame } from "../src/core/simulation";
import { DIRECTIONS, VECTOR } from "../src/core/grid";
import { EMPTY_INPUT, UNIT, cellIndex } from "../src/core/types";
import { advance, createTestGame } from "./core-fixture";

describe("tile movement", () => {
  it.each([0, 5])(
    "keeps an even pace across tile boundaries at speed %s",
    (speed) => {
      const state = createTestGame();
      const player = state.players[0];
      player.speed = speed;
      const duration = Math.ceil(UNIT / movementSpeed(player));
      const distances: number[] = [];
      for (let tick = 0; tick < duration * 3; tick++) {
        const before = player.x;
        advance(state, 1, { ...EMPTY_INPUT, direction: "right" });
        distances.push(player.x - before);
      }
      expect(player.x).toBe(4 * UNIT);
      expect(
        Math.max(...distances) - Math.min(...distances),
      ).toBeLessThanOrEqual(1);
    },
  );

  it.each(DIRECTIONS)(
    "finishes a brief %s tap at the next center",
    (direction) => {
      const state = createTestGame();
      const player = state.players[0];
      player.x = 5 * UNIT;
      player.y = 5 * UNIT;
      advance(state, 1, { ...EMPTY_INPUT, direction });
      advance(state, 60);
      expect([player.x, player.y]).toEqual([
        (5 + VECTOR[direction].x) * UNIT,
        (5 + VECTOR[direction].y) * UNIT,
      ]);
    },
  );

  it.each([0, 1] as const)(
    "keeps player %s moving while held and centers on release",
    (id) => {
      const state = createTestGame();
      const player = state.players[id];
      player.x = UNIT;
      player.y = 3 * UNIT;
      const ticks = Math.ceil(UNIT / movementSpeed(player));
      for (let tick = 0; tick < ticks * 2 + 1; tick++) {
        const input = { ...EMPTY_INPUT, direction: "right" as const };
        stepGame(state, id === 0 ? [input, EMPTY_INPUT] : [EMPTY_INPUT, input]);
      }
      advance(state, 60);
      expect([player.x, player.y]).toEqual([4 * UNIT, 3 * UNIT]);
    },
  );

  it("buffers a quick corner turn until the current square is complete", () => {
    const state = createTestGame(true);
    const player = state.players[0];
    const ticks = Math.ceil(UNIT / movementSpeed(player));
    advance(state, ticks + 1, { ...EMPTY_INPUT, direction: "right" });
    advance(state, 1, { ...EMPTY_INPUT, direction: "down" });
    expect(player.y).toBe(UNIT);
    advance(state, 60);
    expect([player.x, player.y]).toEqual([3 * UNIT, 2 * UNIT]);
  });

  it("finishes the current square before reversing", () => {
    const state = createTestGame();
    const player = state.players[0];
    advance(state, 1, { ...EMPTY_INPUT, direction: "right" });
    const before = player.x;
    advance(state, 1, { ...EMPTY_INPUT, direction: "left" });
    expect(player.x).toBeGreaterThan(before);
    advance(state, 60);
    expect([player.x, player.y]).toEqual([UNIT, UNIT]);
  });

  it.each(["wall", "brick", "bomb"] as const)(
    "stays centered against a %s and can turn away",
    (obstacle) => {
      const state = createTestGame();
      const player = state.players[0];
      if (obstacle === "bomb") plantBomb(state, state.players[1], 2, 1);
      else state.cells[cellIndex(2, 1)] = obstacle;
      advance(state, 30, { ...EMPTY_INPUT, direction: "right" });
      expect([player.x, player.y]).toEqual([UNIT, UNIT]);
      advance(state, 1, { ...EMPTY_INPUT, direction: "down" });
      advance(state, 30);
      expect([player.x, player.y]).toEqual([UNIT, 2 * UNIT]);
    },
  );

  it.each(["normal", "skate", "slow", "fast"] as const)(
    "lands exactly on a square at %s speed",
    (speed) => {
      const state = createTestGame();
      const player = state.players[0];
      if (speed === "skate") player.speed = 5;
      else if (speed !== "normal")
        player.diseases = [{ type: speed, until: 1000 }];
      const ticks = Math.ceil(UNIT / movementSpeed(player));
      advance(state, 1, { ...EMPTY_INPUT, direction: "right" });
      advance(state, ticks - 2);
      expect(player.x).toBeLessThan(2 * UNIT);
      advance(state, 1);
      expect(player.x).toBe(2 * UNIT);
      advance(state, 10);
      expect(player.x).toBe(2 * UNIT);
    },
  );

  it("returns to the starting center if a bomb blocks the destination mid-step", () => {
    const state = createTestGame();
    const player = state.players[0];
    advance(state, 1, { ...EMPTY_INPUT, direction: "right" });
    plantBomb(state, state.players[1], 2, 1);
    advance(state, 1);
    expect([player.x, player.y]).toEqual([UNIT, UNIT]);
  });

  it("lets a kick clear a bomb before entering its square", () => {
    const state = createTestGame();
    const player = state.players[0];
    player.abilities.push("kick");
    const bomb = plantBomb(state, state.players[1], 2, 1)!;
    advance(state, 1, { ...EMPTY_INPUT, direction: "right" });
    expect(player.x).toBe(UNIT);
    expect(bomb.x).toBe(3);
    advance(state, 1, { ...EMPTY_INPUT, direction: "right" });
    advance(state, 30);
    expect(player.x).toBe(2 * UNIT);
  });

  it("keeps a perpendicular turn on a conveyor aligned to the grid", () => {
    const state = createTestGame();
    const player = state.players[0];
    state.theme = { ...state.theme, hazard: "conveyor" };
    player.x = 3 * UNIT;
    advance(state, 1, { ...EMPTY_INPUT, direction: "down" });
    advance(state, 60);
    expect([player.x, player.y]).toEqual([3 * UNIT, 2 * UNIT]);
  });

  it("stops conveyor movement at the center before an obstacle", () => {
    const state = createTestGame();
    const player = state.players[0];
    state.theme = { ...state.theme, hazard: "conveyor" };
    player.x = 3 * UNIT;
    state.cells[cellIndex(5, 1)] = "brick";
    advance(state, 100);
    expect([player.x, player.y]).toEqual([4 * UNIT, UNIT]);
  });

  it("completes the step onto a warp before transferring and can move afterward", () => {
    const state = createTestGame();
    const player = state.players[0];
    state.theme = { ...state.theme, hazard: "warp" };
    player.x = 2 * UNIT;
    const ticks = Math.ceil(UNIT / movementSpeed(player));
    advance(state, 1, { ...EMPTY_INPUT, direction: "right" });
    advance(state, ticks - 2);
    expect(state.runtime!.transits[0]).toBeNull();
    advance(state, 1);
    expect(player.x).toBe(3 * UNIT);
    expect(state.runtime!.transits[0]?.type).toBe("warp");
    advance(state, 20);
    advance(state, 1, { ...EMPTY_INPUT, direction: "left" });
    advance(state, 30);
    expect([player.x, player.y]).toEqual([10 * UNIT, 9 * UNIT]);
  });
});
