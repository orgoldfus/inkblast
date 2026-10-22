import { EMPTY_INPUT, type Direction, type InputFrame } from "../core/types";

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
export type InputAssignment = "keyboard" | "mixed" | "gamepads";
export class Controls {
  bindings: [Binding, Binding] = structuredClone(DEFAULT_BINDINGS);
  assignment: InputAssignment = "keyboard";
  private keys = new Map<string, number>();
  private pressed = new Set<string>();
  private touch = new Map<number, string>();
  private touchEdges = new Set<string>();
  private padButtons = new Map<number, boolean[]>();
  private pauseButtons = new Map<number, boolean>();
  private order = 0;
  private abort = new AbortController();
  onPause: () => void = () => {};
  enabled = false;
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
          !this.bindings.some((binding) =>
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
    const options = { signal: this.abort.signal };
    host.addEventListener(
      "pointerdown",
      (event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
          "[data-control]",
        );
        if (!button || !this.enabled) return;
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        const value = button.dataset.control!;
        this.touch.set(event.pointerId, value);
        this.touchEdges.add(value);
        button.classList.add("held");
      },
      options,
    );
    host.addEventListener(
      "pointermove",
      (event) => {
        if (!this.enabled || !this.touch.has(event.pointerId)) return;
        const previous = this.touch.get(event.pointerId)!;
        if (previous === "bomb" || previous === "action") return;
        const button = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest<HTMLButtonElement>("[data-control]");
        const next =
          button && host.contains(button) ? button.dataset.control : null;
        if (
          !next ||
          next === previous ||
          !["up", "down", "left", "right"].includes(next)
        )
          return;
        host
          .querySelector(`[data-control="${previous}"]`)
          ?.classList.remove("held");
        this.touch.set(event.pointerId, next);
        button!.classList.add("held");
      },
      options,
    );
    const release = (event: PointerEvent) => {
      this.touch.delete(event.pointerId);
      (event.target as HTMLElement).closest("button")?.classList.remove("held");
    };
    host.addEventListener("pointerup", release, options);
    host.addEventListener("pointercancel", release, options);
    host.addEventListener("lostpointercapture", release, options);
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
    if (!this.enabled) return { ...EMPTY_INPUT };
    const binding = this.bindings[player];
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
      for (const value of this.touch.values()) {
        if (["up", "down", "left", "right"].includes(value))
          frame.direction = value as Direction;
      }
      const bomb = this.touchEdges.delete("bomb");
      const action = this.touchEdges.delete("action");
      frame.bomb ||= bomb;
      frame.action ||= action;
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
    this.touch.clear();
    this.touchEdges.clear();
    document
      .querySelectorAll("[data-control].held")
      .forEach((button) => button.classList.remove("held"));
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
