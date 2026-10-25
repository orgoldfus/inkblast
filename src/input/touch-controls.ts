import type { Direction, InputFrame } from "../core/types";

type TouchAction = "bomb" | "action";

export function joystickDirection(
  x: number,
  y: number,
  previous: Direction | null,
  deadZone = 5,
): Direction | null {
  if (Math.hypot(x, y) < deadZone) return null;
  const horizontal = x < 0 ? "left" : "right";
  const vertical = y < 0 ? "up" : "down";
  // A small bias toward the current axis keeps diagonal thumb jitter from turning.
  if (
    (previous === "left" || previous === "right") &&
    Math.abs(y) < Math.abs(x) * 1.15
  )
    return horizontal;
  if (
    (previous === "up" || previous === "down") &&
    Math.abs(x) < Math.abs(y) * 1.15
  )
    return vertical;
  return Math.abs(x) >= Math.abs(y) ? horizontal : vertical;
}

export class TouchControls {
  private readonly abort = new AbortController();
  private readonly joystick: HTMLElement;
  private readonly buttons: Record<TouchAction, HTMLButtonElement>;
  private readonly actions = new Map<number, TouchAction>();
  private readonly edges = new Set<TouchAction>();
  private pointer: number | null = null;
  private direction: Direction | null = null;
  private center = { x: 0, y: 0 };
  private radius = 0;
  private restingCenter = { x: 0, y: 0 };

  constructor(host: HTMLElement, enabled: () => boolean) {
    this.joystick = host.querySelector<HTMLElement>("[data-joystick]")!;
    this.buttons = {
      bomb: host.querySelector<HTMLButtonElement>('[data-control="bomb"]')!,
      action: host.querySelector<HTMLButtonElement>('[data-control="action"]')!,
    };
    const options = { signal: this.abort.signal };
    host.addEventListener(
      "contextmenu",
      (event) => event.preventDefault(),
      options,
    );
    host.addEventListener(
      "pointerdown",
      (event) => {
        if (
          !enabled() ||
          event.button !== 0 ||
          !(event.target instanceof Element)
        )
          return;
        const target = event.target.closest<HTMLElement>(
          "[data-joystick], [data-control]",
        );
        if (!target || !host.contains(target)) return;
        event.preventDefault();
        if (target === this.joystick) {
          if (this.pointer !== null) return;
          const bounds = target.getBoundingClientRect();
          this.pointer = event.pointerId;
          this.restingCenter = {
            x: bounds.left + bounds.width / 2,
            y: bounds.top + bounds.height / 2,
          };
          this.center = { x: event.clientX, y: event.clientY };
          this.radius = bounds.width / 4;
          target.classList.add("engaged");
          this.move(event);
        } else {
          const action = target.dataset.control as TouchAction;
          if (![...this.actions.values()].includes(action))
            this.edges.add(action);
          this.actions.set(event.pointerId, action);
          target.classList.add("held");
        }
        target.setPointerCapture(event.pointerId);
      },
      options,
    );
    host.addEventListener(
      "pointermove",
      (event) => {
        if (!enabled() || event.pointerId !== this.pointer) return;
        event.preventDefault();
        this.move(event);
      },
      options,
    );
    host.addEventListener(
      "pointerup",
      (event) => this.release(event.pointerId),
      options,
    );
    for (const type of ["pointercancel", "lostpointercapture"] as const)
      host.addEventListener(
        type,
        (event) => this.release(event.pointerId, true),
        options,
      );
    host.addEventListener(
      "click",
      (event) => {
        if (
          !enabled() ||
          event.detail !== 0 ||
          !(event.target instanceof Element)
        )
          return;
        const button =
          event.target.closest<HTMLButtonElement>("[data-control]");
        if (button) this.edges.add(button.dataset.control as TouchAction);
      },
      options,
    );
    window.addEventListener("resize", () => this.clear(), options);
  }

  private move(event: PointerEvent): void {
    let x = event.clientX - this.center.x;
    let y = event.clientY - this.center.y;
    const distance = Math.hypot(x, y);
    // Follow long drags so changing direction never requires returning to the pad.
    if (distance > this.radius) {
      this.center.x = event.clientX - (x / distance) * this.radius;
      this.center.y = event.clientY - (y / distance) * this.radius;
      x = event.clientX - this.center.x;
      y = event.clientY - this.center.y;
    }
    this.joystick.style.setProperty(
      "--origin-x",
      `${this.center.x - this.restingCenter.x}px`,
    );
    this.joystick.style.setProperty(
      "--origin-y",
      `${this.center.y - this.restingCenter.y}px`,
    );
    this.direction = joystickDirection(x, y, this.direction);
    this.joystick.dataset.direction = this.direction ?? "";
    this.joystick.style.setProperty("--stick-x", `${x}px`);
    this.joystick.style.setProperty("--stick-y", `${y}px`);
  }

  private release(pointer: number, cancelled = false): void {
    let target: HTMLElement;
    if (pointer === this.pointer) {
      this.pointer = null;
      this.direction = null;
      target = this.joystick;
      target.classList.remove("engaged");
      target.dataset.direction = "";
      target.style.removeProperty("--origin-x");
      target.style.removeProperty("--origin-y");
      target.style.removeProperty("--stick-x");
      target.style.removeProperty("--stick-y");
    } else {
      const action = this.actions.get(pointer);
      if (!action) return;
      this.actions.delete(pointer);
      target = this.buttons[action];
      if (![...this.actions.values()].includes(action)) {
        target.classList.remove("held");
        if (cancelled) this.edges.delete(action);
      }
    }
    if (target.hasPointerCapture(pointer))
      target.releasePointerCapture(pointer);
  }

  read(): InputFrame {
    return {
      direction: this.direction,
      bomb: this.edges.delete("bomb"),
      action: this.edges.delete("action"),
    };
  }

  clear(): void {
    if (this.pointer !== null) this.release(this.pointer);
    for (const pointer of this.actions.keys()) this.release(pointer);
    this.edges.clear();
  }

  destroy(): void {
    this.clear();
    this.abort.abort();
  }
}
