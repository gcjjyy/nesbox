import { DEFAULT_KEY_BINDINGS, normalizeKeyboardBindings, type KeyboardBindings } from "./control-profiles";
import { normalizeGamepadSettings, type GamepadSettings } from "./gamepad-input";

const SETTINGS_KEY = "nesbox:settings";

export interface UserSettings {
  volume: number;
  integerScale: boolean;
  touchControls: boolean;
  keyBindingsVersion: 1;
  keyBindings: KeyboardBindings;
  gamepad: GamepadSettings;
}

export const DEFAULT_SETTINGS: UserSettings = {
  volume: 0.75,
  integerScale: false,
  touchControls: true,
  keyBindingsVersion: 1,
  keyBindings: DEFAULT_KEY_BINDINGS,
  gamepad: { selectedDevice: null, devices: {} },
};

export function readSettings(): UserSettings {
  if (typeof localStorage === "undefined") return cloneDefaultSettings();
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<UserSettings>;
    return {
      volume: clampNumber(parsed.volume, 0, 1, DEFAULT_SETTINGS.volume),
      integerScale: Boolean(parsed.integerScale ?? DEFAULT_SETTINGS.integerScale),
      touchControls: Boolean(parsed.touchControls ?? DEFAULT_SETTINGS.touchControls),
      keyBindingsVersion: 1,
      keyBindings: normalizeKeyboardBindings(parsed.keyBindings),
      gamepad: normalizeGamepadSettings(parsed.gamepad),
    };
  } catch {
    return cloneDefaultSettings();
  }
}

function cloneDefaultSettings(): UserSettings {
  return {
    ...DEFAULT_SETTINGS,
    keyBindings: normalizeKeyboardBindings(DEFAULT_KEY_BINDINGS),
    gamepad: normalizeGamepadSettings(null),
  };
}

export function writeSettings(settings: UserSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}
