import { describe, expect, it } from "vitest";
import { botInput, dangerForecast } from "../src/ai/bot";
import { createGame, plantBomb, stepGame } from "../src/core/simulation";
import { COLS, ROWS, UNIT, cellIndex, cellOf } from "../src/core/types";
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

  it.each(["easy", "normal", "hard"] as const)(
    "never uses hidden pickup placement to make decisions on %s",
    (difficulty) => {
      const a = arena(),
        b = arena();
      a.hiddenItems = { 30: "bomb" };
      b.hiddenItems = { 130: "disease" };
      for (let tick = 0; tick < 100; tick++) {
        const left = botInput(a, 0, difficulty),
          right = botInput(b, 0, difficulty);
        expect(left).toEqual(right);
        const idle = { direction: null, bomb: false, action: false } as const;
        stepGame(a, [left, idle]);
        stepGame(b, [right, idle]);
      }
    },
  );

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

  it.each(["easy", "normal", "hard"] as const)(
    "pursues a visible opponent across an open arena on %s",
    (difficulty) => {
      const state = arena();
      let closestDistance = Infinity;
      for (let tick = 0; tick < 360; tick++) {
        stepGame(state, [
          botInput(state, 0, difficulty),
          { direction: null, bomb: false, action: false },
        ]);
        const [player, enemy] = state.players;
        closestDistance = Math.min(
          closestDistance,
          Math.abs(cellOf(player.x) - cellOf(enemy.x)) +
            Math.abs(cellOf(player.y) - cellOf(enemy.y)),
        );
      }
      // After reaching the opponent, the bot can retreat from its own bomb.
      expect(closestDistance).toBeLessThan(6);
    },
  );

  it("takes a detour out of a dead end to reach the opponent", () => {
    const state = arena();
    state.cells.fill("wall");
    for (const [x, y] of [
      [5, 1],
      [5, 2],
      [5, 3],
      [4, 3],
      [3, 3],
      [3, 2],
      [3, 1],
      [2, 1],
      [1, 1],
    ])
      state.cells[cellIndex(x, y)] = "floor";
    state.players[0].x = 5 * UNIT;
    state.players[1].x = UNIT;
    state.players[1].y = UNIT;
    let closestX = 5;
    for (let tick = 0; tick < 180; tick++) {
      stepGame(state, [
        botInput(state, 0, "hard"),
        { direction: null, bomb: false, action: false },
      ]);
      closestX = Math.min(closestX, cellOf(state.players[0].x));
    }
    expect(closestX).toBeLessThan(4);
  });

  it("does not seek a visible disease as an upgrade", () => {
    const state = arena();
    state.pickups = [{ x: 2, y: 1, type: "disease" }];
    expect(botInput(state, 0, "normal").direction).not.toBe("right");
  });

  it("compensates for visible reversed controls when escaping", () => {
    const state = arena(),
      player = state.players[0];
    player.diseases = [{ type: "reverse", until: 500 }];
    plantBomb(state, player)!.fuse = 100;
    for (let tick = 0; tick < 140; tick++)
      stepGame(state, [
        botInput(state, 0, "hard"),
        { direction: null, bomb: false, action: false },
      ]);
    expect(player.alive).toBe(true);
  });

  it("abandons an escape waypoint when new flame blocks it", () => {
    const state = arena(),
      player = state.players[0];
    plantBomb(state, player)!.fuse = 100;
    expect(botInput(state, 0, "hard").direction).toBe("right");
    state.flames.push({ x: 2, y: 1, until: 30, owner: 1 });
    expect(botInput(state, 0, "hard").direction).toBe("down");
  });

  it("forecasts a bomb already touching flame as an immediate chain", () => {
    const state = arena();
    plantBomb(state, state.players[0], 5, 3);
    state.flames = [{ x: 5, y: 3, until: 20, owner: 1 }];
    expect(dangerForecast(state).get(cellIndex(7, 3))?.[0].start).toBe(0);
  });

  it.each([["punch"], ["grab"], ["grab", "punch", "kick"]] as const)(
    "uses %j to escape a trapped bomb through normal action presses",
    (...abilities) => {
      const state = arena(),
        player = state.players[0];
      player.abilities = [...abilities];
      state.cells[cellIndex(1, 2)] = "wall";
      state.cells[cellIndex(3, 1)] = "brick";
      plantBomb(state, player)!.fuse = 12;
      let throws = 0;
      for (let tick = 0; tick < 50; tick++) {
        stepGame(state, [
          botInput(state, 0, "hard"),
          { direction: null, bomb: false, action: false },
        ]);
        throws += state.events.filter((event) => event.type === "throw").length;
      }
      expect(throws).toBe(1);
      expect(player.alive).toBe(true);
    },
  );

  it("uses visible strategy preferences to distinguish easy and hard", () => {
    const decision = (difficulty: "easy" | "hard") => {
      const state = arena();
      state.players[0].x = 3 * UNIT;
      state.players[0].y = 3 * UNIT;
      state.players[1].x = 7 * UNIT;
      state.players[1].y = 3 * UNIT;
      state.cells[cellIndex(1, 3)] = "brick";
      plantBomb(state, state.players[0], 11, 9);
      return botInput(state, 0, difficulty);
    };
    expect(decision("easy").direction).toBe("left");
    expect(decision("hard").direction).toBe("right");
  });

  it("does not punch an imminent bomb into a blast that still reaches itself", () => {
    const state = arena(),
      player = state.players[0];
    player.abilities = ["punch"];
    player.range = 5;
    state.cells[cellIndex(1, 2)] = "wall";
    plantBomb(state, player)!.fuse = 4;
    expect(botInput(state, 0, "hard").action).toBe(false);
  });

  it("refuses remote detonation when a chain would reach itself", () => {
    const state = arena(),
      player = state.players[0];
    player.abilities = ["trigger"];
    plantBomb(state, player, 5, 1);
    plantBomb(state, state.players[1], 3, 1);
    state.players[1].x = 5 * UNIT;
    state.players[1].y = 2 * UNIT;
    expect(botInput(state, 0, "easy").action).toBe(false);
  });

  it.each(["grab", "punch"] as const)(
    "does not accidentally %s while intending to detonate a remote",
    (ability) => {
      const state = arena(),
        player = state.players[0];
      player.abilities = ["trigger", ability];
      plantBomb(state, player, 5, 1);
      plantBomb(state, state.players[1], 2, 1);
      expect(botInput(state, 0, "easy").action).toBe(false);
    },
  );

  it("detonates a safe remote to attack a visible opponent", () => {
    const state = arena(),
      player = state.players[0];
    player.abilities = ["trigger"];
    plantBomb(state, player, 5, 1);
    state.players[1].x = 5 * UNIT;
    state.players[1].y = 2 * UNIT;
    const input = botInput(state, 0, "easy");
    expect(input.action).toBe(true);
    stepGame(state, [input, { direction: null, bomb: false, action: false }]);
    expect(player.alive).toBe(true);
    expect(state.players[1].alive).toBe(false);
  });

  it("does not plant while halfway through a cell and needing to turn", () => {
    const state = arena(),
      player = state.players[0];
    player.x = 1500;
    state.cells[cellIndex(1, 2)] = "brick";
    expect(botInput(state, 0, "normal").bomb).toBe(false);
  });
});
