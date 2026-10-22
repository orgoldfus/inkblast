import { Application, Container, Sprite, Texture } from "pixi.js";
import {
  COLS,
  ROWS,
  UNIT,
  type Bomb,
  type Cell,
  type GameState,
} from "../core/types";
import { hazardCells, hazardDirection } from "../core/simulation";
import { createArenaArt, TILE, type ArenaArt } from "./artwork";

interface BombView {
  body: Sprite;
  shadow: Sprite;
  spark: Sprite;
  seen: boolean;
}
interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  age: number;
  life: number;
  spin: number;
}
interface PlayerView {
  body: Sprite;
  shadow: Sprite;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  renderedX: number;
  renderedY: number;
  walkDistance: number;
  diedAt: number | null;
  transitStarted: number | null;
  transitX: number;
  transitY: number;
}
const WIDTH = COLS * TILE;
const HEIGHT = ROWS * TILE;
const DIRECTIONS = { down: 0, up: 1, left: 2, right: 3 };
const MAX_PARTICLES = 100;
const flameKey = (x: number, y: number): number => y * COLS + x;

function sprite(
  texture: Texture,
  width: number,
  height: number,
  anchorX = 0.5,
  anchorY = 0.5,
): Sprite {
  const view = new Sprite(texture);
  view.anchor.set(anchorX, anchorY);
  view.width = width;
  view.height = height;
  return view;
}

export class ArenaRenderer {
  private readonly world = new Container();
  private readonly floors = new Container();
  private readonly hazards = new Container();
  private readonly shadows = new Container();
  private readonly objects = new Container();
  private readonly fire = new Container();
  private readonly effects = new Container();
  private readonly floorViews: Sprite[] = [];
  private readonly cellViews: Sprite[] = [];
  private readonly hazardViews: Sprite[] = [];
  private readonly pickupViews: Sprite[] = [];
  private readonly flameViews: Sprite[] = [];
  private readonly bombViews = new Map<number, BombView>();
  private readonly particles: Particle[] = [];
  private readonly freeParticles: Sprite[] = [];
  private readonly players: PlayerView[] = [];
  private readonly resizeObserver: ResizeObserver;
  private art: ArenaArt | null = null;
  private themeId = "";
  private cellSnapshot: Cell[] = [];
  private lastTick = -1;
  private lastTime = 0;
  private lastEventTick = -1;
  private lastState: GameState | null = null;
  private destroyed = false;
  private contextLost = false;
  private shake = 0;

  private constructor(
    private readonly app: Application,
    private readonly host: HTMLElement,
  ) {
    this.objects.sortableChildren = true;
    this.world.addChild(
      this.floors,
      this.hazards,
      this.shadows,
      this.objects,
      this.fire,
      this.effects,
    );
    app.stage.addChild(this.world);
    app.canvas.setAttribute(
      "aria-label",
      "Inkblast arena. Red player one and blue player two.",
    );
    app.canvas.setAttribute("role", "img");
    app.canvas.style.display = "block";
    app.canvas.style.width = "100%";
    app.canvas.style.height = "100%";
    host.appendChild(app.canvas);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    app.canvas.addEventListener("webglcontextlost", this.onContextLost);
    app.canvas.addEventListener("webglcontextrestored", this.onContextRestored);
    this.resize();
  }

  static async create(host: HTMLElement): Promise<ArenaRenderer> {
    const app = new Application();
    try {
      await app.init({
        width: WIDTH,
        height: HEIGHT,
        background: "#071722",
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoStart: false,
        sharedTicker: false,
        preference: "webgl",
        powerPreference: "high-performance",
      });
      return new ArenaRenderer(app, host);
    } catch (error) {
      if (app.renderer) app.destroy(true, { children: true });
      throw error;
    }
  }

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
  };

  get graphicsAvailable(): boolean {
    return !this.contextLost;
  }

  private readonly onContextRestored = (): void => {
    this.contextLost = false;
    this.resize();
    if (this.lastState) this.render(this.lastState);
  };

  private resize(): void {
    if (this.destroyed) return;
    const rect = this.host.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(
      1,
      Math.round(rect.height || (width * ROWS) / COLS),
    );
    this.app.renderer.resize(width, height);
    const scale = Math.min(width / WIDTH, height / HEIGHT);
    this.world.scale.set(scale);
    this.world.position.set(
      (width - WIDTH * scale) / 2,
      (height - HEIGHT * scale) / 2,
    );
    if (!this.contextLost) this.app.render();
  }

  private setup(state: GameState): void {
    for (const layer of [
      this.floors,
      this.hazards,
      this.shadows,
      this.objects,
      this.fire,
      this.effects,
    ]) {
      for (const child of layer.removeChildren()) child.destroy();
    }
    this.art?.destroy();
    this.floorViews.length = 0;
    this.cellViews.length = 0;
    this.hazardViews.length = 0;
    this.pickupViews.length = 0;
    this.flameViews.length = 0;
    this.particles.length = 0;
    this.freeParticles.length = 0;
    this.bombViews.clear();
    this.players.length = 0;
    this.art = createArenaArt(state.theme);
    this.themeId = state.theme.id;
    this.cellSnapshot = [];
    this.lastTick = -1;
    this.lastEventTick = -1;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const floor = sprite(this.art.floors[(x + y * 3) % 4], TILE, TILE);
        floor.position.set((x + 0.5) * TILE, (y + 0.5) * TILE);
        this.floors.addChild(floor);
        this.floorViews.push(floor);
        const cell = sprite(
          this.art.walls[(x * 7 + y) % 3],
          88,
          104,
          0.5,
          0.55,
        );
        cell.position.copyFrom(floor.position);
        cell.zIndex = (y + 0.5) * TILE;
        this.objects.addChild(cell);
        this.cellViews.push(cell);
        const hazard = sprite(this.art.hazard, TILE, TILE);
        hazard.position.copyFrom(floor.position);
        hazard.visible = this.hasHazard(state, x, y);
        const direction = hazardDirection(state, x, y);
        hazard.rotation =
          direction === "left"
            ? Math.PI
            : direction === "up"
              ? -Math.PI / 2
              : direction === "down"
                ? Math.PI / 2
                : 0;
        this.hazards.addChild(hazard);
        this.hazardViews.push(hazard);
        const flame = sprite(this.art.flames[0], TILE, TILE);
        flame.position.copyFrom(floor.position);
        flame.visible = false;
        this.fire.addChild(flame);
        this.flameViews.push(flame);
        const pickup = sprite(this.art.pickups.get("bomb")!, 67, 67);
        pickup.position.copyFrom(floor.position);
        pickup.visible = false;
        this.hazards.addChild(pickup);
        this.pickupViews.push(pickup);
      }
    }
    for (const player of state.players) {
      const shadow = sprite(this.art.shadow, 60, 23);
      const body = sprite(
        this.art.players[player.id][0][0],
        88,
        110,
        0.5,
        0.82,
      );
      this.shadows.addChild(shadow);
      this.objects.addChild(body);
      this.players.push({
        body,
        shadow,
        x: player.x,
        y: player.y,
        previousX: player.x,
        previousY: player.y,
        renderedX: player.x,
        renderedY: player.y,
        walkDistance: 0,
        diedAt: null,
        transitStarted: null,
        transitX: player.x,
        transitY: player.y,
      });
    }
  }

  private hasHazard(state: GameState, x: number, y: number): boolean {
    if (
      state.theme.hazard === "none" ||
      state.cells[y * COLS + x] !== "floor" ||
      x === 0 ||
      y === 0 ||
      x === COLS - 1 ||
      y === ROWS - 1
    )
      return false;
    return (
      hazardDirection(state, x, y) !== null ||
      hazardCells(state).some((point) => point.x === x && point.y === y) ||
      (state.theme.hazard === "regenerate" &&
        (state.runtime?.regen.some((entry) => entry.index === y * COLS + x) ??
          false))
    );
  }

  capturePositions(state: GameState): void {
    for (const player of state.players) {
      const view = this.players[player.id];
      if (!view) continue;
      view.previousX = player.x;
      view.previousY = player.y;
    }
  }

  render(state: GameState, alpha = 1): void {
    if (this.destroyed || this.contextLost) return;
    const changedRound =
      this.lastState !== null &&
      this.lastState.initialCells !== state.initialCells;
    this.lastState = state;
    if (
      !this.art ||
      this.themeId !== state.theme.id ||
      state.tick < this.lastTick ||
      changedRound
    )
      this.setup(state);
    const art = this.art!;
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, this.lastTime ? now - this.lastTime : 1 / 60);
    this.lastTime = now;
    const reduced = state.settings.reducedMotion;
    const time = reduced ? 0 : now;
    const newTick = state.tick !== this.lastTick;
    if (newTick) this.updateCells(state);
    for (const view of this.pickupViews) view.visible = false;
    for (const pickup of state.pickups) {
      const index = flameKey(pickup.x, pickup.y);
      const view = this.pickupViews[index];
      if (!view) continue;
      view.texture = art.pickups.get(
        state.settings.mysteryPickups ? "random" : pickup.type,
      )!;
      view.visible = true;
      view.y = (pickup.y + 0.5) * TILE + Math.sin(time * 3 + index) * 1.8;
    }
    this.updateBombs(state, time);
    this.updatePlayers(state, time, Math.max(0, Math.min(1, alpha)), newTick);
    this.updateFlames(state, time);
    if (newTick && state.tick !== this.lastEventTick) {
      this.lastEventTick = state.tick;
      for (const event of state.events) {
        if (event.type === "explode") {
          if (!reduced) this.shake = Math.min(5, this.shake + 2.8);
          this.burst(
            (event.x ?? 0) * TILE + TILE / 2,
            (event.y ?? 0) * TILE + TILE / 2,
            8,
            art.spark,
            0xffb73c,
            reduced,
          );
        } else if (event.type === "pickup") {
          this.burst(
            (event.x ?? 0) * TILE + TILE / 2,
            (event.y ?? 0) * TILE + TILE / 2,
            7,
            art.spark,
            0xfff4bb,
            reduced,
          );
        }
      }
    }
    this.updateParticles(dt, reduced);
    this.shake = Math.max(0, this.shake - dt * 24);
    this.objects.pivot.set(
      reduced ? 0 : Math.sin(time * 59) * this.shake,
      reduced ? 0 : Math.cos(time * 67) * this.shake * 0.6,
    );
    this.lastTick = state.tick;
    this.app.render();
  }

  private updateCells(state: GameState): void {
    const art = this.art!;
    for (let i = 0; i < state.cells.length; i++) {
      const cell = state.cells[i];
      const old = this.cellSnapshot[i];
      if (old === cell) continue;
      const view = this.cellViews[i];
      const x = i % COLS,
        y = Math.floor(i / COLS);
      view.visible = cell !== "floor";
      const edgeX = x === 0 || x === COLS - 1,
        edgeY = y === 0 || y === ROWS - 1;
      view.texture =
        cell === "brick"
          ? art.bricks[(x + y * 7) % 3]
          : edgeX || edgeY
            ? art.perimeter[edgeX && edgeY ? 2 : edgeY ? 0 : 1]
            : art.walls[(x * 7 + y) % 3];
      this.hazardViews[i].visible = this.hasHazard(state, x, y);
      if (old === "brick" && cell === "floor") {
        this.burst(
          (x + 0.5) * TILE,
          (y + 0.5) * TILE,
          7,
          art.debris,
          0xffffff,
          state.settings.reducedMotion,
        );
      }
      this.cellSnapshot[i] = cell;
    }
  }

  private updatePlayers(
    state: GameState,
    time: number,
    alpha: number,
    newTick: boolean,
  ): void {
    for (const player of state.players) {
      const view = this.players[player.id];
      const transit = state.runtime?.transits?.[player.id];
      if (transit && view.transitStarted !== transit.started) {
        view.transitStarted = transit.started;
        view.transitX = view.x;
        view.transitY = view.y;
      } else if (!transit) view.transitStarted = null;
      if (newTick) {
        view.x = player.x;
        view.y = player.y;
      }
      // Teleports must not sweep the sprite across the intervening tiles.
      if (
        Math.abs(player.x - view.previousX) +
          Math.abs(player.y - view.previousY) >
        UNIT
      ) {
        view.previousX = player.x;
        view.previousY = player.y;
      }
      let x = view.previousX + (player.x - view.previousX) * alpha;
      let y = view.previousY + (player.y - view.previousY) * alpha;
      const progress = transit
        ? Math.max(
            0,
            Math.min(
              1,
              (state.tick - transit.started + alpha) /
                (transit.until - transit.started),
            ),
          )
        : 0;
      const jump =
        transit?.type === "jump" && !state.settings.reducedMotion
          ? Math.sin(progress * Math.PI)
          : 0;
      if (transit?.type === "jump" && !state.settings.reducedMotion) {
        x = view.transitX + (transit.targetX * UNIT - view.transitX) * progress;
        y = view.transitY + (transit.targetY * UNIT - view.transitY) * progress;
      }
      const wx = (x / UNIT + 0.5) * TILE,
        wy = (y / UNIT + 0.5) * TILE;
      const distance =
        Math.abs(x - view.renderedX) + Math.abs(y - view.renderedY);
      const walking =
        distance > 0 && distance <= UNIT && !transit && player.alive;
      if (walking)
        view.walkDistance = (view.walkDistance + distance) % (2 * UNIT);
      view.renderedX = x;
      view.renderedY = y;
      const frames = this.art!.players[player.id][DIRECTIONS[player.direction]];
      const frame =
        walking && !state.settings.reducedMotion
          ? Math.floor((view.walkDistance / (2 * UNIT)) * frames.length)
          : 0;
      view.body.texture = frames[frame];
      view.body.position.set(wx, wy + 10 - jump * 75);
      view.body.zIndex = wy + 12 + jump * 85;
      view.shadow.position.set(wx, wy + 17);
      view.shadow.width = 60 * (1 - jump * 0.45);
      view.shadow.height = 23 * (1 - jump * 0.35);
      view.shadow.alpha = 1 - jump * 0.45;
      view.body.tint = player.diseases.length ? 0xc6f09e : 0xffffff;
      view.body.rotation = 0;
      view.body.alpha =
        player.invulnerableUntil > state.tick && Math.floor(time * 12) % 2
          ? 0.55
          : 1;
      view.body.width = 88;
      view.body.height = 110;
      if (transit?.type === "warp" && !state.settings.reducedMotion) {
        const visibility = Math.abs(2 * progress - 1);
        view.body.alpha *= visibility;
        view.body.width *= 0.5 + visibility * 0.5;
        view.shadow.alpha = visibility;
      }
      view.shadow.visible = player.alive;
      if (player.alive) {
        view.diedAt = null;
        view.body.visible = true;
        if (state.phase === "finished" && state.winner === player.id) {
          view.body.y -= Math.abs(Math.sin(time * 5)) * 7;
          view.body.rotation = Math.sin(time * 3) * 0.06;
        }
      } else {
        if (view.diedAt === null) view.diedAt = state.tick;
        const progress = Math.min(1, (state.tick - view.diedAt) / 36);
        view.body.visible = progress < 1;
        if (!state.settings.reducedMotion) {
          view.body.y -= Math.sin(progress * Math.PI) * 50;
          view.body.rotation = progress * Math.PI * 1.6 * (player.id ? 1 : -1);
        }
        view.body.alpha = 1 - progress;
      }
    }
  }

  private makeBombView(): BombView {
    const art = this.art!;
    const body = sprite(art.bombs[0], 77, 91, 0.5, 0.72);
    const shadow = sprite(art.shadow, 54, 20);
    const spark = sprite(art.spark, 30, 30);
    this.shadows.addChild(shadow);
    this.objects.addChild(body);
    this.effects.addChild(spark);
    return { body, shadow, spark, seen: true };
  }

  private bombPosition(
    bomb: Bomb,
    state: GameState,
  ): { x: number; y: number; lift: number } {
    if (bomb.state === "carried") {
      const owner = state.players[bomb.owner];
      return {
        x: (owner.x / UNIT + 0.5) * TILE,
        y: (owner.y / UNIT + 0.5) * TILE,
        lift: 62,
      };
    }
    return {
      x: (bomb.x + 0.5) * TILE,
      y: (bomb.y + 0.5) * TILE,
      lift:
        bomb.state === "airborne" ? 36 + Math.sin(bomb.travel * 0.16) * 22 : 0,
    };
  }

  private updateBombs(state: GameState, time: number): void {
    for (const view of this.bombViews.values()) view.seen = false;
    for (const bomb of state.bombs) {
      let view = this.bombViews.get(bomb.id);
      if (!view) {
        view = this.makeBombView();
        this.bombViews.set(bomb.id, view);
      }
      view.seen = true;
      const { x, y, lift } = this.bombPosition(bomb, state);
      const urgency =
        bomb.kind === "trigger" ? 0 : Math.max(0, 1 - bomb.fuse / 180);
      const pulse =
        1 + Math.sin(time * (5 + urgency * 10)) * (0.015 + urgency * 0.035);
      view.body.texture =
        this.art!.bombs[
          bomb.kind === "trigger" ? 1 : bomb.kind === "jelly" ? 2 : 0
        ];
      view.body.position.set(x, y + 12 - lift);
      view.body.width = 77 * pulse;
      view.body.height = 91 * pulse;
      view.body.zIndex = y + 10 + lift;
      view.body.rotation =
        bomb.state === "airborne" ? Math.sin(time * 8) * 0.15 : 0;
      view.shadow.position.set(x, y + 19);
      view.shadow.alpha = lift ? 0.45 : 1;
      view.spark.position.set(x + 10, y - 44 - lift);
      const sparkScale = 0.85 + Math.sin(time * 24 + bomb.id) * 0.16;
      view.spark.width = 29 * sparkScale;
      view.spark.height = 29 * sparkScale;
      view.spark.rotation = time * 2;
      view.spark.visible = bomb.kind !== "trigger";
    }
    for (const [id, view] of this.bombViews) {
      if (view.seen) continue;
      view.body.destroy();
      view.shadow.destroy();
      view.spark.destroy();
      this.bombViews.delete(id);
    }
  }

  private updateFlames(state: GameState, time: number): void {
    const indices = new Set(
      state.flames.map((flame) => flameKey(flame.x, flame.y)),
    );
    for (const view of this.flameViews) view.visible = false;
    for (const flame of state.flames) {
      const index = flameKey(flame.x, flame.y);
      const view = this.flameViews[index];
      if (!view) continue;
      const mask =
        (indices.has(index - COLS) ? 1 : 0) |
        (flame.x < COLS - 1 && indices.has(index + 1) ? 2 : 0) |
        (indices.has(index + COLS) ? 4 : 0) |
        (flame.x > 0 && indices.has(index - 1) ? 8 : 0);
      view.texture = this.art!.flames[mask];
      view.visible = true;
      view.alpha = 0.92 + Math.sin(time * 27 + index * 3) * 0.08;
      view.tint = Math.floor(time * 14 + index) % 3 === 0 ? 0xffedaf : 0xffffff;
    }
  }

  private burst(
    x: number,
    y: number,
    count: number,
    texture: Texture,
    tint: number,
    reduced: boolean,
  ): void {
    if (reduced) return;
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const view = this.freeParticles.pop() ?? sprite(texture, 17, 17);
      view.texture = texture;
      view.tint = tint;
      view.alpha = 1;
      view.visible = true;
      const size = 9 + ((i * 7) % 12);
      view.width = size;
      view.height = size;
      view.position.set(x, y);
      view.rotation = i;
      if (!view.parent) this.effects.addChild(view);
      const angle = i * 2.39996 + this.lastTick;
      const velocity = 85 + (i % 4) * 38;
      this.particles.push({
        sprite: view,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 80,
        age: 0,
        life: 0.4 + (i % 3) * 0.13,
        spin: (i % 2 ? -1 : 1) * 5,
      });
    }
  }

  private updateParticles(dt: number, reduced: boolean): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += reduced ? p.life : dt;
      if (p.age >= p.life) {
        p.sprite.visible = false;
        this.freeParticles.push(p.sprite);
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.vy += dt * 360;
      p.sprite.rotation += p.spin * dt;
      p.sprite.alpha = Math.min(1, (p.life - p.age) * 4);
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.resizeObserver.disconnect();
    this.app.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.app.canvas.removeEventListener(
      "webglcontextrestored",
      this.onContextRestored,
    );
    this.app.destroy({ removeView: true }, { children: true });
    this.art?.destroy();
    this.lastState = null;
  }
}
