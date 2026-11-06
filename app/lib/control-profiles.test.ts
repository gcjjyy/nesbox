import { describe, expect, it, vi } from "vitest";
import type { GameEntry } from "./game-types";
import {
  DEFAULT_KEY_BINDINGS,
  controlProfileForGame,
  controlGuideRows,
  createKeyboardInputRouter,
  createPressedInputTracker,
  gamepadMapForProfile,
  keyboardMapForProfile,
  keyCodeLabel,
  normalizeKeyboardBindings,
} from "./control-profiles";

describe("control profiles", () => {
  it("defines the exact NES and six-button MAME keyboard defaults", () => {
    expect(DEFAULT_KEY_BINDINGS.nes).toEqual({
      up: ["ArrowUp"],
      down: ["ArrowDown"],
      left: ["ArrowLeft"],
      right: ["ArrowRight"],
      select: ["ShiftLeft", "ShiftRight"],
      start: ["Enter"],
      b: ["KeyZ"],
      a: ["KeyX"],
    });
    expect(DEFAULT_KEY_BINDINGS.mame).toEqual({
      up: ["ArrowUp"],
      down: ["ArrowDown"],
      left: ["ArrowLeft"],
      right: ["ArrowRight"],
      select: ["ShiftLeft", "ShiftRight"],
      start: ["Enter"],
      b: ["KeyZ"],
      y: ["KeyX"],
      a: ["KeyC"],
      x: ["KeyA"],
      l: ["KeyS"],
      r: ["KeyD"],
    });
    expect(keyboardMapForProfile(DEFAULT_KEY_BINDINGS, "mame").get("KeyD")).toBe("r");
  });

  it("maps MAME gamepad buttons 0 through 5 to actions 1 through 6", () => {
    const map = gamepadMapForProfile("mame");
    expect([0, 1, 2, 3, 4, 5].map((index) => map.get(index))).toEqual(["b", "y", "a", "x", "l", "r"]);
    expect(map.get(8)).toBe("select");
    expect(map.get(9)).toBe("start");
  });

  it("selects one MAME profile for both arcade cores", () => {
    expect(controlProfileForGame(game("mame2003-plus", "arcade"))).toBe("mame");
    expect(controlProfileForGame(game("fbneo", "arcade"))).toBe("mame");
    expect(controlProfileForGame(game("fceux", "nes"))).toBe("nes");
  });

  it("fills partial bindings and rejects duplicate codes within one profile", () => {
    const normalized = normalizeKeyboardBindings({
      nes: { b: ["KeyQ"] },
      mame: { b: ["KeyV"], y: ["KeyV"] },
    });
    expect(normalized.nes.b).toEqual(["KeyQ"]);
    expect(normalized.nes.a).toEqual(["KeyX"]);
    expect(normalized.mame).toEqual(DEFAULT_KEY_BINDINGS.mame);
    expect(normalized).not.toBe(DEFAULT_KEY_BINDINGS);
  });

  it("formats KeyboardEvent.code values for guides", () => {
    expect(keyCodeLabel("KeyZ")).toBe("Z");
    expect(keyCodeLabel("ArrowLeft")).toBe("←");
    expect(keyCodeLabel("ShiftRight")).toBe("Shift");
  });

  it("builds NES and MAME guide rows from the current bindings", () => {
    const bindings = normalizeKeyboardBindings({
      nes: { b: ["KeyQ"] },
      mame: { r: ["Numpad6"] },
    });

    expect(controlGuideRows("nes", bindings)).toEqual([
      { id: "directions", label: "방향", keys: ["↑", "↓", "←", "→"] },
      { id: "select", label: "Select", keys: ["Shift", "Shift"] },
      { id: "start", label: "Start", keys: ["Enter"] },
      { id: "b", label: "B", keys: ["Q"] },
      { id: "a", label: "A", keys: ["X"] },
    ]);
    expect(controlGuideRows("mame", bindings).map((row) => [row.label, row.keys.join(" / ")])).toEqual([
      ["방향", "↑ / ↓ / ← / →"],
      ["Coin", "Shift / Shift"],
      ["Start", "Enter"],
      ["버튼 1", "Z"],
      ["버튼 2", "X"],
      ["버튼 3", "C"],
      ["버튼 4", "A"],
      ["버튼 5", "S"],
      ["버튼 6", "Num 6"],
    ]);
  });
});

describe("pressed input tracker", () => {
  it("deduplicates repeated state and releases every held button once", () => {
    const send = vi.fn();
    const tracker = createPressedInputTracker(send);
    tracker.set("b", true);
    tracker.set("b", true);
    tracker.set("a", true);
    tracker.set("b", false);
    tracker.set("b", false);
    tracker.releaseAll();
    tracker.releaseAll();

    expect(send.mock.calls).toEqual([
      ["b", true],
      ["a", true],
      ["b", false],
      ["a", false],
    ]);
  });
});

describe("keyboard input router", () => {
  it("deduplicates repeats, ignores form/contenteditable and suspended input, and releases held keys", () => {
    const send = vi.fn();
    let suspended = false;
    const router = createKeyboardInputRouter({
      resolveButton: (code) => keyboardMapForProfile(DEFAULT_KEY_BINDINGS, "nes").get(code),
      send,
      isSuspended: () => suspended,
    });
    const preventDefault = vi.fn();
    const gameEvent = { code: "KeyZ", target: null, preventDefault };

    router.keyDown(gameEvent);
    router.keyDown({ ...gameEvent, repeat: true });
    router.keyDown({ code: "KeyX", target: { tagName: "INPUT" }, preventDefault });
    router.keyDown({ code: "KeyX", target: { isContentEditable: true }, preventDefault });
    suspended = true;
    router.keyDown({ code: "KeyX", target: null, preventDefault });
    router.releaseAll();

    expect(send.mock.calls).toEqual([["b", true], ["b", false]]);
    expect(preventDefault).toHaveBeenCalledTimes(2);
  });

  it("keeps a logical button pressed while either alternative code remains held", () => {
    const send = vi.fn();
    const router = createKeyboardInputRouter({
      resolveButton: (code) => keyboardMapForProfile(DEFAULT_KEY_BINDINGS, "nes").get(code),
      send,
      isSuspended: () => false,
    });
    const event = (code: string) => ({ code, target: null, preventDefault: vi.fn() });
    router.keyDown(event("ShiftLeft"));
    router.keyDown(event("ShiftRight"));
    router.keyUp(event("ShiftLeft"));
    router.keyUp(event("ShiftRight"));

    expect(send.mock.calls).toEqual([["select", true], ["select", false]]);
  });
});

function game(emulatorId: string, system: string): GameEntry {
  return {
    id: `${system}:${emulatorId}:fixture`,
    title: "fixture",
    fileName: "fixture.zip",
    system,
    emulatorId,
    size: 1,
    addedAt: 1,
    lastPlayedAt: null,
    originalTitle: null,
    hasCover: false,
    pinned: false,
  };
}
