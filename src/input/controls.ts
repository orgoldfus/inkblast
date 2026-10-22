import { EMPTY_INPUT, type Direction, type InputFrame } from "../core/types";
import { TouchControls } from "./touch-controls";

export type Binding = Record<Direction | "bomb" | "action", string>;
export const DEFAULT_BINDINGS: [Binding, Binding] = [
  {
    up: "KeyW",
    down: "KeyS",
    left: "KeyA",
    right: "KeyD",
    bomb: "Space",
    action: "KeyE",
  },
  {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    bomb: "Enter",
    action: "ShiftRight",
  },
];
export const SOLO_BINDINGS = {
  wasd: DEFAULT_BINDINGS[0],
  arrows: {
    ...DEFAULT_BINDINGS[1],
    bomb: DEFAULT_BINDINGS[0].bomb,
    action: DEFAULT_BINDINGS[0].action,
  },
} satisfies Record<string, Binding>;

export function isBinding(value: unknown): value is Binding {
  if (!value || typeof value !== "object") return false;
  const binding = value as Record<string, unknown>;
  return Object.keys(DEFAULT_BINDINGS[0]).every(
    (key) =>
      typeof binding[key] === "string" && /^[A-Za-z0-9]+$/.test(binding[key]),
  );
}

export type InputAssignment = "keyboard" | "mixed" | "gamepads";
export class Controls {
  bindings: [Binding, Binding] = structuredClone(DEFAULT_BINDINGS);
  soloBinding: Binding = { ...SOLO_BINDINGS.wasd };
  solo = false;
  assignment: InputAssignment = "keyboard";
  private keys = new Map<string, number>();
  private pressed = new Set<string>();
  private touch?: TouchControls;
  private padButtons = new Map<number, boolean[]>();
  private pauseButtons = new Map<number, boolean>();
  private order = 0;
  private abort = new AbortController();
  onPause: () => void = () => {};
  enabled = false;
  get activeBindings(): Binding[] {
    return this.solo ? [this.soloBinding] : this.bindings;
  }
  constructor() {
    const options = { signal: this.abort.signal };
    window.addEventListener(
      "keydown",
      (event) => {
        if (
          !this.enabled ||
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLSelectElement ||
          event.target instanceof HTMLTextAreaElement ||
          (event.target instanceof HTMLElement &&
            event.target.isContentEditable)
        )
          return;
        if (event.code === "Escape") {
          event.preventDefault();
          if (!event.repeat) this.onPause();
          return;
        }
        if (
          !this.activeBindings.some((binding) =>
            Object.values(binding).includes(event.code),
          )
        )
          return;
        event.preventDefault();
        if (!this.keys.has(event.code)) {
          this.keys.set(event.code, ++this.order);
          this.pressed.add(event.code);
        }
      },
      options,
    );
    window.addEventListener(
      "keyup",
      (event) => this.keys.delete(event.code),
      options,
    );
    window.addEventListener("blur", () => this.clear(), options);
  }
  bindTouch(host: HTMLElement): void {
    this.touch?.destroy();
    this.touch = new TouchControls(host, () => this.enabled);
  }
  pollPause(): void {
    let pausePressed = false;
    for (const pad of this.gamepads()) {
      const pressed = pad.buttons[9]?.pressed ?? false;
      if (
        this.assignment !== "keyboard" &&
        pressed &&
        !this.pauseButtons.get(pad.index)
      )
        pausePressed = true;
      this.pauseButtons.set(pad.index, pressed);
    }
    if (pausePressed) this.onPause();
  }
  private gamepads(): Gamepad[] {
    return Array.from(navigator.getGamepads?.() ?? []).filter(
      (pad): pad is Gamepad => !!pad,
    );
  }
  read(player: 0 | 1): InputFrame {
    if (!this.enabled || (this.solo && player === 1)) return { ...EMPTY_INPUT };
    const binding = this.activeBindings[player];
    const usesKeyboard =
      this.assignment === "keyboard" ||
      (this.assignment === "mixed" && player === 0);
    const frame: InputFrame = { ...EMPTY_INPUT };
    if (usesKeyboard) {
      const directions: Direction[] = ["up", "down", "left", "right"];
      const chosen = directions
        .filter((direction) => this.keys.has(binding[direction]))
        .sort(
          (a, b) => this.keys.get(binding[b])! - this.keys.get(binding[a])!,
        )[0];
      frame.direction = chosen ?? null;
      frame.bomb = this.pressed.delete(binding.bomb);
      frame.action = this.pressed.delete(binding.action);
    }
    if (player === 0) {
      const touch = this.touch?.read();
      if (touch?.direction) frame.direction = touch.direction;
      frame.bomb ||= touch?.bomb ?? false;
      frame.action ||= touch?.action ?? false;
    }
    const pads = this.gamepads();
    const padIndex = this.assignment === "mixed" ? player - 1 : player;
    const pad =
      this.assignment !== "keyboard" && padIndex >= 0 ? pads[padIndex] : null;
    if (pad) {
      const pressed = pad.buttons.map((button) => button.pressed);
      const previous = this.padButtons.get(pad.index) ?? [];
      const axisX = pad.axes[0] ?? 0;
      const axisY = pad.axes[1] ?? 0;
      if (pressed[12]) frame.direction = "up";
      else if (pressed[13]) frame.direction = "down";
      else if (pressed[14]) frame.direction = "left";
      else if (pressed[15]) frame.direction = "right";
      else if (Math.abs(axisX) > 0.35 || Math.abs(axisY) > 0.35)
        frame.direction =
          Math.abs(axisX) > Math.abs(axisY)
            ? axisX < 0
              ? "left"
              : "right"
            : axisY < 0
              ? "up"
              : "down";
      frame.bomb ||= !!pressed[0] && !previous[0];
      frame.action ||= !!pressed[1] && !previous[1];
      this.padButtons.set(pad.index, pressed);
    }
    return frame;
  }
  clear(): void {
    this.keys.clear();
    this.pressed.clear();
    this.touch?.clear();
    this.padButtons.clear();
    this.pauseButtons.clear();
    for (const pad of this.gamepads()) {
      this.padButtons.set(
        pad.index,
        pad.buttons.map((button) => button.pressed),
      );
      this.pauseButtons.set(pad.index, pad.buttons[9]?.pressed ?? false);
    }
  }
  destroy(): void {
    this.abort.abort();
    this.clear();
    this.touch?.destroy();
  }
}

export function keyLabel(code: string): string {
  return code
    .replace("Key", "")
    .replace("Digit", "")
    .replace("Arrow", "")
    .replace("ShiftRight", "Right Shift")
    .replace("ShiftLeft", "Left Shift");
}
