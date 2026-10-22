import { DIRECTIONS, VECTOR, blastCells, bombAt, tileAt } from "../core/grid";
import { hasDisease, hazardDirection, movementSpeed } from "../core/simulation";
import { RULES } from "../rules/settings";
import {
  UNIT,
  cellIndex,
  cellOf,
  type Bomb,
  type Direction,
  type GameState,
  type InputFrame,
  type MatchSettings,
  type Player,
  type Point,
} from "../core/types";

interface Danger {
  start: number;
  end: number;
}
interface Route extends Point {
  at: number;
  first: Direction | null;
  distance: number;
}
interface BotMemory {
  goal: Point | null;
  nextPlant: number;
  lastBomb: boolean;
  escaping: boolean;
}
const memories = new WeakMap<GameState, Map<number, BotMemory>>();

function bombFootprint(state: GameState, bomb: Bomb): Point[] {
  const points = new Map<number, Point>();
  let x = bomb.x,
    y = bomb.y,
    direction = bomb.direction;
  const rolling =
    bomb.state === "kicked" ||
    (state.theme.hazard === "conveyor" &&
      state.settings.conveyorSpeed > 0 &&
      hazardDirection(state, x, y) !== null);
  const steps = rolling ? Math.min(40, Math.ceil(bomb.fuse / 7)) : 0;
  for (let step = 0; step <= steps; step++) {
    for (const point of blastCells(state, x, y, bomb.range))
      points.set(cellIndex(point.x, point.y), point);
    const floorDirection = hazardDirection(state, x, y);
    if (floorDirection) direction = floorDirection;
    const vector = VECTOR[direction],
      nx = x + vector.x,
      ny = y + vector.y;
    if (
      tileAt(state.cells, nx, ny) !== "floor" ||
      state.bombs.some(
        (other) =>
          other.id !== bomb.id &&
          other.state !== "airborne" &&
          other.state !== "carried" &&
          other.x === nx &&
          other.y === ny,
      )
    ) {
      if (bomb.kind !== "jelly") break;
      direction = DIRECTIONS[(DIRECTIONS.indexOf(direction) + 2) % 4];
    } else {
      x = nx;
      y = ny;
    }
  }
  return [...points.values()];
}

export function dangerForecast(state: GameState): Map<number, Danger[]> {
  const danger = new Map<number, Danger[]>();
  const mark = (point: Point, start: number, end: number): void => {
    const index = cellIndex(point.x, point.y),
      intervals = danger.get(index) ?? [];
    intervals.push({ start, end });
    danger.set(index, intervals);
  };
  for (const flame of state.flames) mark(flame, 0, flame.until - state.tick);
  const bombs = state.bombs.filter((b) => b.state !== "carried");
  const footprints = new Map(
    bombs.map((bomb) => [bomb.id, bombFootprint(state, bomb)]),
  );
  const times = new Map(
    bombs.map((b) => [b.id, b.kind === "trigger" ? 90 : Math.max(0, b.fuse)]),
  );
  for (let pass = 0; pass < bombs.length; pass++) {
    let changed = false;
    for (const bomb of bombs) {
      const time = times.get(bomb.id)!;
      const points = footprints.get(bomb.id)!;
      for (const other of bombs) {
        if (
          time < times.get(other.id)! &&
          points.some((p) => p.x === other.x && p.y === other.y)
        ) {
          times.set(other.id, time);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  for (const bomb of bombs) {
    const time = times.get(bomb.id)!;
    for (const point of footprints.get(bomb.id)!)
      mark(point, time, time + RULES.flame);
  }
  return danger;
}

const dangerous = (
  danger: Map<number, Danger[]>,
  x: number,
  y: number,
  from: number,
  until: number,
): boolean =>
  (danger.get(cellIndex(x, y)) ?? []).some(
    (d) => d.start <= until && d.end >= from,
  );

function routes(
  state: GameState,
  player: Player,
  danger: Map<number, Danger[]>,
  maxDistance: number,
  extraBomb?: Point,
): Route[] {
  const start: Route = {
    x: cellOf(player.x),
    y: cellOf(player.y),
    at: 0,
    first: null,
    distance: 0,
  };
  const found = [start],
    visited = new Set([cellIndex(start.x, start.y)]);
  const travel = Math.ceil(UNIT / movementSpeed(player));
  for (let index = 0; index < found.length; index++) {
    const node = found[index];
    if (node.distance >= maxDistance) continue;
    for (const direction of DIRECTIONS) {
      const vector = VECTOR[direction],
        x = node.x + vector.x,
        y = node.y + vector.y,
        key = cellIndex(x, y);
      if (
        visited.has(key) ||
        tileAt(state.cells, x, y) !== "floor" ||
        bombAt(state, x, y) ||
        (extraBomb && extraBomb.x === x && extraBomb.y === y)
      )
        continue;
      const at = node.at + travel;
      if (dangerous(danger, x, y, Math.max(0, at - travel / 2), at + travel))
        continue;
      if (
        node.distance > 0 &&
        dangerous(danger, node.x, node.y, node.at, at - travel / 2)
      )
        continue;
      visited.add(key);
      found.push({
        x,
        y,
        at,
        first: node.first ?? direction,
        distance: node.distance + 1,
      });
    }
  }
  return found;
}

function escapeRoute(
  state: GameState,
  player: Player,
  danger: Map<number, Danger[]>,
  hypothetical = false,
): Route | undefined {
  const x = cellOf(player.x),
    y = cellOf(player.y);
  const fuse = hasDisease(player, "shortFuse") ? RULES.fuse / 2 : RULES.fuse;
  const plannedBomb: Bomb = {
    id: -1,
    owner: player.id,
    x,
    y,
    range: hasDisease(player, "weak") ? 1 : player.range,
    fuse,
    state: "resting",
    kind: player.abilities.includes("jelly") ? "jelly" : "regular",
    direction: player.direction,
    travel: 0,
    passThrough: [],
  };
  const forecast = hypothetical
    ? dangerForecast({ ...state, bombs: [...state.bombs, plannedBomb] })
    : danger;
  return routes(
    state,
    player,
    forecast,
    12,
    hypothetical ? { x, y } : undefined,
  )
    .filter(
      (route) =>
        route.distance > 0 &&
        !dangerous(
          forecast,
          route.x,
          route.y,
          route.at,
          Math.max(210, fuse + RULES.flame),
        ),
    )
    .sort((a, b) => a.at - b.at)[0];
}

function usefulPlant(state: GameState, player: Player): boolean {
  const x = cellOf(player.x),
    y = cellOf(player.y),
    enemy = state.players[1 - player.id];
  return blastCells(state, x, y, player.range).some(
    (point) =>
      tileAt(state.cells, point.x, point.y) === "brick" ||
      (enemy.alive &&
        point.x === cellOf(enemy.x) &&
        point.y === cellOf(enemy.y)),
  );
}

function chooseGoal(
  state: GameState,
  player: Player,
  danger: Map<number, Danger[]>,
  difficulty: MatchSettings["difficulty"],
): Route | undefined {
  const enemy = state.players[1 - player.id];
  const depth = difficulty === "hard" ? 24 : difficulty === "easy" ? 9 : 16;
  const options = routes(state, player, danger, depth).filter(
    (route) =>
      route.distance > 0 &&
      !dangerous(danger, route.x, route.y, route.at, route.at + 65),
  );
  const score = (route: Route): number => {
    const pickup = state.pickups.some(
      (item) => item.x === route.x && item.y === route.y,
    );
    const brick = DIRECTIONS.some(
      (direction) =>
        tileAt(
          state.cells,
          route.x + VECTOR[direction].x,
          route.y + VECTOR[direction].y,
        ) === "brick",
    );
    const enemyDistance =
      Math.abs(route.x - cellOf(enemy.x)) + Math.abs(route.y - cellOf(enemy.y));
    const variation =
      ((route.x * 17 +
        route.y * 11 +
        state.seed +
        Math.floor(state.tick / 240)) %
        13) /
      13;
    return (
      (pickup ? 18 : 0) +
      (brick ? 10 : 0) -
      route.distance * 1.15 -
      enemyDistance * 0.35 +
      variation
    );
  };
  return options.sort((a, b) => score(b) - score(a))[0];
}

function followRoute(
  state: GameState,
  player: Player,
  route: Route | undefined,
  memory: BotMemory,
): Direction | null {
  if (memory.goal) {
    const dx = memory.goal.x * UNIT - player.x,
      dy = memory.goal.y * UNIT - player.y;
    if (
      (Math.abs(dx) < 90 && Math.abs(dy) < 90) ||
      tileAt(state.cells, memory.goal.x, memory.goal.y) !== "floor" ||
      bombAt(state, memory.goal.x, memory.goal.y)
    )
      memory.goal = null;
    else
      return Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? "right"
          : "left"
        : dy > 0
          ? "down"
          : "up";
  }
  if (!route?.first) return null;
  const vector = VECTOR[route.first];
  memory.goal = {
    x: cellOf(player.x) + vector.x,
    y: cellOf(player.y) + vector.y,
  };
  return route.first;
}

export function botInput(
  state: GameState,
  playerId: 0 | 1,
  difficulty: MatchSettings["difficulty"],
): InputFrame {
  const player = state.players[playerId];
  if (!player.alive || state.phase !== "active")
    return { direction: null, bomb: false, action: false };
  let players = memories.get(state);
  if (!players) {
    players = new Map();
    memories.set(state, players);
  }
  let memory = players.get(playerId);
  if (!memory) {
    memory = { goal: null, nextPlant: 0, lastBomb: false, escaping: false };
    players.set(playerId, memory);
  }
  const danger = dangerForecast(state),
    x = cellOf(player.x),
    y = cellOf(player.y);
  const urgent = dangerous(danger, x, y, 0, difficulty === "easy" ? 110 : 210);
  if (urgent) {
    const escape = escapeRoute(state, player, danger);
    if (!memory.escaping) memory.goal = null;
    memory.escaping = true;
    memory.lastBomb = false;
    return {
      direction: followRoute(
        state,
        player,
        escape ??
          routes(state, player, danger, 2).find((r) => r.distance === 1),
        memory,
      ),
      bomb: false,
      action: false,
    };
  }
  memory.escaping = false;
  const owned = state.bombs.filter((b) => b.owner === playerId);
  const remote = owned.find((b) => b.kind === "trigger");
  if (remote) {
    const blast = blastCells(state, remote.x, remote.y, remote.range);
    const safe = !blast.some((p) => p.x === x && p.y === y);
    if (
      safe &&
      (blast.some(
        (p) =>
          p.x === cellOf(state.players[1 - playerId].x) &&
          p.y === cellOf(state.players[1 - playerId].y),
      ) ||
        state.tick % 90 === 0)
    )
      return { direction: null, bomb: false, action: true };
  }
  const centered =
    Math.abs(player.x - x * UNIT) <= 100 &&
    Math.abs(player.y - y * UNIT) <= 100;
  if (
    centered &&
    !memory.lastBomb &&
    state.tick >= memory.nextPlant &&
    owned.length < player.capacity &&
    !bombAt(state, x, y) &&
    !hasDisease(player, "noBomb") &&
    usefulPlant(state, player)
  ) {
    const escape = escapeRoute(state, player, danger, true);
    if (escape) {
      memory.goal = null;
      memory.escaping = true;
      memory.nextPlant =
        state.tick +
        (difficulty === "easy" ? 65 : difficulty === "normal" ? 35 : 22);
      memory.lastBomb = true;
      return {
        direction: followRoute(state, player, escape, memory),
        bomb: true,
        action: false,
      };
    }
  }
  memory.lastBomb = false;
  return {
    direction: followRoute(
      state,
      player,
      chooseGoal(state, player, danger, difficulty),
      memory,
    ),
    bomb: false,
    action: false,
  };
}
