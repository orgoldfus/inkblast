import { describe, expect, it } from "vitest";
import {
  COLS,
  ROWS,
  UNIT,
  cellIndex,
  type Cell,
  type Point,
} from "../src/core/types";
import { DIRECTIONS, VECTOR, blastCells, inBounds } from "../src/core/grid";
import { createGame } from "../src/core/simulation";
import { DEFAULT_SETTINGS, RULES } from "../src/rules/settings";
import { SCHEMES, THEMES } from "../src/content/catalog";
import {
  cloneScheme,
  exportScheme,
  importScheme,
  SchemeImportError,
  validateScheme,
} from "../src/content/schemes";

function walkDistances(
  cells: Cell[],
  start: Point,
  allowBricks = false,
  blocked = -1,
): Map<number, number> {
  const distances = new Map([[cellIndex(start.x, start.y), 0]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const point = queue[i];
    const distance = distances.get(cellIndex(point.x, point.y))!;
    for (const direction of DIRECTIONS) {
      const vector = VECTOR[direction];
      const next = { x: point.x + vector.x, y: point.y + vector.y };
      const index = cellIndex(next.x, next.y);
      if (
        !inBounds(next.x, next.y) ||
        index === blocked ||
        distances.has(index) ||
        cells[index] === "wall" ||
        (!allowBricks && cells[index] === "brick")
      )
        continue;
      distances.set(index, distance + 1);
      queue.push(next);
    }
  }
  return distances;
}

describe("curated content", () => {
  it("provides eleven original named themes and twelve individually valid duel adaptations", () => {
    expect(THEMES).toHaveLength(11);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(11);
    expect(SCHEMES).toHaveLength(12);
    expect(new Set(SCHEMES.map((s) => s.cells.join(""))).size).toBe(12);
    for (const scheme of SCHEMES)
      expect(validateScheme(scheme).errors, scheme.name).toEqual([]);
  });
  it("gives both players rotationally symmetric geometry and open starts", () => {
    for (const map of SCHEMES) {
      expect(map.cells).toEqual([...map.cells].reverse());
      expect(map.spawns[1], map.name).toEqual({
        x: COLS - 1 - map.spawns[0].x,
        y: ROWS - 1 - map.spawns[0].y,
      });
      for (let x = 0; x < COLS; x++) {
        expect(map.cells[x]).toBe("wall");
        expect(map.cells[(ROWS - 1) * COLS + x]).toBe("wall");
      }
      for (let y = 0; y < ROWS; y++) {
        expect(map.cells[y * COLS]).toBe("wall");
        expect(map.cells[y * COLS + COLS - 1]).toBe("wall");
      }
    }
  });
  it("offers equal opening space and a safe first-bomb escape at maximum density", () => {
    for (const map of SCHEMES) {
      const game = createGame(
        { ...map, density: 100 },
        THEMES[0],
        { ...DEFAULT_SETTINGS, randomStarts: false },
        123,
      );
      const spaces = map.spawns.map((start, seat) => {
        const distances = walkDistances(game.cells, start);
        const danger = new Set(
          blastCells(game, start.x, start.y, game.players[seat].range).map(
            (point) => cellIndex(point.x, point.y),
          ),
        );
        const escapeDistance = Math.min(
          ...[...distances].flatMap(([index, distance]) =>
            danger.has(index) ? [] : [distance],
          ),
        );
        const exits = [...distances.values()].filter(
          (distance) => distance === 1,
        );
        expect(
          exits.length,
          `${map.name}, seat ${seat}: exits`,
        ).toBeGreaterThanOrEqual(2);
        expect(
          escapeDistance * Math.ceil(UNIT / RULES.baseSpeed),
          `${map.name}, seat ${seat}: escape before the first bomb explodes`,
        ).toBeLessThan(RULES.fuse);
        return { size: distances.size, escapeDistance };
      });
      expect(spaces[0], map.name).toEqual(spaces[1]);
    }
  });
  it("keeps all destructible territory reachable and avoids a single permanent meeting choke", () => {
    for (const map of SCHEMES) {
      const [start, target] = map.spawns;
      const reachable = walkDistances(map.cells, start, true);
      const territory = map.cells.filter((cell) => cell !== "wall").length;
      expect(reachable.size, map.name).toBe(territory);
      const startIndex = cellIndex(start.x, start.y);
      const targetIndex = cellIndex(target.x, target.y);
      for (const index of reachable.keys()) {
        if (index === startIndex || index === targetIndex) continue;
        expect(
          walkDistances(map.cells, start, true, index).has(targetIndex),
          `${map.name}: alternate route around ${index % COLS},${Math.floor(index / COLS)}`,
        ).toBe(true);
      }
    }
  });
  it("keeps seeded rubble and loot independent of which player owns a start", () => {
    for (const map of SCHEMES) {
      for (const seed of [1, 0x9e3779b9, 0x6d2b79f5, 0xffffffff]) {
        const settings = { ...DEFAULT_SETTINGS, randomStarts: false };
        const original = createGame(map, THEMES[0], settings, seed);
        const swapped = createGame(
          { ...map, spawns: [map.spawns[1], map.spawns[0]] },
          THEMES[0],
          settings,
          seed,
        );
        expect(swapped.cells, `${map.name}, seed ${seed}`).toEqual(
          original.cells,
        );
        expect(swapped.hiddenItems, `${map.name}, seed ${seed}`).toEqual(
          original.hiddenItems,
        );
        for (const seat of [0, 1]) {
          expect([swapped.players[seat].x, swapped.players[seat].y]).toEqual([
            original.players[1 - seat].x,
            original.players[1 - seat].y,
          ]);
        }
      }
    }
  });
});

describe("bounded map validation", () => {
  it("rejects a third player, blocked starts, disconnected duels and malformed tiles", () => {
    const map = cloneScheme(SCHEMES[0]);
    expect(
      validateScheme({
        ...map,
        spawns: [...map.spawns, { x: 3, y: 3 }],
      }).errors.join(" "),
    ).toContain("exactly two");
    map.cells[16] = "wall";
    expect(validateScheme(map).errors.join(" ")).toContain("floor");
    const split = cloneScheme(SCHEMES[0]);
    for (let y = 0; y < ROWS; y++) split.cells[y * COLS + 7] = "wall";
    expect(validateScheme(split).errors.join(" ")).toContain(
      "Solid walls separate",
    );
    expect(validateScheme({ ...split, cells: ["floor"] }).valid).toBe(false);
  });
  it("rejects unsafe ranges, duplicate items and invalid starting diseases", () => {
    expect(validateScheme({ ...SCHEMES[0], density: NaN }).valid).toBe(false);
    expect(
      validateScheme({ ...SCHEMES[0], startingItems: { disease: 1 } }).valid,
    ).toBe(false);
    expect(
      validateScheme({ ...SCHEMES[0], itemPool: ["bomb", "bomb"] }).valid,
    ).toBe(false);
    expect(
      validateScheme({ ...SCHEMES[0], itemOverrides: { bomb: -101 } }).valid,
    ).toBe(false);
    expect(
      validateScheme({ ...SCHEMES[0], randomPool: ["random"] }).valid,
    ).toBe(false);
  });
  it("does not propagate unknown properties or imported prototype data", () => {
    const checked = validateScheme({
      ...SCHEMES[0],
      injected: "payload",
      __proto__: { attacker: true },
    });
    expect(checked.scheme).not.toHaveProperty("injected");
    expect(checked.scheme).not.toHaveProperty("attacker");
  });
});

describe("local map file interchange", () => {
  it("roundtrips versioned JSON including extended item configuration without mutating source", () => {
    const map = cloneScheme(SCHEMES[0]);
    map.itemOverrides = { bomb: 4, disease: -3 };
    map.randomPool = ["bomb", "flame"];
    const imported = importScheme(exportScheme(map));
    expect(imported).toEqual({ ...map, id: imported.id, curated: undefined });
    expect(imported.id).not.toBe(map.id);
    imported.cells[0] = "floor";
    expect(map.cells[0]).toBe("wall");
  });
  it("reads and writes original version-2 row and powerup records with original item numbering", () => {
    const map = cloneScheme(SCHEMES[0]);
    map.startingItems = { kick: 1, punch: 1 };
    map.itemOverrides = { disease: -3, bomb: 4 };
    map.randomPool = ["bomb", "flame"];
    const text = exportScheme(map, "sch");
    expect(text).toContain("-P,3,1");
    const imported = importScheme(text);
    expect(imported.cells).toEqual(map.cells);
    expect(imported.spawns).toEqual(map.spawns);
    expect(imported.startingItems).toEqual(map.startingItems);
    expect(imported.itemOverrides).toEqual(map.itemOverrides);
    expect(imported.randomPool).toEqual(map.randomPool);
  });
  it("requires choosing two starts from a larger original scheme and supports negative coordinates", () => {
    let text = exportScheme(SCHEMES[0], "sch").replace(
      "-S,1,13,9,0",
      "-S,1,-2,-2,0",
    );
    text += "-S,2,1,9,0\r\n";
    try {
      importScheme(text);
      throw new Error("Expected selection request");
    } catch (error) {
      expect(error).toBeInstanceOf(SchemeImportError);
      expect((error as SchemeImportError).starts).toHaveLength(3);
    }
    expect(importScheme(text, [0, 1]).spawns[1]).toEqual({ x: 13, y: 9 });
    expect(() => importScheme(text, [1, 1])).toThrow("two different");
  });
  it("rejects malformed rows, unsupported versions, team layouts, oversize and invalid JSON", () => {
    const text = exportScheme(SCHEMES[0], "sch");
    expect(() => importScheme(text.replace("-V,2", "-V,3"))).toThrow(
      "version 2",
    );
    expect(() => importScheme(`${text}-R,0,###############`)).toThrow("unique");
    expect(() =>
      importScheme(text.replace("Classic Clash", "Teams (1)(1)")),
    ).toThrow("team-only");
    expect(() => importScheme("x".repeat(100_001))).toThrow("100 KB");
    expect(() => importScheme("{broken")).toThrow("malformed");
    expect(() =>
      importScheme('{"format":"inkblast-scheme","version":9}'),
    ).toThrow("Unsupported");
  });
});
