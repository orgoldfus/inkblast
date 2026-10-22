export const COLS = 15;
export const ROWS = 11;
export const UNIT = 1000;
export const TICK_RATE = 60;
export type Cell = "floor" | "wall" | "brick";
export type Direction = "up" | "down" | "left" | "right";
export type ItemType =
  | "bomb"
  | "flame"
  | "goldflame"
  | "skate"
  | "kick"
  | "punch"
  | "grab"
  | "spooge"
  | "trigger"
  | "jelly"
  | "disease"
  | "superDisease"
  | "random";
export type Disease =
  | "slow"
  | "fast"
  | "noBomb"
  | "autoBomb"
  | "weak"
  | "fastBomb"
  | "shortFuse"
  | "swap"
  | "reverse";
export type Hazard =
  | "none"
  | "arrows"
  | "conveyor"
  | "warp"
  | "trampoline"
  | "delay"
  | "regenerate";
export interface Point {
  x: number;
  y: number;
}
export interface Scheme {
  id: string;
  name: string;
  description: string;
  cells: Cell[];
  spawns: [Point, Point];
  density: number;
  startingItems: Partial<Record<ItemType, number>>;
  itemPool: ItemType[];
  itemOverrides?: Partial<Record<ItemType, number>>;
  randomPool?: ItemType[];
  curated?: boolean;
}
export interface Theme {
  id: string;
  name: string;
  subtitle: string;
  floor: number;
  floorAlt: number;
  wall: number;
  brick: number;
  accent: number;
  hazard: Hazard;
  music: number;
}
export interface MatchSettings {
  mode: "cpu" | "local";
  difficulty: "easy" | "normal" | "hard";
  themeId: string;
  schemeId: string;
  targetScore: number;
  scoring: "wins" | "kills";
  roundSeconds: number;
  enclosureDepth: number;
  mysteryPickups: boolean;
  randomStarts: boolean;
  winnerBonus: boolean;
  destroyDiseases: boolean;
  conveyorSpeed: number;
  stompBombs: boolean;
  wally: boolean;
  music: number;
  effects: number;
  voices: number;
  reducedMotion: boolean;
}
export interface Player {
  id: 0 | 1;
  x: number;
  y: number;
  direction: Direction;
  alive: boolean;
  capacity: number;
  range: number;
  speed: number;
  abilities: ItemType[];
  diseases: { type: Disease; until: number }[];
  pickupFeedback?: { item: ItemType; diseases: Disease[]; until: number };
  carrying: number | null;
  kills: number;
  invulnerableUntil: number;
}
export interface Bomb {
  id: number;
  owner: 0 | 1;
  x: number;
  y: number;
  range: number;
  fuse: number;
  kind: "regular" | "trigger" | "jelly";
  state: "resting" | "kicked" | "airborne" | "carried";
  direction: Direction;
  travel: number;
  passThrough: number[];
}
export interface Flame {
  x: number;
  y: number;
  until: number;
  owner: 0 | 1;
}
export interface Pickup extends Point {
  type: ItemType;
}
export interface GameEvent {
  type:
    | "plant"
    | "explode"
    | "pickup"
    | "death"
    | "kick"
    | "throw"
    | "hurry"
    | "result"
    | "warp";
  x?: number;
  y?: number;
  player?: number;
  item?: ItemType;
}
export interface InputFrame {
  direction: Direction | null;
  bomb: boolean;
  action: boolean;
}
export interface Transit {
  type: "warp" | "jump";
  started: number;
  transferAt: number;
  until: number;
  targetX: number;
  targetY: number;
  transferred: boolean;
}
export interface PlayerMove {
  fromX: number;
  fromY: number;
  targetX: number;
  targetY: number;
  direction: Direction;
  duration: number;
  elapsed: number;
  queuedDirection: Direction | null;
}
export interface SimulationRuntime {
  lastBomb: [boolean, boolean];
  lastAction: [boolean, boolean];
  warpUntil: [number, number];
  stunUntil: [number, number];
  autoPlantAt: [number, number];
  regen: { index: number; at: number }[];
  closureAt: number;
  closureStep: number;
  perimeterClosed: boolean;
  transits: [Transit | null, Transit | null];
  moves: [PlayerMove | null, PlayerMove | null];
  directionHistory: [Array<Direction | null>, Array<Direction | null>];
}
export interface GameState {
  tick: number;
  seed: number;
  rng: number;
  cells: Cell[];
  initialCells: Cell[];
  players: [Player, Player];
  bombs: Bomb[];
  flames: Flame[];
  pickups: Pickup[];
  events: GameEvent[];
  theme: Theme;
  scheme: Scheme;
  settings: MatchSettings;
  phase: "countdown" | "active" | "resolving" | "finished";
  countdown: number;
  remaining: number;
  resolution: number;
  winner: 0 | 1 | null;
  nextBombId: number;
  closingDepth: number;
  hurry: boolean;
  hiddenItems: Record<number, ItemType>;
  runtime?: SimulationRuntime;
}
export const EMPTY_INPUT: InputFrame = {
  direction: null,
  bomb: false,
  action: false,
};
export const cellIndex = (x: number, y: number): number => y * COLS + x;
export const cellOf = (value: number): number => Math.round(value / UNIT);
