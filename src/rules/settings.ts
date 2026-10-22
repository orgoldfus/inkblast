import type { MatchSettings } from "../core/types";

export const DEFAULT_SETTINGS: MatchSettings = {
  mode: "cpu",
  difficulty: "normal",
  themeId: "classic",
  schemeId: "classic",
  targetScore: 3,
  scoring: "wins",
  roundSeconds: 180,
  enclosureDepth: 4,
  randomStarts: false,
  winnerBonus: true,
  destroyDiseases: true,
  conveyorSpeed: 1,
  stompBombs: true,
  wally: false,
  music: 0.35,
  effects: 0.65,
  voices: 0.5,
  reducedMotion: false,
};

// These elapsed-time values are Inkblast's fixed-step profile; original timing parity is unresolved.
export const RULES = {
  fuse: 150,
  flame: 30,
  countdown: 150,
  resolution: 90,
  diseaseDuration: 720,
  maxCapacity: 10,
  maxRange: 13,
  maxSpeed: 5,
  bodyRadius: 280,
  baseSpeed: 75,
  speedIncrement: 12,
} as const;
