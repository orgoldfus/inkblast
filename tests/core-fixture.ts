import { createGame, stepGame } from "../src/core/simulation";
import {
  COLS,
  ROWS,
  EMPTY_INPUT,
  type Cell,
  type GameState,
  type InputFrame,
  type Scheme,
  type Theme,
} from "../src/core/types";
import { DEFAULT_SETTINGS } from "../src/rules/settings";

export const TEST_THEME: Theme = {
  id: "test",
  name: "Test",
  subtitle: "",
  floor: 0,
  floorAlt: 0,
  wall: 0,
  brick: 0,
  accent: 0,
  hazard: "none",
  music: 0,
};

export function createTestGame(pillars = false): GameState {
  const cells: Cell[] = Array.from({ length: COLS * ROWS }, (_, index) => {
    const x = index % COLS,
      y = Math.floor(index / COLS);
    return x === 0 ||
      y === 0 ||
      x === COLS - 1 ||
      y === ROWS - 1 ||
      (pillars && x % 2 === 0 && y % 2 === 0)
      ? "wall"
      : "floor";
  });
  const scheme: Scheme = {
    id: "test",
    name: "Test",
    description: "",
    cells,
    spawns: [
      { x: 1, y: 1 },
      { x: 13, y: 9 },
    ],
    density: 0,
    startingItems: {},
    itemPool: [],
  };
  const state = createGame(
    scheme,
    TEST_THEME,
    { ...DEFAULT_SETTINGS, mysteryPickups: false },
    123,
  );
  state.phase = "active";
  return state;
}

export function advance(
  state: GameState,
  count: number,
  input: InputFrame = EMPTY_INPUT,
): void {
  for (let tick = 0; tick < count; tick++)
    stepGame(state, [input, EMPTY_INPUT]);
}
