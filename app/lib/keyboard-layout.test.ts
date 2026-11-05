import { describe, expect, it } from "vitest";
import { isKeyboardLayoutId, keyboardMap } from "./keyboard-layout";

describe("keyboard layouts", () => {
  it("maps arrows + Z/X by default layout", () => {
    const map = keyboardMap("arrows");
    expect(map.get("ArrowUp")).toBe("up");
    expect(map.get("KeyZ")).toBe("b");
    expect(map.get("KeyX")).toBe("a");
    expect(map.get("Enter")).toBe("start");
    expect(map.get("KeyW")).toBeUndefined();
  });

  it("maps WASD + [ ] layout without leftover arrow bindings", () => {
    const map = keyboardMap("wasd");
    expect(map.get("KeyW")).toBe("up");
    expect(map.get("KeyA")).toBe("left");
    expect(map.get("KeyS")).toBe("down");
    expect(map.get("KeyD")).toBe("right");
    expect(map.get("BracketLeft")).toBe("b");
    expect(map.get("BracketRight")).toBe("a");
    expect(map.get("ShiftLeft")).toBe("select");
    expect(map.get("ArrowUp")).toBeUndefined();
    expect(map.get("KeyZ")).toBeUndefined();
  });

  it("gives every key exactly one button per layout", () => {
    for (const id of ["arrows", "wasd"] as const) {
      expect(keyboardMap(id).size).toBe(11);
    }
  });

  it("validates stored layout ids", () => {
    expect(isKeyboardLayoutId("wasd")).toBe(true);
    expect(isKeyboardLayoutId("ijkl")).toBe(false);
    expect(isKeyboardLayoutId(undefined)).toBe(false);
  });
});
