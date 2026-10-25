import { describe, expect, it } from "vitest";
import { joystickDirection } from "../src/input/touch-controls";

describe("joystick steering", () => {
  it.each([
    [40, 0, "right"],
    [-40, 0, "left"],
    [0, -40, "up"],
    [0, 40, "down"],
    [200, 30, "right"],
  ] as const)("steers from (%s, %s) toward %s", (x, y, expected) => {
    expect(joystickDirection(x, y, null)).toBe(expected);
  });

  it("registers short thumb movements and forgiving angled turns", () => {
    expect(joystickDirection(6, 2, null)).toBe("right");
    expect(joystickDirection(-2, -6, null)).toBe("up");
    expect(joystickDirection(25, 30, "right")).toBe("down");
    expect(joystickDirection(30, 25, "down")).toBe("right");
  });

  it("returns to neutral near the center even after moving", () => {
    expect(joystickDirection(0, 0, null)).toBeNull();
    expect(joystickDirection(3, -3, "right")).toBeNull();
    expect(joystickDirection(-2, 3, "up")).toBeNull();
  });

  it("absorbs diagonal jitter but responds to deliberate corners and reversals", () => {
    expect(joystickDirection(30, 31, "right")).toBe("right");
    expect(joystickDirection(31, 30, "down")).toBe("down");
    expect(joystickDirection(30, 40, "right")).toBe("down");
    expect(joystickDirection(40, 30, "down")).toBe("right");
    expect(joystickDirection(-40, 5, "right")).toBe("left");
    expect(joystickDirection(5, -40, "down")).toBe("up");
  });
});
