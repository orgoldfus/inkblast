import { describe, expect, it } from "vitest";
import { COLS, ROWS } from "../src/core/types";
import { SCHEMES, THEMES } from "../src/content/catalog";
import {
  cloneScheme,
  exportScheme,
  importScheme,
  SchemeImportError,
  validateScheme,
} from "../src/content/schemes";

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
      for (let x = 0; x < COLS; x++) {
        expect(map.cells[x]).toBe("wall");
        expect(map.cells[(ROWS - 1) * COLS + x]).toBe("wall");
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
