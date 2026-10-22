import {
  COLS,
  ROWS,
  cellIndex,
  type Cell,
  type ItemType,
  type Point,
  type Scheme,
} from "../core/types";
import { ITEM_TYPES } from "./catalog";

export interface EditableScheme extends Scheme {
  itemOverrides?: Partial<Record<ItemType, number>>;
  randomPool?: ItemType[];
}
export interface SchemeValidation {
  valid: boolean;
  errors: string[];
  scheme?: EditableScheme;
}
export class SchemeImportError extends Error {
  constructor(
    message: string,
    public starts?: Point[],
  ) {
    super(message);
    this.name = "SchemeImportError";
  }
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max;
const isItem = (item: unknown): item is ItemType =>
  ITEM_TYPES.includes(item as ItemType);
const isPoint = (value: unknown): value is Point =>
  record(value) &&
  integer(value.x, 0, COLS - 1) &&
  integer(value.y, 0, ROWS - 1);

export function validateScheme(value: unknown): SchemeValidation {
  const errors: string[] = [];
  if (!record(value))
    return { valid: false, errors: ["Map must be a JSON object."] };
  if (typeof value.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(value.id))
    errors.push(
      "Map ID must contain 1–80 letters, numbers, hyphens or underscores.",
    );
  if (
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 80
  )
    errors.push("Name must contain 1–80 characters.");
  if (typeof value.description !== "string" || value.description.length > 1000)
    errors.push("Description must contain at most 1,000 characters.");
  const cells = value.cells;
  const validCells =
    Array.isArray(cells) &&
    cells.length === COLS * ROWS &&
    cells.every((c) => ["floor", "wall", "brick"].includes(c));
  if (!validCells)
    errors.push(`Map must have exactly ${COLS * ROWS} valid tiles (15 × 11).`);
  const validSpawns =
    Array.isArray(value.spawns) &&
    value.spawns.length === 2 &&
    value.spawns.every(isPoint);
  if (!validSpawns)
    errors.push(
      "Choose exactly two player starts with integer coordinates inside the map.",
    );
  if (validSpawns && validCells) {
    const [a, b] = value.spawns as [Point, Point];
    if (a.x === b.x && a.y === b.y)
      errors.push("Player starts must occupy different tiles.");
    for (const [i, p] of [a, b].entries()) {
      if (cells[cellIndex(p.x, p.y)] !== "floor")
        errors.push(`Player ${i + 1} must start on a floor tile.`);
      const exits = neighbours(p).filter(
        (n) => cells[cellIndex(n.x, n.y)] === "floor",
      );
      if (!exits.length)
        errors.push(
          `Player ${i + 1} needs an open escape tile beside their start.`,
        );
    }
    const seen = new Set<number>([cellIndex(a.x, a.y)]),
      queue = [a];
    for (let i = 0; i < queue.length; i++)
      for (const n of neighbours(queue[i])) {
        const index = cellIndex(n.x, n.y);
        if (!seen.has(index) && cells[index] !== "wall") {
          seen.add(index);
          queue.push(n);
        }
      }
    if (!seen.has(cellIndex(b.x, b.y)))
      errors.push(
        "Starts must connect through floor or destructible bricks. Solid walls separate these players.",
      );
  }
  if (!integer(value.density, 0, 100))
    errors.push("Brick density must be an integer from 0 to 100.");
  if (
    !record(value.startingItems) ||
    Object.entries(value.startingItems).some(
      ([key, count]) =>
        !isItem(key) ||
        !integer(count, 0, 10) ||
        (["disease", "superDisease", "random"].includes(key) && count !== 0),
    )
  )
    errors.push(
      "Starting inventory accepts known healthy items with integer amounts from 0 to 10.",
    );
  for (const field of ["itemPool", "randomPool"] as const) {
    const pool = value[field];
    if (field === "randomPool" && pool === undefined) continue;
    if (
      !Array.isArray(pool) ||
      pool.length > 13 ||
      !pool.every(isItem) ||
      new Set(pool).size !== pool.length ||
      (field === "randomPool" && pool.includes("random"))
    )
      errors.push(
        `${field} must contain unique known items${field === "randomPool" ? " excluding Random itself" : ""}.`,
      );
  }
  if (
    value.itemOverrides !== undefined &&
    (!record(value.itemOverrides) ||
      Object.entries(value.itemOverrides).some(
        ([key, count]) => !isItem(key) || !integer(count, -100, 100),
      ))
  )
    errors.push(
      "Item overrides must be known items with integer values from −100 to 100.",
    );
  if (errors.length) return { valid: false, errors };
  const scheme: EditableScheme = {
    id: value.id as string,
    name: (value.name as string).trim(),
    description: value.description as string,
    cells: [...(cells as Cell[])],
    spawns: (value.spawns as [Point, Point]).map((p) => ({
      x: p.x,
      y: p.y,
    })) as [Point, Point],
    density: value.density as number,
    startingItems: {
      ...(value.startingItems as EditableScheme["startingItems"]),
    },
    itemPool: [...(value.itemPool as ItemType[])],
  };
  if (value.itemOverrides)
    scheme.itemOverrides = {
      ...(value.itemOverrides as EditableScheme["itemOverrides"]),
    };
  if (value.randomPool)
    scheme.randomPool = [...(value.randomPool as ItemType[])];
  return { valid: true, errors, scheme };
}

function neighbours(p: Point): Point[] {
  return [
    { x: p.x - 1, y: p.y },
    { x: p.x + 1, y: p.y },
    { x: p.x, y: p.y - 1 },
    { x: p.x, y: p.y + 1 },
  ].filter((n) => n.x >= 0 && n.x < COLS && n.y >= 0 && n.y < ROWS);
}
export function mapId(): string {
  return `user-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}
export function cloneScheme(scheme: Scheme): EditableScheme {
  return JSON.parse(JSON.stringify(scheme)) as EditableScheme;
}
const SCH_ITEMS: ItemType[] = [
  "bomb",
  "flame",
  "disease",
  "kick",
  "skate",
  "punch",
  "grab",
  "spooge",
  "goldflame",
  "trigger",
  "jelly",
  "superDisease",
  "random",
];

export function importScheme(
  text: string,
  selectedStarts?: [number, number],
): EditableScheme {
  if (text.length > 100_000)
    throw new SchemeImportError("Map file exceeds the 100 KB limit.");
  let value: unknown;
  if (text.trimStart().startsWith("{")) {
    try {
      value = JSON.parse(text);
    } catch {
      throw new SchemeImportError("This JSON file is malformed.");
    }
    if (record(value) && "format" in value) {
      if (value.format !== "inkblast-scheme" || value.version !== 1)
        throw new SchemeImportError(
          "Unsupported Inkblast map format or version.",
        );
      value = value.scheme;
    }
  } else value = parseSch(text, selectedStarts);
  const result = validateScheme(value);
  if (!result.scheme) throw new SchemeImportError(result.errors.join(" "));
  result.scheme.id = mapId();
  return result.scheme;
}

function parseSch(text: string, selection?: [number, number]): EditableScheme {
  const result: EditableScheme = {
    id: mapId(),
    name: "Imported duel",
    description:
      "Imported Atomic Bomberman scheme, adapted to two participants.",
    density: 100,
    cells: [],
    spawns: [
      { x: 1, y: 1 },
      { x: 13, y: 9 },
    ],
    startingItems: {},
    itemPool: [...ITEM_TYPES],
    randomPool: ITEM_TYPES.filter((t) => t !== "random"),
    itemOverrides: {},
  };
  const rows = new Map<number, Cell[]>(),
    starts = new Map<number, Point>();
  const num = (s: string | undefined): number =>
    s !== undefined && /^-?\d+$/.test(s.trim()) ? Number(s) : NaN;
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (!line.startsWith("-")) continue;
    const [kind, ...fields] = line.split(",");
    if (kind === "-V" && num(fields[0]) !== 2)
      throw new SchemeImportError(
        "Only Atomic Bomberman scheme version 2 is supported.",
      );
    if (kind === "-N") result.name = fields.join(",").trim();
    if (kind === "-B") result.density = num(fields[0]);
    if (kind === "-R") {
      const y = num(fields[0]),
        row = fields[1];
      if (
        !integer(y, 0, ROWS - 1) ||
        rows.has(y) ||
        !row ||
        !/^[#:.]{15}$/.test(row)
      )
        throw new SchemeImportError(
          "Each -R row must be unique, numbered 0–10, and contain exactly 15 # : . tiles.",
        );
      rows.set(
        y,
        [...row].map((c) =>
          c === "#" ? "wall" : c === ":" ? "brick" : "floor",
        ),
      );
    }
    if (kind === "-S") {
      const p = num(fields[0]),
        x = num(fields[1]),
        y = num(fields[2]);
      if (
        !integer(p, 0, 9) ||
        !integer(x, -COLS, COLS - 1) ||
        !integer(y, -ROWS, ROWS - 1) ||
        starts.has(p)
      )
        throw new SchemeImportError(
          "Invalid or repeated player start in -S record.",
        );
      starts.set(p, { x: x < 0 ? COLS + x : x, y: y < 0 ? ROWS + y : y });
    }
    if (kind === "-P") {
      const id = num(fields[0]),
        born = num(fields[1]),
        enabled = num(fields[2]),
        override = num(fields[3]),
        forbidden = fields[4] === undefined ? 0 : num(fields[4]);
      if (
        !integer(id, 0, 12) ||
        !integer(born, 0, 10) ||
        !integer(enabled, 0, 1) ||
        !integer(override, -100, 100) ||
        !integer(forbidden, 0, 1)
      )
        throw new SchemeImportError(
          "Invalid -P power-up record. Supported amounts are −100…100; born-with is 0…10.",
        );
      const type = SCH_ITEMS[id];
      if (born) result.startingItems[type] = born;
      if (enabled) result.itemOverrides![type] = override;
      if (forbidden)
        result.randomPool = result.randomPool!.filter((t) => t !== type);
    }
  }
  if (/\(\d+\)\s*\(\d+\)/.test(result.name))
    throw new SchemeImportError(
      "This is a team-only scheme. Inkblast supports individual duels; use a non-team layout.",
    );
  if (rows.size !== ROWS)
    throw new SchemeImportError("Scheme must define all 11 rows.");
  result.cells = Array.from({ length: ROWS }, (_, y) => rows.get(y)!).flat();
  const candidates = [...starts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, p]) => p);
  if (candidates.length > 2 && !selection)
    throw new SchemeImportError(
      "This map has more than two starts. Choose exactly two to create a duel adaptation.",
      candidates,
    );
  const chosen = selection ?? [0, 1];
  if (
    candidates.length < 2 ||
    chosen[0] === chosen[1] ||
    !candidates[chosen[0]] ||
    !candidates[chosen[1]]
  )
    throw new SchemeImportError("Choose two different valid starts.");
  result.spawns = [candidates[chosen[0]], candidates[chosen[1]]];
  for (const p of result.spawns)
    for (const n of [p, ...neighbours(p)])
      if (result.cells[cellIndex(n.x, n.y)] !== "wall")
        result.cells[cellIndex(n.x, n.y)] = "floor";
  return result;
}

export function exportScheme(
  scheme: Scheme,
  format: "json" | "sch" = "json",
): string {
  const checked = validateScheme(scheme);
  if (!checked.scheme) throw new Error(checked.errors.join(" "));
  const map = checked.scheme;
  if (format === "json")
    return JSON.stringify(
      { format: "inkblast-scheme", version: 1, scheme: map },
      null,
      2,
    );
  if (/[\r\n,]/.test(map.name))
    throw new Error(
      "SCH names cannot contain commas or line breaks. Export JSON to preserve this name.",
    );
  const lines = [
    "; Inkblast two-start duel adaptation. Not an original ten-player scheme.",
    "-V,2",
    `-N,${map.name}`,
    `-B,${map.density}`,
  ];
  for (let y = 0; y < ROWS; y++)
    lines.push(
      `-R,${y},${map.cells
        .slice(y * COLS, (y + 1) * COLS)
        .map((c) => (c === "wall" ? "#" : c === "brick" ? ":" : "."))
        .join("")}`,
    );
  map.spawns.forEach((p, i) => lines.push(`-S,${i},${p.x},${p.y},0`));
  SCH_ITEMS.forEach((t, i) => {
    const override =
      map.itemOverrides?.[t] ?? (map.itemPool.includes(t) ? undefined : 0);
    lines.push(
      `-P,${i},${map.startingItems[t] ?? 0},${override === undefined ? 0 : 1},${override ?? 0},${t !== "random" && map.randomPool && !map.randomPool.includes(t) ? 1 : 0}`,
    );
  });
  return `${lines.join("\r\n")}\r\n`;
}
