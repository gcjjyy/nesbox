import { describe, expect, it } from "vitest";
import { stickButtons } from "./touch-stick";

const RECT = { left: 0, top: 0, width: 200, height: 200 };

function dirs(x: number, y: number) {
  return [...stickButtons(x, y, RECT)].sort();
}

describe("stickButtons", () => {
  it("ignores the deadzone around the center", () => {
    expect(dirs(100, 100)).toEqual([]);
    expect(dirs(110, 95)).toEqual([]);
  });

  it("maps directions inside the stick", () => {
    expect(dirs(180, 100)).toEqual(["right"]);
    expect(dirs(100, 20)).toEqual(["up"]);
    expect(dirs(30, 170)).toEqual(["down", "left"]);
  });

  it("keeps computing from the center when the finger leaves the stick", () => {
    expect(dirs(420, 110)).toEqual(["right"]);
    expect(dirs(-300, 90)).toEqual(["left"]);
    expect(dirs(100, -500)).toEqual(["up"]);
    expect(dirs(500, 500)).toEqual(["down", "right"]);
  });
});
