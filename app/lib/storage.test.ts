import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_KEY_BINDINGS } from "./control-profiles";
import { DEFAULT_SETTINGS, readSettings, writeSettings } from "./storage";

const values = new Map<string, string>();

beforeEach(() => {
  values.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("settings keyboard migration", () => {
  it("adds versioned defaults to legacy settings without changing display preferences", () => {
    values.set("nesbox:settings", JSON.stringify({ volume: 0.4, integerScale: true, touchControls: false }));

    expect(readSettings()).toEqual({
      volume: 0.4,
      integerScale: true,
      touchControls: false,
      keyBindingsVersion: 1,
      keyBindings: DEFAULT_KEY_BINDINGS,
      gamepad: { selectedDevice: null, devices: {} },
    });
  });

  it("preserves valid custom bindings, fills missing actions, and resets a duplicate profile", () => {
    values.set("nesbox:settings", JSON.stringify({
      volume: 0.6,
      keyBindingsVersion: 1,
      keyBindings: {
        nes: { b: ["KeyQ"] },
        mame: { b: ["KeyV"], y: ["KeyV"] },
      },
    }));

    const settings = readSettings();
    expect(settings.volume).toBe(0.6);
    expect(settings.keyBindings.nes.b).toEqual(["KeyQ"]);
    expect(settings.keyBindings.nes.a).toEqual(["KeyX"]);
    expect(settings.keyBindings.mame).toEqual(DEFAULT_KEY_BINDINGS.mame);
  });

  it("falls back safely for invalid JSON and persists the full versioned shape", () => {
    values.set("nesbox:settings", "{");
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);

    writeSettings(DEFAULT_SETTINGS);
    expect(JSON.parse(values.get("nesbox:settings")!)).toEqual(DEFAULT_SETTINGS);
  });

  it("persists device mappings and ignores malformed joystick settings", () => {
    const gamepad = { selectedDevice: "usb", devices: { usb: { nes: { a: [{ kind: "button" as const, index: 7 }] } } } };
    writeSettings({ ...DEFAULT_SETTINGS, gamepad });
    expect(readSettings().gamepad).toEqual(gamepad);
    values.set("nesbox:settings", JSON.stringify({ gamepad: { devices: false } }));
    expect(readSettings().gamepad).toEqual({ selectedDevice: null, devices: {} });
  });
});
