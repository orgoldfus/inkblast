import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Controls,
  DEFAULT_BINDINGS,
  SOLO_BINDINGS,
} from "../src/input/controls";
import { Sound } from "../src/audio/sound";
import { DEFAULT_SETTINGS } from "../src/rules/settings";

let controls: Controls | undefined;
let windowTarget: EventTarget;
let pads: (Gamepad | null)[];

function gamepad(index = 0): Gamepad {
  return {
    index,
    buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
    axes: [0, 0],
  } as unknown as Gamepad;
}
function press(pad: Gamepad, index: number, value: boolean): void {
  (pad.buttons[index] as { pressed: boolean }).pressed = value;
}
function key(type: "keydown" | "keyup", code: string): void {
  windowTarget.dispatchEvent(
    Object.assign(new Event(type, { cancelable: true }), {
      code,
      repeat: false,
    }),
  );
}

beforeEach(() => {
  windowTarget = new EventTarget();
  pads = [];
  vi.stubGlobal("window", windowTarget);
  vi.stubGlobal("document", { querySelectorAll: () => [] });
  vi.stubGlobal("navigator", { getGamepads: () => pads });
  for (const name of [
    "HTMLInputElement",
    "HTMLSelectElement",
    "HTMLTextAreaElement",
    "HTMLElement",
  ])
    vi.stubGlobal(name, class {});
});
afterEach(() => {
  controls?.destroy();
  controls = undefined;
  vi.unstubAllGlobals();
});

describe("duel controls", () => {
  it.each(["wasd", "arrows"] as const)(
    "uses the %s solo preset for every direction, bomb and action",
    (preset) => {
      controls = new Controls();
      controls.solo = true;
      controls.soloBinding = { ...SOLO_BINDINGS[preset] };
      controls.enabled = true;
      for (const direction of ["up", "down", "left", "right"] as const) {
        const code = controls.soloBinding[direction];
        key("keydown", code);
        expect(controls.read(0).direction).toBe(direction);
        expect(controls.read(1).direction).toBeNull();
        key("keyup", code);
        expect(controls.read(0).direction).toBeNull();
      }
      key("keydown", "Space");
      key("keyup", "Space");
      key("keydown", "KeyE");
      key("keyup", "KeyE");
      expect(controls.read(0)).toMatchObject({ bomb: true, action: true });
      expect(controls.read(0)).toMatchObject({ bomb: false, action: false });
      const other = preset === "arrows" ? "KeyW" : "ArrowUp";
      key("keydown", other);
      expect(controls.read(0).direction).toBeNull();
    },
  );

  it("restores independent local controls after playing solo with arrows", () => {
    controls = new Controls();
    controls.solo = true;
    controls.soloBinding = { ...SOLO_BINDINGS.arrows };
    controls.enabled = true;
    key("keydown", "ArrowRight");
    expect(controls.read(0).direction).toBe("right");
    controls.clear();
    controls.solo = false;
    key("keydown", "KeyA");
    key("keydown", "ArrowRight");
    expect(controls.read(0).direction).toBe("left");
    expect(controls.read(1).direction).toBe("right");
    expect(controls.bindings).toEqual(DEFAULT_BINDINGS);
  });

  it("keeps the latest held direction and queues a short bomb press exactly once", () => {
    controls = new Controls();
    controls.enabled = true;
    key("keydown", "KeyW");
    key("keydown", "KeyD");
    expect(controls.read(0).direction).toBe("right");
    key("keyup", "KeyD");
    expect(controls.read(0).direction).toBe("up");
    key("keydown", "Space");
    key("keyup", "Space");
    expect(controls.read(0).bomb).toBe(true);
    expect(controls.read(0).bomb).toBe(false);
  });

  it("allows gamepad pause and resume edges while gameplay input is disabled", () => {
    const pad = gamepad();
    pads = [pad];
    controls = new Controls();
    controls.assignment = "gamepads";
    const pause = vi.fn(() => controls!.clear());
    controls.onPause = pause;
    press(pad, 9, true);
    controls.pollPause();
    controls.pollPause();
    expect(pause).toHaveBeenCalledTimes(1);
    press(pad, 9, false);
    controls.pollPause();
    press(pad, 9, true);
    controls.pollPause();
    expect(pause).toHaveBeenCalledTimes(2);
  });

  it("does not replant a held gamepad bomb after a pause or new round", () => {
    const pad = gamepad();
    pads = [null, pad];
    controls = new Controls();
    controls.assignment = "gamepads";
    controls.enabled = true;
    press(pad, 0, true);
    controls.clear();
    expect(controls.read(0).bomb).toBe(false);
    press(pad, 0, false);
    controls.read(0);
    press(pad, 0, true);
    expect(controls.read(0).bomb).toBe(true);
    expect(controls.read(0).bomb).toBe(false);
  });

  it("uses the dominant stick direction and prioritizes the D-pad over stick drift", () => {
    const pad = gamepad();
    pads = [pad];
    controls = new Controls();
    controls.assignment = "gamepads";
    controls.enabled = true;
    (pad.axes as number[])[0] = 0.4;
    (pad.axes as number[])[1] = -0.9;
    expect(controls.read(0).direction).toBe("up");
    press(pad, 13, true);
    expect(controls.read(0).direction).toBe("down");
  });

  it("keeps keyboard player one and gamepad player two separate", () => {
    const pad = gamepad();
    pads = [pad];
    controls = new Controls();
    controls.assignment = "mixed";
    controls.enabled = true;
    key("keydown", "KeyA");
    press(pad, 15, true);
    press(pad, 0, true);
    expect(controls.read(0)).toMatchObject({ direction: "left", bomb: false });
    expect(controls.read(1)).toMatchObject({ direction: "right", bomb: true });
  });
});

describe("sound levels", () => {
  it("clamps malformed stored levels before connecting them to output gains", async () => {
    const gains: { gain: { value: number }; connect: () => void }[] = [];
    vi.stubGlobal(
      "AudioContext",
      class {
        state = "running";
        destination = {};
        createGain() {
          const gain = { gain: { value: 1 }, connect() {} };
          gains.push(gain);
          return gain;
        }
      },
    );
    const sound = new Sound();
    sound.configure({
      ...DEFAULT_SETTINGS,
      music: 100,
      effects: -2,
      voices: Infinity,
    });
    await sound.unlock();
    expect(gains.map((node) => node.gain.value)).toEqual([0.6, 0, 0]);
    sound.configure({
      ...DEFAULT_SETTINGS,
      music: 0.5,
      effects: 0.5,
      voices: 0.5,
    });
    expect(gains.map((node) => node.gain.value)).toEqual([0.3, 0.175, 0.1]);
  });
});
