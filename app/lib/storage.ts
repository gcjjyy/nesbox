const SETTINGS_KEY = "nesbox:settings";

export interface UserSettings {
  volume: number;
  integerScale: boolean;
  touchControls: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  volume: 0.75,
  integerScale: false,
  touchControls: true,
};

export function readSettings(): UserSettings {
  if (typeof localStorage === "undefined") return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<UserSettings>;
    return {
      volume: clampNumber(parsed.volume, 0, 1, DEFAULT_SETTINGS.volume),
      integerScale: Boolean(parsed.integerScale ?? DEFAULT_SETTINGS.integerScale),
      touchControls: Boolean(parsed.touchControls ?? DEFAULT_SETTINGS.touchControls),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(settings: UserSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}
