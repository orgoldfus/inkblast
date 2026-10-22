import {
  DIRECTIONS,
  VECTOR,
  blastCells,
  bombAt,
  opposite,
  tileAt,
} from "../core/grid";
import {
  hasDisease,
  hazardDirection,
  movementSpeed,
  projectThrow,
} from "../core/simulation";
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
  lastAction: boolean;
  escaping: boolean;
}
const memories = new WeakMap<GameState, Map<number, BotMemory>>();
const STRATEGIES = {
  easy: {
    depth: 9,
    brick: 12,
    pursuit: 0.3,
    attack: 0,
    plantDelay: 65,
  },
  normal: {
    depth: 16,
    brick: 10,
    pursuit: 0.5,
    attack: 5,
    plantDelay: 35,
  },
  hard: {
    depth: 24,
    brick: 8,
    pursuit: 0.8,
    attack: 12,
    plantDelay: 22,
  },
} as const;

const blastRange = (player: Player): number =>
  hasDisease(player, "weak") ? 1 : player.range;

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
    bombs.map((bomb) => [
      bomb.id,
      bomb.state !== "airborne" &&
      state.flames.some(
        (flame) =>
          flame.until > state.tick && flame.x === bomb.x && flame.y === bomb.y,
      )
        ? 0
        : bomb.kind === "trigger"
          ? 90
          : Math.max(0, bomb.fuse),
    ]),
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
    range: blastRange(player),
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
  return blastCells(state, x, y, blastRange(player)).some(
    (point) =>
      tileAt(state.cells, point.x, point.y) === "brick" ||
      (enemy.alive &&
        point.x === cellOf(enemy.x) &&
        point.y === cellOf(enemy.y)),
  );
}

function safeThrow(state: GameState, player: Player, bomb: Bomb): boolean {
  const thrown = projectThrow(bomb, player.direction);
  // An imminent fuse explodes in flight, before a landing can redirect the bomb.
  if (bomb.fuse > thrown.travel || bomb.kind === "trigger") return false;
  const forecast = dangerForecast({
    ...state,
    bombs: state.bombs.map((other) => (other.id === bomb.id ? thrown : other)),
  });
  return !dangerous(
    forecast,
    cellOf(player.x),
    cellOf(player.y),
    0,
    Math.max(90, bomb.fuse) + RULES.flame,
  );
}

function walkingDistances(
  state: GameState,
  target: Point,
): Map<number, number> {
  const distances = new Map([[cellIndex(target.x, target.y), 0]]);
  const queue = [target];
  for (let index = 0; index < queue.length; index++) {
    const point = queue[index];
    for (const direction of DIRECTIONS) {
      const vector = VECTOR[direction],
        x = point.x + vector.x,
        y = point.y + vector.y,
        key = cellIndex(x, y);
      if (distances.has(key) || tileAt(state.cells, x, y) !== "floor") continue;
      distances.set(key, distances.get(cellIndex(point.x, point.y))! + 1);
      queue.push({ x, y });
    }
  }
  return distances;
}

function chooseGoal(
  state: GameState,
  player: Player,
  danger: Map<number, Danger[]>,
  difficulty: MatchSettings["difficulty"],
): Route | undefined {
  const enemy = state.players[1 - player.id];
  const enemyDistances = walkingDistances(state, {
    x: cellOf(enemy.x),
    y: cellOf(enemy.y),
  });
  const strategy = STRATEGIES[difficulty];
  const options = routes(state, player, danger, strategy.depth).filter(
    (route) =>
      route.distance > 0 &&
      !dangerous(danger, route.x, route.y, route.at, route.at + 65),
  );
  const score = (route: Route): number => {
    const pickup = state.pickups.find(
      (item) => item.x === route.x && item.y === route.y,
    );
    const pickupScore = pickup
      ? !state.settings.mysteryPickups &&
        (pickup.type === "disease" || pickup.type === "superDisease")
        ? -18
        : 18
      : 0;
    const brick = DIRECTIONS.some(
      (direction) =>
        tileAt(
          state.cells,
          route.x + VECTOR[direction].x,
          route.y + VECTOR[direction].y,
        ) === "brick",
    );
    const enemyDistance = enemyDistances.get(cellIndex(route.x, route.y)) ?? 0;
    const attack =
      enemy.alive &&
      blastCells(state, route.x, route.y, blastRange(player)).some(
        (point) => point.x === cellOf(enemy.x) && point.y === cellOf(enemy.y),
      );
    const variation =
      ((route.x * 17 +
        route.y * 11 +
        state.seed +
        Math.floor(state.tick / 240)) %
        13) /
      13;
    return (
      pickupScore +
      (brick ? strategy.brick : 0) +
      (attack ? strategy.attack : 0) -
      route.distance * 1.15 -
      enemyDistance * strategy.pursuit +
      variation
    );
  };
  let best: Route | undefined;
  let bestScore = -Infinity;
  for (const option of options) {
    const value = score(option);
    if (value > bestScore) {
      best = option;
      bestScore = value;
    }
  }
  return best;
}

function followRoute(
  state: GameState,
  player: Player,
  route: Route | undefined,
  memory: BotMemory,
): Direction | null {
  const requested = (direction: Direction): Direction =>
    hasDisease(player, "reverse") ? opposite(direction) : direction;
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
      return requested(
        Math.abs(dx) > Math.abs(dy)
          ? dx > 0
            ? "right"
            : "left"
          : dy > 0
            ? "down"
            : "up",
      );
  }
  if (!route?.first) return null;
  const vector = VECTOR[route.first];
  memory.goal = {
    x: cellOf(player.x) + vector.x,
    y: cellOf(player.y) + vector.y,
  };
  return requested(route.first);
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
    memory = {
      goal: null,
      nextPlant: 0,
      lastBomb: false,
      lastAction: false,
      escaping: false,
    };
    players.set(playerId, memory);
  }
  const previousAction = memory.lastAction;
  memory.lastAction = false;
  if (player.carrying !== null) {
    memory.lastAction = !previousAction;
    return { direction: null, bomb: false, action: !previousAction };
  }
  const danger = dangerForecast(state),
    x = cellOf(player.x),
    y = cellOf(player.y);
  if (memory.goal) {
    const travel = Math.ceil(
      (Math.abs(memory.goal.x * UNIT - player.x) +
        Math.abs(memory.goal.y * UNIT - player.y)) /
        movementSpeed(player),
    );
    if (dangerous(danger, memory.goal.x, memory.goal.y, 0, travel + 1))
      memory.goal = null;
  }
  const urgent = dangerous(danger, x, y, 0, difficulty === "easy" ? 110 : 210);
  if (urgent) {
    const escape = escapeRoute(state, player, danger);
    if (!escape && !previousAction) {
      const vector = VECTOR[player.direction];
      const nearby =
        bombAt(state, x, y) ?? bombAt(state, x + vector.x, y + vector.y);
      if (
        nearby &&
        (player.abilities.includes("grab")
          ? nearby.fuse > 3
          : player.abilities.includes("punch")) &&
        safeThrow(state, player, nearby)
      ) {
        memory.lastAction = true;
        return { direction: null, bomb: false, action: true };
      }
    }
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
    const vector = VECTOR[player.direction];
    const nearby =
      bombAt(state, x, y) ?? bombAt(state, x + vector.x, y + vector.y);
    const intercepted =
      nearby &&
      (player.abilities.includes("grab") || player.abilities.includes("punch"));
    const blast = blastCells(state, remote.x, remote.y, remote.range);
    const triggered = dangerForecast({
      ...state,
      bombs: state.bombs.map((bomb) =>
        bomb.id === remote.id ? { ...bomb, kind: "regular", fuse: 0 } : bomb,
      ),
    });
    const safe = !dangerous(triggered, x, y, 0, RULES.flame);
    if (
      safe &&
      !intercepted &&
      !previousAction &&
      (blast.some(
        (p) =>
          p.x === cellOf(state.players[1 - playerId].x) &&
          p.y === cellOf(state.players[1 - playerId].y),
      ) ||
        state.tick % 90 === 0)
    ) {
      memory.lastAction = true;
      return { direction: null, bomb: false, action: true };
    }
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
      memory.nextPlant = state.tick + STRATEGIES[difficulty].plantDelay;
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
