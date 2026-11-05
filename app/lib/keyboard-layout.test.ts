import { describe, expect, it } from "vitest";
import { KEYBOARD_MAP } from "./keyboard-layout";

describe("keyboard layout", () => {
  it("maps arrows + Z/X with Enter / Shift", () => {
    expect(KEYBOARD_MAP.get("ArrowUp")).toBe("up");
    expect(KEYBOARD_MAP.get("ArrowLeft")).toBe("left");
    expect(KEYBOARD_MAP.get("KeyZ")).toBe("b");
    expect(KEYBOARD_MAP.get("KeyX")).toBe("a");
    expect(KEYBOARD_MAP.get("Enter")).toBe("start");
    expect(KEYBOARD_MAP.get("ShiftLeft")).toBe("select");
    expect(KEYBOARD_MAP.get("ShiftRight")).toBe("select");
    expect(KEYBOARD_MAP.size).toBe(9);
  });

  it("binds no Y / X keys since the NES pad has only A and B", () => {
    const buttons = [...KEYBOARD_MAP.values()];
    expect(buttons).not.toContain("y");
    expect(buttons).not.toContain("x");
  });
});
