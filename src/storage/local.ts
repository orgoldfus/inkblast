import type { MatchSettings, Scheme } from "../core/types";
import { DEFAULT_SETTINGS } from "../rules/settings";
import { cloneScheme, validateScheme } from "../content/schemes";

const SETTINGS_KEY = "inkblast.settings.v1";
const DB_NAME = "inkblast-local";
export interface Progress {
  played: number;
  wins: number;
  tourBest: number;
  seenThemes: string[];
}
const EMPTY_PROGRESS: Progress = {
  played: 0,
  wins: 0,
  tourBest: 0,
  seenThemes: [],
};
let database: Promise<IDBDatabase> | undefined;
let memorySettings = { ...DEFAULT_SETTINGS };
const memoryMaps = new Map<string, Scheme>();
let memoryProgress = { ...EMPTY_PROGRESS, seenThemes: [] as string[] };
export let storageWarning = "";

export function normalizeSettings(value: unknown): MatchSettings {
  const settings = { ...DEFAULT_SETTINGS };
  if (typeof value !== "object" || !value) return settings;
  const input = value as Record<string, unknown>;
  const choices = {
    mode: ["cpu", "local"],
    difficulty: ["easy", "normal", "hard"],
    scoring: ["wins", "kills"],
  };
  for (const key of ["mode", "difficulty", "scoring"] as const)
    if (choices[key].includes(input[key] as never))
      Object.assign(settings, { [key]: input[key] });
  for (const key of ["themeId", "schemeId"] as const)
    if (typeof input[key] === "string" && /^[\w-]{1,80}$/.test(input[key]))
      settings[key] = input[key];
  for (const key of [
    "randomStarts",
    "winnerBonus",
    "destroyDiseases",
    "stompBombs",
    "wally",
    "reducedMotion",
  ] as const)
    if (typeof input[key] === "boolean") settings[key] = input[key];
  const ranges = {
    targetScore: [1, 20],
    roundSeconds: [0, 600],
    enclosureDepth: [0, 5],
    conveyorSpeed: [0, 2],
    music: [0, 1],
    effects: [0, 1],
    voices: [0, 1],
  };
  for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) {
    const n = input[key],
      [min, max] = ranges[key];
    if (
      typeof n === "number" &&
      Number.isFinite(n) &&
      n >= min &&
      n <= max &&
      (["music", "effects", "voices", "conveyorSpeed"].includes(key) ||
        Number.isInteger(n))
    )
      settings[key] = n;
  }
  return settings;
}

export async function loadSettings(): Promise<MatchSettings> {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        version?: number;
        settings?: unknown;
      };
      if (parsed.version === 1)
        memorySettings = normalizeSettings(parsed.settings);
    }
  } catch {
    storageWarning =
      "Settings storage is unavailable. Changes last for this session only.";
  }
  return { ...memorySettings };
}
export async function saveSettings(settings: MatchSettings): Promise<void> {
  memorySettings = normalizeSettings(settings);
  try {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ version: 1, settings: memorySettings }),
    );
  } catch {
    storageWarning =
      "Settings could not be saved on this device. Changes last for this session only.";
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (database) return database;
  database = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("Device storage is unavailable."));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("maps", { keyPath: "id" });
      request.result.createObjectStore("progress");
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        database = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open device storage."));
    request.onblocked = () =>
      reject(new Error("Close other Inkblast tabs to update device storage."));
  });
  return database;
}

async function operate<T>(
  store: "maps" | "progress",
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const request = action(transaction.objectStore(store));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () =>
      reject(
        transaction.error ??
          request.error ??
          new Error("Storage transaction failed."),
      );
    transaction.onabort = () =>
      reject(
        transaction.error ?? new Error("Storage transaction was interrupted."),
      );
  });
}

export async function loadMaps(): Promise<Scheme[]> {
  try {
    const values = await operate<unknown[]>("maps", "readonly", (store) =>
      store.getAll(),
    );
    const maps = values.flatMap((value) => {
      const checked = validateScheme(value);
      return checked.scheme ? [checked.scheme] : [];
    });
    maps.forEach((map) => memoryMaps.set(map.id, map));
  } catch {
    storageWarning =
      "Map storage is unavailable. Export JSON to keep a backup; changes last for this session only.";
  }
  return [...memoryMaps.values()].map(cloneScheme);
}
export async function saveMap(scheme: Scheme): Promise<void> {
  const checked = validateScheme(scheme);
  if (!checked.scheme) throw new Error(checked.errors.join(" "));
  memoryMaps.set(scheme.id, checked.scheme);
  try {
    await operate("maps", "readwrite", (store) => store.put(checked.scheme));
  } catch {
    storageWarning =
      "Map saved for this session only. Device storage failed; export JSON to keep your work.";
  }
}
export async function deleteMap(id: string): Promise<void> {
  try {
    await operate("maps", "readwrite", (store) => store.delete(id));
  } catch {
    storageWarning =
      "Device storage failed. This map may reappear after reload.";
  }
  memoryMaps.delete(id);
}

export function normalizeProgress(value: unknown): Progress {
  const result: Progress = { ...EMPTY_PROGRESS, seenThemes: [] };
  if (!value || typeof value !== "object") return result;
  const source = value as Record<string, unknown>;
  for (const key of ["played", "wins", "tourBest"] as const)
    if (
      typeof source[key] === "number" &&
      Number.isInteger(source[key]) &&
      source[key] >= 0 &&
      source[key] <= 1_000_000
    )
      result[key] = source[key];
  if (Array.isArray(source.seenThemes))
    result.seenThemes = [
      ...new Set(
        source.seenThemes.filter(
          (t): t is string => typeof t === "string" && /^[\w-]{1,80}$/.test(t),
        ),
      ),
    ].slice(0, 100);
  return result;
}
export async function loadProgress(): Promise<Progress> {
  try {
    memoryProgress = normalizeProgress(
      await operate("progress", "readonly", (store) => store.get("record")),
    );
  } catch {
    storageWarning =
      "Progress is available for this session only; device storage is unavailable.";
  }
  return { ...memoryProgress, seenThemes: [...memoryProgress.seenThemes] };
}
export async function saveProgress(progress: Progress): Promise<void> {
  memoryProgress = normalizeProgress(progress);
  try {
    await operate("progress", "readwrite", (store) =>
      store.put(memoryProgress, "record"),
    );
  } catch {
    storageWarning =
      "Progress could not be saved on this device; it lasts for this session only.";
  }
}
