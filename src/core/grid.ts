import {
  COLS,
  ROWS,
  cellIndex,
  type Bomb,
  type Cell,
  type Direction,
  type GameState,
  type Point,
} from "./types";

export const DIRECTIONS: Direction[] = ["up", "right", "down", "left"];
export const VECTOR: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};
export const opposite = (direction: Direction): Direction =>
  DIRECTIONS[(DIRECTIONS.indexOf(direction) + 2) % 4];
export const inBounds = (x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < COLS && y < ROWS;
export const tileAt = (cells: Cell[], x: number, y: number): Cell =>
  inBounds(x, y) ? cells[cellIndex(x, y)] : "wall";
export const bombAt = (
  state: GameState,
  x: number,
  y: number,
): Bomb | undefined =>
  state.bombs.find(
    (b) =>
      b.x === x && b.y === y && b.state !== "airborne" && b.state !== "carried",
  );

export function blastCells(
  state: Pick<GameState, "cells">,
  x: number,
  y: number,
  range: number,
): Point[] {
  const points: Point[] = [{ x, y }];
  for (const direction of DIRECTIONS) {
    const vector = VECTOR[direction];
    for (let distance = 1; distance <= range; distance++) {
      const next = { x: x + vector.x * distance, y: y + vector.y * distance };
      const tile = tileAt(state.cells, next.x, next.y);
      if (tile === "wall") break;
      points.push(next);
      if (tile === "brick") break;
    }
  }
  return points;
}
