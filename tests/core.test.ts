import { describe, expect, it } from "vitest";
import {
  applyItem,
  createGame,
  movementSpeed,
  plantBomb,
  stepGame,
} from "../src/core/simulation";
import { awardWinnerBonus } from "../src/rules/bonus";
import { DEFAULT_SETTINGS, RULES } from "../src/rules/settings";
import {
  UNIT,
  EMPTY_INPUT,
  cellIndex,
  type Cell,
  type InputFrame,
  type Scheme,
} from "../src/core/types";
import {
  advance,
  createTestGame as arena,
  TEST_THEME as theme,
} from "./core-fixture";

describe("deterministic battle simulation", () => {
  it("keeps movement inside walls and assists a slightly off-center turn", () => {
    const state = arena(),
      player = state.players[0];
    advance(state, 60, { direction: "left", bomb: false, action: false });
    expect(player.x).toBeGreaterThanOrEqual(UNIT - 220);
    player.x = 3 * UNIT;
    player.y = UNIT + 200;
    state.cells[cellIndex(3, 2)] = "wall";
    advance(state, 12, { direction: "right", bomb: false, action: false });
    expect(player.y).toBe(UNIT);
    expect(player.x).toBeGreaterThan(3 * UNIT);
  });

  it("lets an owner leave a planted bomb and prevents re-entry", () => {
    const state = arena();
    plantBomb(state, state.players[0]);
    advance(state, 20, { direction: "right", bomb: false, action: false });
    const bomb = state.bombs[0];
    expect(bomb.passThrough).not.toContain(0);
    advance(state, 20, { direction: "left", bomb: false, action: false });
    expect(state.players[0].x).toBeGreaterThanOrEqual(UNIT + 720);
    expect(state.bombs).toHaveLength(1);
  });

  it("chains in stable order, releases capacity and stops at bricks", () => {
    const state = arena(),
      player = state.players[0];
    player.capacity = 3;
    player.range = 4;
    const first = plantBomb(state, player, 3, 3)!;
    plantBomb(state, player, 5, 3);
    state.cells[cellIndex(7, 3)] = "brick";
    state.hiddenItems[cellIndex(7, 3)] = "flame";
    first.fuse = 1;
    advance(state, 1);
    expect(state.bombs).toHaveLength(0);
    expect(
      state.events.filter((e) => e.type === "explode").map((e) => e.x),
    ).toEqual([3, 5]);
    expect(state.cells[cellIndex(7, 3)]).toBe("floor");
    expect(state.flames.some((f) => f.x === 8 && f.y === 3)).toBe(false);
    expect(state.pickups).toContainEqual({ x: 7, y: 3, type: "flame" });
    expect(plantBomb(state, player, 4, 5)).toBeDefined();
  });

  it("allows a late second death during resolution and emits results once", () => {
    const state = arena();
    const first = plantBomb(state, state.players[0])!;
    const second = plantBomb(state, state.players[1])!;
    first.fuse = 1;
    second.fuse = 30;
    advance(state, 1);
    expect(state.phase).toBe("resolving");
    advance(state, RULES.resolution);
    expect(state.phase).toBe("finished");
    expect(state.winner).toBeNull();
    expect(state.players.every((p) => !p.alive)).toBe(true);
    advance(state, 1);
    expect(state.events).toEqual([]);
  });

  it("implements all inventory families with caps and trigger/jelly exclusion", () => {
    const state = arena(),
      player = state.players[0];
    for (let i = 0; i < 20; i++)
      for (const item of ["bomb", "flame", "skate"] as const)
        applyItem(state, player, item);
    expect(player.capacity).toBe(RULES.maxCapacity);
    expect(player.range).toBe(RULES.maxRange);
    expect(player.speed).toBe(RULES.maxSpeed);
    for (const item of [
      "goldflame",
      "kick",
      "punch",
      "grab",
      "spooge",
      "trigger",
      "jelly",
    ] as const)
      applyItem(state, player, item);
    expect(player.abilities).toContain("jelly");
    expect(player.abilities).not.toContain("trigger");
    applyItem(state, player, "superDisease");
    expect(player.diseases.length).toBeGreaterThanOrEqual(2);
  });

  it("detonates trigger bombs with action and converts them after owner death", () => {
    const state = arena(),
      player = state.players[0];
    applyItem(state, player, "trigger");
    const remote = plantBomb(state, player, 3, 3)!;
    advance(state, 180);
    expect(state.bombs).toHaveLength(1);
    stepGame(state, [{ ...EMPTY_INPUT, action: true }, EMPTY_INPUT]);
    expect(state.bombs).toHaveLength(0);
    expect(state.flames.some((f) => f.x === remote.x && f.y === remote.y)).toBe(
      true,
    );
  });

  it("supports carrying then throwing across obstacles", () => {
    const state = arena(),
      player = state.players[0];
    applyItem(state, player, "grab");
    const bomb = plantBomb(state, player)!;
    stepGame(state, [{ ...EMPTY_INPUT, action: true }, EMPTY_INPUT]);
    expect(player.carrying).toBe(bomb.id);
    expect(bomb.state).toBe("carried");
    advance(state, 1);
    stepGame(state, [{ ...EMPTY_INPUT, action: true }, EMPTY_INPUT]);
    expect(player.carrying).toBeNull();
    expect(bomb.state).toBe("airborne");
    expect(bomb.x).toBe(4);
    advance(state, 25);
    expect(bomb.state).toBe("resting");
  });

  it("expires and spreads diseases, blocks planting and reverses movement", () => {
    const state = arena(),
      player = state.players[0];
    player.diseases = [
      { type: "noBomb", until: 10 },
      { type: "reverse", until: 10 },
    ];
    expect(plantBomb(state, player)).toBeUndefined();
    player.x = 3 * UNIT;
    advance(state, 1, { direction: "right", bomb: false, action: false });
    expect(player.x).toBeLessThan(3 * UNIT);
    advance(state, 10);
    expect(player.diseases).toEqual([]);
    expect(plantBomb(state, player)).toBeDefined();
  });

  it("warps players only on usable exits and enforces a cooldown", () => {
    const state = arena(),
      player = state.players[0];
    state.theme = { ...theme, hazard: "warp" };
    player.x = 3 * UNIT;
    advance(state, 1);
    expect([player.x, player.y]).toEqual([3 * UNIT, UNIT]);
    advance(state, 9);
    expect([player.x, player.y]).toEqual([11 * UNIT, 9 * UNIT]);
    advance(state, 20);
    expect([player.x, player.y]).toEqual([11 * UNIT, 9 * UNIT]);
  });

  it("warns then closes the arena sequentially and crushes occupied cells", () => {
    const state = arena();
    state.remaining = 1;
    advance(state, 1);
    expect(state.hurry).toBe(true);
    expect(state.cells[cellIndex(1, 1)]).toBe("wall");
    expect(state.players[0].alive).toBe(false);
  });

  it("replays identical inputs with identical gameplay state", () => {
    const a = arena(),
      b = arena();
    for (let tick = 0; tick < 400; tick++) {
      const direction = (["right", "down", "left", "up"] as const)[
        Math.floor(tick / 30) % 4
      ];
      const input: [InputFrame, InputFrame] = [
        { direction, bomb: tick % 70 === 0, action: false },
        EMPTY_INPUT,
      ];
      stepGame(a, input);
      stepGame(b, input);
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("rejects malformed or unbounded imported values at the simulation boundary", () => {
    const state = arena(),
      scheme = state.scheme;
    expect(() =>
      createGame(
        { ...scheme, cells: ["lava" as Cell, ...scheme.cells.slice(1)] },
        theme,
        DEFAULT_SETTINGS,
      ),
    ).toThrow();
    expect(() =>
      createGame({ ...scheme, density: Infinity }, theme, DEFAULT_SETTINGS),
    ).toThrow();
    expect(() =>
      createGame(
        { ...scheme, startingItems: { bomb: 100_000 } },
        theme,
        DEFAULT_SETTINGS,
      ),
    ).toThrow();
    expect(() =>
      createGame(
        { ...scheme, itemPool: ["bogus"] as unknown as Scheme["itemPool"] },
        theme,
        DEFAULT_SETTINGS,
      ),
    ).toThrow();
    expect(() =>
      createGame(scheme, theme, {
        ...DEFAULT_SETTINGS,
        roundSeconds: Infinity,
      }),
    ).toThrow();
    expect(() =>
      createGame(scheme, theme, { ...DEFAULT_SETTINGS, enclosureDepth: 80 }),
    ).toThrow();
    expect(() =>
      createGame(scheme, theme, { ...DEFAULT_SETTINGS, effects: NaN }),
    ).toThrow();
  });

  it("credits a chain victim to the chained bomb owner rather than its initiator", () => {
    const state = arena();
    state.players[0].x = 5 * UNIT;
    state.players[0].y = 5 * UNIT;
    plantBomb(state, state.players[0], 3, 3)!.fuse = 1;
    plantBomb(state, state.players[1], 5, 3);
    advance(state, 1);
    expect(state.players[0].kills).toBe(0);
    expect(state.players[1].kills).toBe(1);
    expect(state.events.filter((event) => event.type === "death")).toHaveLength(
      1,
    );
    advance(state, 10);
    expect(state.events.filter((event) => event.type === "death")).toHaveLength(
      0,
    );
    expect(state.players.map((p) => p.kills)).toEqual([0, 1]);
  });

  it("counts a suicide once while overlapping flames persist", () => {
    const state = arena();
    plantBomb(state, state.players[0])!.fuse = 1;
    advance(state, 1);
    expect(state.players[0].kills).toBe(-1);
    advance(state, 20);
    expect(state.players[0].kills).toBe(-1);
  });

  it("lets a carried bomb fuse expire and credits the blast to its owner", () => {
    const state = arena(),
      player = state.players[0];
    applyItem(state, player, "grab");
    const bomb = plantBomb(state, state.players[1], 1, 1)!;
    bomb.fuse = 3;
    stepGame(state, [{ ...EMPTY_INPUT, action: true }, EMPTY_INPUT]);
    expect(player.carrying).toBe(bomb.id);
    advance(state, 2);
    expect(player.alive).toBe(false);
    expect(player.carrying).toBeNull();
    expect(state.bombs).toHaveLength(0);
    expect(state.players[1].kills).toBe(1);
  });

  it("converts an eliminated owner’s remote bombs into short timed bombs", () => {
    const state = arena(),
      player = state.players[0];
    applyItem(state, player, "trigger");
    const bomb = plantBomb(state, player, 5, 5)!;
    state.flames.push({ x: 1, y: 1, until: 30, owner: 1 });
    advance(state, 1);
    expect(bomb.kind).toBe("regular");
    expect(bomb.fuse).toBe(90);
    expect(player.alive).toBe(false);
  });

  it("punches across the full board on maps with open edge cells", () => {
    const state = arena(),
      player = state.players[0];
    state.cells.fill("floor");
    player.x = 14 * UNIT;
    player.y = 5 * UNIT;
    player.direction = "right";
    applyItem(state, player, "punch");
    const bomb = plantBomb(state, player)!;
    stepGame(state, [{ ...EMPTY_INPUT, action: true }, EMPTY_INPUT]);
    expect(bomb.state).toBe("airborne");
    expect(bomb.x).toBe(2);
    advance(state, 24);
    expect(bomb.state).toBe("resting");
    expect(bomb.x).toBe(2);
  });

  it("kicks a bomb, stops it with action and reflects a jelly bomb from a wall", () => {
    const state = arena(),
      player = state.players[0];
    applyItem(state, player, "kick");
    const bomb = plantBomb(state, player, 2, 1)!;
    advance(state, 8, { direction: "right", bomb: false, action: false });
    expect(bomb.state).toBe("kicked");
    expect(bomb.x).toBeGreaterThan(2);
    stepGame(state, [{ ...EMPTY_INPUT, action: true }, EMPTY_INPUT]);
    expect(bomb.state).toBe("resting");
    bomb.kind = "jelly";
    bomb.x = 13;
    bomb.state = "kicked";
    bomb.direction = "right";
    bomb.travel = 0;
    advance(state, 1);
    expect(bomb.direction).toBe("left");
  });

  it("honors slow/fast, no-bomb/automatic and weak/goldflame precedence", () => {
    const state = arena(),
      player = state.players[0];
    player.diseases = ["slow", "fast", "noBomb", "autoBomb", "weak"].map(
      (type) => ({
        type: type as (typeof player.diseases)[number]["type"],
        until: 100,
      }),
    );
    applyItem(state, player, "goldflame");
    expect(movementSpeed(player)).toBe(35);
    advance(state, 10);
    expect(state.bombs).toHaveLength(0);
    player.diseases = player.diseases.filter(
      (disease) => disease.type !== "noBomb",
    );
    advance(state, 40);
    expect(state.bombs[0].range).toBe(1);
    player.diseases = [{ type: "fast", until: 100 }];
    expect(movementSpeed(player)).toBe(155);
  });

  it("auto-plants at different rates and halves short-fuse time", () => {
    const normal = arena(),
      fast = arena();
    normal.players[0].capacity = 10;
    fast.players[0].capacity = 10;
    normal.players[0].diseases = [{ type: "autoBomb", until: 1000 }];
    fast.players[0].diseases = [
      { type: "fastBomb", until: 1000 },
      { type: "shortFuse", until: 1000 },
    ];
    advance(normal, 50, { direction: "right", bomb: false, action: false });
    advance(fast, 50, { direction: "right", bomb: false, action: false });
    expect(fast.bombs.length).toBeGreaterThan(normal.bombs.length);
    expect(fast.bombs[0].fuse).toBeLessThan(40);
  });

  it("transmits a disease without renewing its duration and handles position swap", () => {
    const state = arena();
    state.players[1].x = 1200;
    state.players[1].y = 1000;
    state.players[0].diseases = [{ type: "slow", until: 200 }];
    advance(state, 60);
    expect(state.players[1].diseases).toContainEqual({
      type: "slow",
      until: 200,
    });
    const otherX = state.players[1].x;
    state.scheme = {
      ...state.scheme,
      randomPool: ["disease"],
      itemPool: ["disease"],
    };
    for (let attempt = 0; attempt < 100; attempt++) {
      applyItem(state, state.players[0], "disease");
      if (state.players[0].x === otherX) break;
    }
    expect(state.players[0].x).toBe(otherX);
  });

  it("applies Random eligibility, fixed hidden-item counts, and a no-op empty pool", () => {
    const fixture = arena();
    const scheme = {
      ...fixture.scheme,
      cells: [...fixture.cells],
      density: 100,
      itemPool: ["random"] as const,
      randomPool: ["kick"] as const,
      itemOverrides: { random: 3 },
    };
    for (let x = 3; x < 12; x++) scheme.cells[cellIndex(x, 3)] = "brick";
    const state = createGame(
      {
        ...scheme,
        itemPool: [...scheme.itemPool],
        randomPool: [...scheme.randomPool],
      },
      theme,
      DEFAULT_SETTINGS,
      10,
    );
    expect(Object.values(state.hiddenItems)).toEqual([
      "random",
      "random",
      "random",
    ]);
    applyItem(state, state.players[0], "random");
    expect(state.players[0].abilities).toEqual(["kick"]);
    state.scheme = { ...state.scheme, randomPool: [] };
    const before = structuredClone(state.players[0]);
    applyItem(state, state.players[0], "random");
    expect(state.players[0]).toEqual(before);
  });

  it("makes trampoline hops distinct from warps and prevents actions in flight", () => {
    const state = arena(),
      player = state.players[0];
    state.theme = { ...theme, hazard: "trampoline" };
    player.x = 3 * UNIT;
    player.y = 5 * UNIT;
    advance(state, 1);
    const transit = state.runtime!.transits[0]!;
    expect(transit.type).toBe("jump");
    expect(transit.until - transit.started).toBe(30);
    state.flames.push({ x: 3, y: 5, until: 20, owner: 1 });
    advance(state, 10, { direction: "right", bomb: true, action: true });
    expect(player.alive).toBe(true);
    expect(state.bombs).toHaveLength(0);
    expect([player.x, player.y]).toEqual([3 * UNIT, 5 * UNIT]);
    advance(state, 5);
    expect(player.x).not.toBe(3 * UNIT);
    expect(player.y).not.toBe(5 * UNIT);
    expect(Math.abs(player.x - 3 * UNIT)).toBeLessThanOrEqual(2 * UNIT);
  });

  it("delays human steering on hockey while the computer moves immediately", () => {
    const state = arena();
    state.theme = { ...theme, id: "hockey", hazard: "delay" };
    const input: InputFrame = { direction: "left", bomb: false, action: false };
    stepGame(state, [{ ...input, direction: "right" }, input]);
    expect(state.players[0].x).toBe(UNIT);
    expect(state.players[1].x).toBeLessThan(13 * UNIT);
    advance(state, 15, { direction: "right", bomb: false, action: false });
    expect(state.players[0].x).toBeGreaterThan(UNIT);
  });

  it("includes a persistent roulette speed penalty and preserves inventory exclusions", () => {
    const state = arena(),
      player = state.players[0];
    expect(awardWinnerBonus(state, 0, "speedPenalty")).toBe("speedPenalty");
    expect(player.speed).toBe(-1);
    expect(movementSpeed(player)).toBeLessThan(RULES.baseSpeed);
    awardWinnerBonus(state, 0, "trigger");
    for (let count = 0; count < 100; count++) {
      const bonus = awardWinnerBonus(state, 0);
      expect(bonus).not.toBe("jelly");
    }
    expect(player.abilities).not.toContain("jelly");
    expect(player.speed).toBeGreaterThanOrEqual(-2);
  });

  it("applies carryover bonuses to a fresh round without overflowing caps or conflicting bomb kinds", () => {
    const state = arena(),
      player = state.players[0];
    player.capacity = RULES.maxCapacity;
    player.range = RULES.maxRange;
    player.speed = RULES.maxSpeed;
    for (const bonus of ["bomb", "flame", "skate"] as const)
      awardWinnerBonus(state, 0, bonus);
    expect([player.capacity, player.range, player.speed]).toEqual([
      RULES.maxCapacity,
      RULES.maxRange,
      RULES.maxSpeed,
    ]);
    const next = createGame(
      { ...state.scheme, startingItems: { jelly: 1 } },
      theme,
      DEFAULT_SETTINGS,
      27,
    );
    awardWinnerBonus(next, 0, "trigger");
    expect(next.players[0].abilities).toContain("trigger");
    expect(next.players[0].abilities).not.toContain("jelly");
    awardWinnerBonus(next, 1, "speedPenalty");
    expect(next.players[1].speed).toBe(-1);
    expect(next.players[1].diseases).toEqual([]);
  });

  it("closes imported open perimeter cells before descending through interior rings", () => {
    const fixture = arena();
    const state = createGame(
      {
        ...fixture.scheme,
        cells: fixture.cells.map(() => "floor"),
        spawns: [
          { x: 0, y: 0 },
          { x: 14, y: 10 },
        ],
      },
      theme,
      DEFAULT_SETTINGS,
      1,
    );
    state.phase = "active";
    state.remaining = 1;
    advance(state, 1);
    expect(state.cells[cellIndex(0, 0)]).toBe("wall");
    expect(state.players[0].alive).toBe(false);
    expect(state.closingDepth).toBe(0);
  });

  it("redirects rolling bombs on arrows and carries both bombs and players on conveyors", () => {
    const arrows = arena();
    arrows.theme = { ...theme, hazard: "arrows" };
    const rolling = plantBomb(arrows, arrows.players[0], 7, 1)!;
    rolling.state = "kicked";
    rolling.direction = "up";
    rolling.travel = 100;
    advance(arrows, 1);
    expect(rolling.direction).toBe("right");
    const conveyor = arena();
    conveyor.theme = { ...theme, hazard: "conveyor" };
    conveyor.players[0].x = 5 * UNIT;
    conveyor.players[0].y = 3 * UNIT;
    const resting = plantBomb(conveyor, conveyor.players[0], 3, 1)!;
    advance(conveyor, 1);
    expect(resting.state).toBe("kicked");
    expect(resting.direction).toBe("right");
    expect(conveyor.players[0].x).toBeLessThan(5 * UNIT);
    advance(conveyor, 18);
    expect(resting.x).toBeGreaterThan(3);
  });

  it("regenerates demolished haunted bricks after four seconds when the tile is vacant", () => {
    const state = arena();
    state.theme = { ...theme, hazard: "regenerate" };
    state.cells[cellIndex(3, 3)] = "brick";
    plantBomb(state, state.players[0], 3, 5)!.fuse = 1;
    advance(state, 1);
    expect(state.cells[cellIndex(3, 3)]).toBe("floor");
    advance(state, 240);
    expect(state.cells[cellIndex(3, 3)]).toBe("brick");
  });
});
