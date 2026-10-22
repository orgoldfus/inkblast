import { RULES } from "../rules/settings";
import { validateScheme } from "../content/schemes";
import {
  DIRECTIONS,
  VECTOR,
  blastCells,
  bombAt,
  inBounds,
  opposite,
  tileAt,
} from "./grid";
import {
  COLS,
  ROWS,
  UNIT,
  cellIndex,
  cellOf,
  type Bomb,
  type Disease,
  type Direction,
  type GameState,
  type InputFrame,
  type ItemType,
  type MatchSettings,
  type Player,
  type Scheme,
  type SimulationRuntime,
  type Theme,
} from "./types";

const DISEASES: Disease[] = [
  "slow",
  "fast",
  "noBomb",
  "autoBomb",
  "weak",
  "fastBomb",
  "shortFuse",
  "swap",
  "reverse",
];
const ABILITIES: ItemType[] = [
  "kick",
  "punch",
  "grab",
  "spooge",
  "trigger",
  "jelly",
];
const newRuntime = (): SimulationRuntime => ({
  lastBomb: [false, false],
  lastAction: [false, false],
  warpUntil: [0, 0],
  stunUntil: [0, 0],
  autoPlantAt: [0, 0],
  regen: [],
  closureAt: 0,
  closureStep: 0,
  perimeterClosed: false,
  transits: [null, null],
  directionHistory: [[], []],
});
const runtime = (state: GameState): SimulationRuntime =>
  (state.runtime ??= newRuntime());

export function random(state: GameState): number {
  let value = state.rng;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.rng = value >>> 0;
  return state.rng / 4294967296;
}

function makePlayer(id: 0 | 1, scheme: Scheme, spawn: number): Player {
  const point = scheme.spawns[spawn];
  return {
    id,
    x: point.x * UNIT,
    y: point.y * UNIT,
    direction: id === 0 ? "right" : "left",
    alive: true,
    capacity: 1,
    range: 2,
    speed: 0,
    abilities: [],
    diseases: [],
    carrying: null,
    kills: 0,
    invulnerableUntil: 0,
  };
}

export function createGame(
  scheme: Scheme,
  theme: Theme,
  settings: MatchSettings,
  seed = Date.now(),
): GameState {
  const checked = validateScheme(scheme);
  if (!checked.valid) throw new Error(checked.errors.join(" "));
  validateMatchSettings(settings);
  const state: GameState = {
    tick: 0,
    seed: seed >>> 0,
    rng: seed >>> 0 || 1,
    cells: [...scheme.cells],
    initialCells: [],
    players: [makePlayer(0, scheme, 0), makePlayer(1, scheme, 1)],
    bombs: [],
    flames: [],
    pickups: [],
    events: [],
    theme,
    scheme,
    settings: { ...settings },
    phase: "countdown",
    countdown: RULES.countdown,
    remaining:
      settings.roundSeconds > 0 ? settings.roundSeconds * 60 : Infinity,
    resolution: 0,
    winner: null,
    nextBombId: 1,
    closingDepth: 0,
    hurry: false,
    hiddenItems: {},
    runtime: newRuntime(),
  };
  if (settings.randomStarts && random(state) < 0.5) {
    [state.players[0].x, state.players[1].x] = [
      state.players[1].x,
      state.players[0].x,
    ];
    [state.players[0].y, state.players[1].y] = [
      state.players[1].y,
      state.players[0].y,
    ];
  }
  state.cells = state.cells.map((cell) =>
    cell === "brick" && random(state) * 100 >= scheme.density ? "floor" : cell,
  );
  for (const player of state.players) {
    const x = cellOf(player.x),
      y = cellOf(player.y);
    for (const point of [
      { x, y },
      ...DIRECTIONS.map((d) => ({ x: x + VECTOR[d].x, y: y + VECTOR[d].y })),
    ]) {
      if (
        inBounds(point.x, point.y) &&
        ((point.x === x && point.y === y) ||
          tileAt(state.cells, point.x, point.y) !== "wall")
      )
        state.cells[cellIndex(point.x, point.y)] = "floor";
    }
    for (const [item, amount] of Object.entries(scheme.startingItems)) {
      for (let count = 0; count < Math.min(20, amount ?? 0); count++)
        applyItem(state, player, item as ItemType);
    }
    if (settings.wally) {
      player.capacity = Math.max(3, player.capacity);
      for (const item of ["grab", "punch", "kick"] as const)
        applyItem(state, player, item);
    }
  }
  state.events = [];
  state.initialCells = [...state.cells];
  distributeItems(state);
  return state;
}

function validateMatchSettings(settings: MatchSettings): void {
  const bounded = (
    value: number,
    min: number,
    max: number,
    integer = true,
  ): boolean =>
    Number.isFinite(value) &&
    value >= min &&
    value <= max &&
    (!integer || Number.isInteger(value));
  if (
    !bounded(settings.roundSeconds, 0, 3600) ||
    !bounded(settings.targetScore, 1, 99) ||
    !bounded(settings.enclosureDepth, 0, 5) ||
    !bounded(settings.conveyorSpeed, 0, 3, false)
  )
    throw new Error(
      "Match clock, target score, enclosure depth or conveyor speed is outside the supported range.",
    );
  if (
    !["cpu", "local"].includes(settings.mode) ||
    !["easy", "normal", "hard"].includes(settings.difficulty) ||
    !["wins", "kills"].includes(settings.scoring)
  )
    throw new Error("Unsupported match mode, scoring rule or difficulty.");
  if (
    ![settings.music, settings.effects, settings.voices].every((value) =>
      bounded(value, 0, 1, false),
    )
  )
    throw new Error("Sound levels must be between zero and one.");
}

function distributeItems(state: GameState): void {
  const bricks = state.cells.flatMap((cell, index) =>
    cell === "brick" ? [index] : [],
  );
  const pool = state.scheme.itemPool.filter(
    (type) => state.scheme.itemOverrides?.[type] === undefined,
  );
  const overrides = Object.entries(state.scheme.itemOverrides ?? {}).sort(
    ([, a], [, b]) => Number((b ?? 0) > 0) - Number((a ?? 0) > 0),
  );
  for (const [name, amount] of overrides) {
    const type = name as ItemType;
    if (!amount) continue;
    if (amount < 0) {
      for (const index of bricks)
        if (!state.hiddenItems[index] && random(state) < 1 / Math.abs(amount))
          state.hiddenItems[index] = type;
    } else {
      const available = bricks.filter((index) => !state.hiddenItems[index]);
      for (let count = 0; count < amount && available.length; count++) {
        const pick = Math.floor(random(state) * available.length);
        state.hiddenItems[available.splice(pick, 1)[0]] = type;
      }
    }
  }
  for (const index of bricks)
    if (!state.hiddenItems[index] && pool.length && random(state) < 0.43)
      state.hiddenItems[index] = pool[Math.floor(random(state) * pool.length)];
}

export const hasDisease = (player: Player, disease: Disease): boolean =>
  player.diseases.some((d) => d.type === disease);
export const movementSpeed = (player: Player): number =>
  hasDisease(player, "slow")
    ? 35
    : hasDisease(player, "fast")
      ? 155
      : RULES.baseSpeed + player.speed * RULES.speedIncrement;

function inflict(state: GameState, player: Player, type: Disease): void {
  if (type === "swap") {
    const other = state.players[1 - player.id];
    if (other.alive) {
      [player.x, other.x] = [other.x, player.x];
      [player.y, other.y] = [other.y, player.y];
      state.events.push({
        type: "warp",
        player: player.id,
        x: cellOf(player.x),
        y: cellOf(player.y),
      });
    }
    return;
  }
  const existing = player.diseases.find((d) => d.type === type);
  if (existing) existing.until = state.tick + RULES.diseaseDuration;
  else
    player.diseases.push({ type, until: state.tick + RULES.diseaseDuration });
}

export function applyItem(
  state: GameState,
  player: Player,
  item: ItemType,
): void {
  if (item === "random") {
    const choices = (state.scheme.randomPool ?? state.scheme.itemPool).filter(
      (type) => type !== "random",
    );
    if (choices.length)
      applyItem(
        state,
        player,
        choices[Math.floor(random(state) * choices.length)],
      );
    return;
  }
  if (item === "bomb")
    player.capacity = Math.min(RULES.maxCapacity, player.capacity + 1);
  else if (item === "flame")
    player.range = Math.min(RULES.maxRange, player.range + 1);
  else if (item === "goldflame") player.range = RULES.maxRange;
  else if (item === "skate")
    player.speed = Math.min(RULES.maxSpeed, player.speed + 1);
  else if (item === "disease" || item === "superDisease") {
    const choices = [...DISEASES];
    for (let count = 0; count < (item === "superDisease" ? 3 : 1); count++) {
      const index = Math.floor(random(state) * choices.length);
      inflict(state, player, choices.splice(index, 1)[0]);
    }
  } else if (ABILITIES.includes(item) && !player.abilities.includes(item)) {
    if (item === "trigger")
      player.abilities = player.abilities.filter((type) => type !== "jelly");
    if (item === "jelly")
      player.abilities = player.abilities.filter((type) => type !== "trigger");
    player.abilities.push(item);
  }
  state.events.push({
    type: "pickup",
    player: player.id,
    item,
    x: cellOf(player.x),
    y: cellOf(player.y),
  });
}

function fits(state: GameState, player: Player, x: number, y: number): boolean {
  const radius = RULES.bodyRadius;
  for (const px of [x - radius, x + radius])
    for (const py of [y - radius, y + radius]) {
      if (tileAt(state.cells, cellOf(px), cellOf(py)) !== "floor") return false;
    }
  return !state.bombs.some(
    (b) =>
      b.state !== "airborne" &&
      b.state !== "carried" &&
      !b.passThrough.includes(player.id) &&
      Math.abs(x - b.x * UNIT) < 720 &&
      Math.abs(y - b.y * UNIT) < 720,
  );
}

function kickAhead(
  state: GameState,
  player: Player,
  direction: Direction,
): void {
  if (!player.abilities.includes("kick")) return;
  const vector = VECTOR[direction],
    x = cellOf(player.x),
    y = cellOf(player.y);
  const bomb = bombAt(state, x + vector.x, y + vector.y);
  if (
    bomb &&
    bomb.state === "resting" &&
    tileAt(state.cells, bomb.x + vector.x, bomb.y + vector.y) === "floor" &&
    !bombAt(state, bomb.x + vector.x, bomb.y + vector.y)
  ) {
    bomb.state = "kicked";
    bomb.direction = direction;
    bomb.travel = 0;
    state.events.push({
      type: "kick",
      x: bomb.x,
      y: bomb.y,
      player: player.id,
    });
  }
}

function movePlayer(
  state: GameState,
  player: Player,
  requested: Direction | null,
): void {
  if (!requested || runtime(state).stunUntil[player.id] > state.tick) return;
  const direction = hasDisease(player, "reverse")
    ? opposite(requested)
    : requested;
  player.direction = direction;
  const vector = VECTOR[direction],
    speed = movementSpeed(player);
  const horizontal = vector.x !== 0;
  const perpendicular = horizontal ? player.y : player.x;
  const center = cellOf(perpendicular) * UNIT;
  const offset = center - perpendicular;
  if (Math.abs(offset) <= UNIT / 2 && offset !== 0) {
    const correction = Math.sign(offset) * Math.min(Math.abs(offset), speed);
    const nx = player.x + (horizontal ? 0 : correction),
      ny = player.y + (horizontal ? correction : 0);
    if (fits(state, player, nx, ny)) {
      player.x = nx;
      player.y = ny;
    }
  }
  const nx = player.x + vector.x * speed,
    ny = player.y + vector.y * speed;
  if (fits(state, player, nx, ny)) {
    player.x = nx;
    player.y = ny;
  } else kickAhead(state, player, direction);
}

export function plantBomb(
  state: GameState,
  player: Player,
  x = cellOf(player.x),
  y = cellOf(player.y),
): Bomb | undefined {
  if (
    !player.alive ||
    hasDisease(player, "noBomb") ||
    player.carrying !== null ||
    tileAt(state.cells, x, y) !== "floor" ||
    bombAt(state, x, y) ||
    state.bombs.filter((b) => b.owner === player.id).length >= player.capacity
  )
    return;
  const bomb: Bomb = {
    id: state.nextBombId++,
    owner: player.id,
    x,
    y,
    range: hasDisease(player, "weak") ? 1 : player.range,
    fuse: hasDisease(player, "shortFuse")
      ? Math.floor(RULES.fuse / 2)
      : RULES.fuse,
    kind: player.abilities.includes("trigger")
      ? "trigger"
      : player.abilities.includes("jelly")
        ? "jelly"
        : "regular",
    state: "resting",
    direction: player.direction,
    travel: 0,
    passThrough: state.players
      .filter(
        (p) => Math.abs(p.x - x * UNIT) < 720 && Math.abs(p.y - y * UNIT) < 720,
      )
      .map((p) => p.id),
  };
  state.bombs.push(bomb);
  state.events.push({ type: "plant", x, y, player: player.id });
  return bomb;
}

export function projectThrow(bomb: Bomb, direction: Direction): Bomb {
  const vector = VECTOR[direction];
  return {
    ...bomb,
    x: wrapBoard(bomb.x + vector.x * 3, COLS),
    y: wrapBoard(bomb.y + vector.y * 3, ROWS),
    state: "airborne",
    direction,
    travel: 24,
    passThrough: [],
  };
}

function launch(state: GameState, bomb: Bomb, player: Player): void {
  Object.assign(bomb, projectThrow(bomb, player.direction));
  player.carrying = null;
  state.events.push({ type: "throw", x: bomb.x, y: bomb.y, player: player.id });
}
const wrapBoard = (value: number, size: number): number =>
  ((value % size) + size) % size;

function action(state: GameState, player: Player): void {
  if (player.carrying !== null) {
    const carried = state.bombs.find((b) => b.id === player.carrying);
    if (carried) launch(state, carried, player);
    else player.carrying = null;
    return;
  }
  const vector = VECTOR[player.direction],
    x = cellOf(player.x),
    y = cellOf(player.y);
  const nearby =
    bombAt(state, x, y) ?? bombAt(state, x + vector.x, y + vector.y);
  if (nearby && player.abilities.includes("grab")) {
    nearby.state = "carried";
    player.carrying = nearby.id;
    return;
  }
  if (nearby && player.abilities.includes("punch")) {
    launch(state, nearby, player);
    return;
  }
  const trigger = state.bombs
    .filter((b) => b.owner === player.id && b.kind === "trigger")
    .sort((a, b) => a.id - b.id)[0];
  if (trigger) {
    trigger.fuse = 0;
    return;
  }
  const moving = state.bombs.find(
    (b) => b.owner === player.id && b.state === "kicked",
  );
  if (moving) {
    moving.state = "resting";
    return;
  }
  if (player.abilities.includes("spooge")) {
    for (let distance = 0; distance < player.capacity; distance++) {
      if (
        !plantBomb(
          state,
          player,
          x + vector.x * distance,
          y + vector.y * distance,
        )
      )
        break;
    }
  }
}

function kill(state: GameState, player: Player, owner?: 0 | 1): void {
  if (!player.alive || player.invulnerableUntil > state.tick) return;
  player.alive = false;
  if (owner !== undefined)
    state.players[owner].kills += owner === player.id ? -1 : 1;
  if (player.carrying !== null) {
    const bomb = state.bombs.find((b) => b.id === player.carrying);
    if (bomb) {
      bomb.x = cellOf(player.x);
      bomb.y = cellOf(player.y);
      bomb.state = "resting";
      bomb.passThrough = [];
    }
    player.carrying = null;
  }
  for (const bomb of state.bombs)
    if (bomb.owner === player.id && bomb.kind === "trigger") {
      bomb.kind = "regular";
      bomb.fuse = Math.min(bomb.fuse, 90);
    }
  state.events.push({
    type: "death",
    player: player.id,
    x: cellOf(player.x),
    y: cellOf(player.y),
  });
}

function moveBombs(state: GameState): void {
  for (const bomb of state.bombs) {
    const floorDirection = hazardDirection(state, bomb.x, bomb.y);
    if (floorDirection && bomb.state === "kicked")
      bomb.direction = floorDirection;
    if (
      floorDirection &&
      state.theme.hazard === "conveyor" &&
      state.settings.conveyorSpeed > 0 &&
      bomb.state === "resting"
    ) {
      bomb.state = "kicked";
      bomb.direction = floorDirection;
      bomb.travel = Math.max(4, Math.round(18 / state.settings.conveyorSpeed));
    }
    bomb.passThrough = bomb.passThrough.filter((id) => {
      const player = state.players[id];
      return (
        player.alive &&
        Math.abs(player.x - bomb.x * UNIT) < 720 &&
        Math.abs(player.y - bomb.y * UNIT) < 720
      );
    });
    if (bomb.state === "carried") {
      const carrier = state.players.find((p) => p.carrying === bomb.id);
      if (carrier) {
        bomb.x = cellOf(carrier.x);
        bomb.y = cellOf(carrier.y);
      }
    } else if (bomb.state === "airborne") {
      if (--bomb.travel <= 0) {
        if (
          tileAt(state.cells, bomb.x, bomb.y) !== "floor" ||
          bombAt(state, bomb.x, bomb.y)
        ) {
          const vector = VECTOR[bomb.direction];
          bomb.x = wrapBoard(bomb.x + vector.x, COLS);
          bomb.y = wrapBoard(bomb.y + vector.y, ROWS);
          bomb.travel = 6;
        } else {
          bomb.state = bomb.kind === "jelly" ? "kicked" : "resting";
          bomb.travel = 0;
          for (const player of state.players)
            if (
              player.alive &&
              cellOf(player.x) === bomb.x &&
              cellOf(player.y) === bomb.y
            ) {
              if (state.settings.stompBombs) bomb.fuse = 0;
              else {
                runtime(state).stunUntil[player.id] = state.tick + 45;
                bomb.passThrough.push(player.id);
              }
            }
        }
      }
    } else if (bomb.state === "kicked" && --bomb.travel <= 0) {
      const vector = VECTOR[bomb.direction],
        nx = bomb.x + vector.x,
        ny = bomb.y + vector.y;
      const occupied = state.players.some(
        (p) =>
          p.alive &&
          Math.abs(p.x - nx * UNIT) < 700 &&
          Math.abs(p.y - ny * UNIT) < 700,
      );
      if (
        tileAt(state.cells, nx, ny) === "floor" &&
        !bombAt(state, nx, ny) &&
        !occupied
      ) {
        bomb.x = nx;
        bomb.y = ny;
        bomb.travel =
          state.theme.hazard === "conveyor" && floorDirection
            ? Math.max(
                4,
                Math.round(18 / Math.max(0.1, state.settings.conveyorSpeed)),
              )
            : 7;
        bomb.passThrough = [];
      } else if (bomb.kind === "jelly") {
        bomb.direction = opposite(bomb.direction);
        bomb.travel = 7;
      } else bomb.state = "resting";
    }
    if (bomb.kind !== "trigger") bomb.fuse--;
  }
}

function explodeBombs(state: GameState): void {
  const queue = state.bombs
    .filter(
      (b) =>
        b.fuse <= 0 ||
        (b.state !== "airborne" &&
          b.state !== "carried" &&
          state.flames.some((f) => f.x === b.x && f.y === b.y)),
    )
    .map((b) => b.id)
    .sort((a, b) => a - b);
  const destroyed = new Set<number>();
  const revealed: { x: number; y: number; type: ItemType }[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    const bomb = state.bombs.find((b) => b.id === id);
    if (!bomb) continue;
    state.bombs = state.bombs.filter((b) => b.id !== id);
    for (const player of state.players)
      if (player.carrying === id) player.carrying = null;
    state.events.push({
      type: "explode",
      x: bomb.x,
      y: bomb.y,
      player: bomb.owner,
    });
    for (const point of blastCells(state, bomb.x, bomb.y, bomb.range)) {
      state.flames.push({
        ...point,
        owner: bomb.owner,
        until: state.tick + RULES.flame,
      });
      const chained = bombAt(state, point.x, point.y);
      if (chained && !queue.includes(chained.id)) queue.push(chained.id);
      const index = cellIndex(point.x, point.y);
      if (tileAt(state.cells, point.x, point.y) === "brick") {
        destroyed.add(index);
        const item = state.hiddenItems[index];
        if (item && !revealed.some((p) => p.x === point.x && p.y === point.y))
          revealed.push({ ...point, type: item });
        delete state.hiddenItems[index];
      }
      state.pickups = state.pickups.filter(
        (p) =>
          p.x !== point.x ||
          p.y !== point.y ||
          (!state.settings.destroyDiseases &&
            (p.type === "disease" || p.type === "superDisease")),
      );
    }
    queue.sort((a, b) => a - b);
  }
  for (const index of destroyed) {
    state.cells[index] = "floor";
    if (state.theme.hazard === "regenerate")
      runtime(state).regen.push({ index, at: state.tick + 240 });
  }
  state.pickups.push(...revealed);
}

function damagePlayers(state: GameState): void {
  for (const player of state.players) {
    if (!player.alive) continue;
    const x = cellOf(player.x),
      y = cellOf(player.y);
    const flame = state.flames.find((f) => f.x === x && f.y === y);
    if (flame) kill(state, player, flame.owner);
    else if (tileAt(state.cells, x, y) === "wall") kill(state, player);
  }
}

export function hazardDirection(
  state: GameState,
  x: number,
  y: number,
): Direction | null {
  const mirrored =
    y > (ROWS - 1) / 2 || (y === (ROWS - 1) / 2 && x > (COLS - 1) / 2);
  const sourceX = mirrored ? COLS - 1 - x : x;
  const sourceY = mirrored ? ROWS - 1 - y : y;
  if (x === (COLS - 1) / 2 && y === (ROWS - 1) / 2) return null;
  const orient = (direction: Direction): Direction =>
    mirrored ? opposite(direction) : direction;
  if (state.theme.hazard === "conveyor" && y % 2 === 1 && x > 1 && x < COLS - 2)
    return orient(sourceY % 4 === 1 ? "right" : "left");
  if (
    (state.theme.hazard === "arrows" || state.theme.id === "hockey") &&
    x % 4 === 3 &&
    y % 4 === 1
  )
    return orient(
      DIRECTIONS[(Math.floor(sourceX / 4) + Math.floor(sourceY / 4)) % 4],
    );
  return null;
}

export function hazardCells(state: GameState): { x: number; y: number }[] {
  if (state.theme.hazard === "warp")
    return [
      { x: 3, y: 1 },
      { x: COLS - 4, y: ROWS - 2 },
    ];
  if (state.theme.hazard === "trampoline")
    return [
      { x: 3, y: 5 },
      { x: 11, y: 5 },
    ];
  return [];
}

function environment(state: GameState): void {
  const meta = runtime(state);
  for (const player of state.players) {
    if (!player.alive) continue;
    const transit = meta.transits[player.id];
    if (transit) {
      if (!transit.transferred && state.tick >= transit.transferAt) {
        player.x = transit.targetX * UNIT;
        player.y = transit.targetY * UNIT;
        transit.transferred = true;
      }
      if (state.tick < transit.until) continue;
      meta.transits[player.id] = null;
    }
    let x = cellOf(player.x),
      y = cellOf(player.y);
    const direction = hazardDirection(state, x, y);
    if (direction && state.theme.hazard === "conveyor") {
      const vector = VECTOR[direction],
        amount = 20 * Math.max(0, Math.min(3, state.settings.conveyorSpeed));
      if (
        fits(
          state,
          player,
          player.x + vector.x * amount,
          player.y + vector.y * amount,
        )
      ) {
        player.x += vector.x * amount;
        player.y += vector.y * amount;
      }
    }
    const special = hazardCells(state).findIndex((p) => p.x === x && p.y === y);
    if (
      special >= 0 &&
      meta.warpUntil[player.id] <= state.tick &&
      Math.abs(player.x - x * UNIT) < 250 &&
      Math.abs(player.y - y * UNIT) < 250
    ) {
      const points = hazardCells(state);
      if (
        state.theme.hazard === "warp" ||
        state.theme.hazard === "trampoline"
      ) {
        let target = points[1 - special];
        const jump = state.theme.hazard === "trampoline";
        if (jump) {
          const choices = [];
          for (let tx = x - 2; tx <= x + 2; tx++)
            for (let ty = y - 2; ty <= y + 2; ty++) {
              if (
                tx !== x &&
                ty !== y &&
                tileAt(state.cells, tx, ty) === "floor" &&
                !bombAt(state, tx, ty)
              )
                choices.push({ x: tx, y: ty });
            }
          if (!choices.length) continue;
          target = choices[Math.floor(random(state) * choices.length)];
        }
        if (
          tileAt(state.cells, target.x, target.y) === "floor" &&
          !bombAt(state, target.x, target.y)
        ) {
          const duration = jump ? 30 : 18;
          meta.transits[player.id] = {
            type: jump ? "jump" : "warp",
            started: state.tick,
            transferAt: state.tick + duration / 2,
            until: state.tick + duration,
            targetX: target.x,
            targetY: target.y,
            transferred: false,
          };
          meta.stunUntil[player.id] = state.tick + duration;
          player.invulnerableUntil = state.tick + duration;
          state.events.push({
            type: "warp",
            player: player.id,
            x: target.x,
            y: target.y,
          });
        }
        meta.warpUntil[player.id] = state.tick + 60;
      }
    }
    x = cellOf(player.x);
    y = cellOf(player.y);
    const pickup = state.pickups.find((p) => p.x === x && p.y === y);
    if (pickup && !state.flames.some((f) => f.x === x && f.y === y)) {
      state.pickups = state.pickups.filter((p) => p !== pickup);
      applyItem(state, player, pickup.type);
    }
  }
  if (
    state.tick % 60 === 0 &&
    state.players.every((p) => p.alive) &&
    Math.abs(state.players[0].x - state.players[1].x) < 800 &&
    Math.abs(state.players[0].y - state.players[1].y) < 800
  ) {
    const snapshots = state.players.map((p) => [...p.diseases]);
    state.players.forEach((player, index) =>
      snapshots[1 - index].forEach((d) => {
        if (!hasDisease(player, d.type)) player.diseases.push({ ...d });
      }),
    );
  }
  meta.regen = meta.regen.filter((entry) => {
    if (entry.at > state.tick) return true;
    const x = entry.index % COLS,
      y = Math.floor(entry.index / COLS);
    if (state.cells[entry.index] !== "floor") return false;
    if (
      bombAt(state, x, y) ||
      state.pickups.some((p) => p.x === x && p.y === y) ||
      state.flames.some((f) => f.x === x && f.y === y) ||
      state.players.some(
        (p) => p.alive && cellOf(p.x) === x && cellOf(p.y) === y,
      )
    ) {
      entry.at += 60;
      return true;
    }
    state.cells[entry.index] = "brick";
    return false;
  });
}

function closingWalls(state: GameState): void {
  if (state.remaining > 0 || !Number.isFinite(state.remaining)) return;
  const meta = runtime(state);
  if (!meta.closureAt) meta.closureAt = state.tick;
  if (
    state.tick < meta.closureAt ||
    state.closingDepth >= Math.min(5, state.settings.enclosureDepth)
  )
    return;
  if (!meta.perimeterClosed)
    meta.perimeterClosed = state.initialCells.every((cell, index) => {
      const x = index % COLS,
        y = Math.floor(index / COLS);
      return (
        (x > 0 && y > 0 && x < COLS - 1 && y < ROWS - 1) || cell === "wall"
      );
    });
  const depth = meta.perimeterClosed ? state.closingDepth + 1 : 0;
  const ring: { x: number; y: number }[] = [];
  for (let x = depth; x < COLS - depth; x++) ring.push({ x, y: depth });
  for (let y = depth + 1; y < ROWS - depth; y++)
    ring.push({ x: COLS - depth - 1, y });
  if (ROWS - depth - 1 !== depth)
    for (let x = COLS - depth - 2; x >= depth; x--)
      ring.push({ x, y: ROWS - depth - 1 });
  for (let y = ROWS - depth - 2; y > depth; y--) ring.push({ x: depth, y });
  const point = ring[meta.closureStep++];
  if (point) {
    const bomb = bombAt(state, point.x, point.y);
    if (bomb && state.settings.stompBombs) {
      bomb.fuse = 0;
      explodeBombs(state);
    }
    state.bombs = state.bombs.filter((b) => b.x !== point.x || b.y !== point.y);
    state.pickups = state.pickups.filter(
      (p) => p.x !== point.x || p.y !== point.y,
    );
    state.cells[cellIndex(point.x, point.y)] = "wall";
  }
  if (meta.closureStep >= ring.length) {
    if (meta.perimeterClosed) state.closingDepth++;
    else meta.perimeterClosed = true;
    meta.closureStep = 0;
  }
  meta.closureAt = state.tick + 12;
}

export function stepGame(
  state: GameState,
  inputs: [InputFrame, InputFrame],
): void {
  state.events = [];
  if (state.phase === "finished") return;
  state.tick++;
  if (state.phase === "countdown") {
    if (--state.countdown <= 0) state.phase = "active";
    return;
  }
  const meta = runtime(state);
  state.flames = state.flames.filter((f) => f.until > state.tick);
  if (state.phase === "active") {
    state.remaining = Math.max(0, state.remaining - 1);
    if (!state.hurry && state.remaining <= 30 * 60) {
      state.hurry = true;
      state.events.push({ type: "hurry" });
    }
  }
  for (const player of state.players) {
    player.diseases = player.diseases.filter((d) => d.until > state.tick);
    if (!player.alive) continue;
    const input = inputs[player.id];
    let direction = input.direction;
    if (
      state.theme.hazard === "delay" &&
      !(state.settings.mode === "cpu" && player.id === 1)
    ) {
      const history = meta.directionHistory[player.id];
      history.push(direction);
      direction = history.length > 15 ? history.shift()! : null;
    }
    movePlayer(state, player, direction);
    if (state.phase === "active" && meta.stunUntil[player.id] <= state.tick) {
      const automatic =
        hasDisease(player, "autoBomb") || hasDisease(player, "fastBomb");
      if (
        (input.bomb && !meta.lastBomb[player.id]) ||
        (automatic && state.tick >= meta.autoPlantAt[player.id])
      ) {
        plantBomb(state, player);
        meta.autoPlantAt[player.id] =
          state.tick + (hasDisease(player, "fastBomb") ? 15 : 45);
      }
      if (input.action && !meta.lastAction[player.id]) action(state, player);
    }
    meta.lastBomb[player.id] = input.bomb;
    meta.lastAction[player.id] = input.action;
  }
  environment(state);
  moveBombs(state);
  damagePlayers(state);
  explodeBombs(state);
  closingWalls(state);
  damagePlayers(state);
  if (
    state.phase === "active" &&
    state.players.filter((p) => p.alive).length < 2
  ) {
    state.phase = "resolving";
    state.resolution = RULES.resolution;
  }
  if (state.phase === "resolving" && --state.resolution <= 0) {
    state.phase = "finished";
    state.winner = state.players[0].alive
      ? 0
      : state.players[1].alive
        ? 1
        : null;
    state.events.push({ type: "result", player: state.winner ?? undefined });
  }
  if (
    state.phase === "active" &&
    state.remaining === 0 &&
    state.closingDepth >= Math.min(5, state.settings.enclosureDepth) &&
    state.settings.enclosureDepth === 0
  ) {
    state.phase = "finished";
    state.winner = null;
    state.events.push({ type: "result" });
  }
}
