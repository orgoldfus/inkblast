import type { MatchSettings } from "../core/types";
import { normalizeSettings } from "./storage";

export interface TourCheckpoint {
  round: number;
  scores: [number, number];
  settings: MatchSettings;
}
const KEY = "inkblast.tour.v1";
export function loadTour(): TourCheckpoint | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (
      !value ||
      value.version !== 1 ||
      !Number.isInteger(value.round) ||
      value.round < 0 ||
      value.round > 4 ||
      !Array.isArray(value.scores) ||
      value.scores.length !== 2 ||
      !value.scores.every(
        (score: unknown) =>
          typeof score === "number" &&
          Number.isInteger(score) &&
          Math.abs(score) <= 100,
      )
    )
      return null;
    return {
      round: value.round,
      scores: value.scores,
      settings: normalizeSettings(value.settings),
    };
  } catch {
    return null;
  }
}
export function saveTour(checkpoint: TourCheckpoint | null): boolean {
  try {
    if (checkpoint)
      localStorage.setItem(KEY, JSON.stringify({ version: 1, ...checkpoint }));
    else localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}
