import type { NesboxButton } from "./core-contract";
import type { GameEntry } from "./game-types";

export type ControlProfileId = "nes" | "mame";
export type ControlBindings = Partial<Record<NesboxButton, readonly string[]>>;
export type KeyboardBindings = Record<ControlProfileId, ControlBindings>;

export interface ControlGuideRow {
  id: "directions" | NesboxButton;
  label: string;
  keys: string[];
}

const NES_BUTTONS = ["up", "down", "left", "right", "select", "start", "b", "a"] as const satisfies readonly NesboxButton[];
const MAME_BUTTONS = [
  "up", "down", "left", "right", "select", "start", "b", "y", "a", "x", "l", "r",
] as const satisfies readonly NesboxButton[];

export const DEFAULT_KEY_BINDINGS: KeyboardBindings = {
  nes: {
    up: ["ArrowUp"],
    down: ["ArrowDown"],
    left: ["ArrowLeft"],
    right: ["ArrowRight"],
    select: ["ShiftLeft", "ShiftRight"],
    start: ["Enter"],
    b: ["KeyZ"],
    a: ["KeyX"],
  },
  mame: {
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
  },
};

const NES_GAMEPAD = new Map<number, NesboxButton>([
  [0, "b"],
  [1, "a"],
  [8, "select"],
  [9, "start"],
  [12, "up"],
  [13, "down"],
  [14, "left"],
  [15, "right"],
]);

const MAME_GAMEPAD = new Map<number, NesboxButton>([
  [0, "b"],
  [1, "y"],
  [2, "a"],
  [3, "x"],
  [4, "l"],
  [5, "r"],
  [8, "select"],
  [9, "start"],
  [12, "up"],
  [13, "down"],
  [14, "left"],
  [15, "right"],
]);

export function controlProfileForGame(game: Pick<GameEntry, "emulatorId" | "system">): ControlProfileId {
  return game.system === "arcade" || game.emulatorId === "mame2003-plus" || game.emulatorId === "fbneo"
    ? "mame"
    : "nes";
}

export function keyboardMapForProfile(bindings: KeyboardBindings, profile: ControlProfileId): ReadonlyMap<string, NesboxButton> {
  const map = new Map<string, NesboxButton>();
  for (const button of buttonsForProfile(profile)) {
    for (const code of bindings[profile][button] ?? []) map.set(code, button);
  }
  return map;
}

export function gamepadMapForProfile(profile: ControlProfileId): ReadonlyMap<number, NesboxButton> {
  return profile === "mame" ? MAME_GAMEPAD : NES_GAMEPAD;
}

export function keyCodeLabel(code: string): string {
  const labels: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    ShiftLeft: "Shift",
    ShiftRight: "Shift",
    ControlLeft: "Ctrl",
    ControlRight: "Ctrl",
    AltLeft: "Alt",
    AltRight: "Alt",
    Space: "Space",
    Enter: "Enter",
    Escape: "Esc",
  };
  if (labels[code]) return labels[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return `Num ${code.slice(6)}`;
  return code;
}

export function controlGuideRows(profile: ControlProfileId, bindings: KeyboardBindings): ControlGuideRow[] {
  const profileBindings = bindings[profile];
  const keys = (...buttons: NesboxButton[]) => buttons.flatMap(
    (button) => (profileBindings[button] ?? []).map(keyCodeLabel),
  );
  const rows: ControlGuideRow[] = [
    { id: "directions", label: "방향", keys: keys("up", "down", "left", "right") },
    { id: "select", label: profile === "mame" ? "Coin" : "Select", keys: keys("select") },
    { id: "start", label: "Start", keys: keys("start") },
  ];
  if (profile === "nes") {
    rows.push(
      { id: "b", label: "B", keys: keys("b") },
      { id: "a", label: "A", keys: keys("a") },
    );
  } else {
    const actions = ["b", "y", "a", "x", "l", "r"] as const satisfies readonly NesboxButton[];
    actions.forEach((button, index) => rows.push({
      id: button,
      label: `버튼 ${index + 1}`,
      keys: keys(button),
    }));
  }
  return rows;
}

export function normalizeKeyboardBindings(value: unknown): KeyboardBindings {
  const object = isRecord(value) ? value : {};
  return {
    nes: normalizeProfile(object.nes, "nes"),
    mame: normalizeProfile(object.mame, "mame"),
  };
}

export interface PressedInputTracker {
  set(button: NesboxButton, pressed: boolean): void;
  releaseAll(): void;
}

export function createPressedInputTracker(
  send: (button: NesboxButton, pressed: boolean) => void,
): PressedInputTracker {
  const held = new Set<NesboxButton>();
  return {
    set(button, pressed) {
      if (pressed === held.has(button)) return;
      if (pressed) held.add(button);
      else held.delete(button);
      send(button, pressed);
    },
    releaseAll() {
      for (const button of held) send(button, false);
      held.clear();
    },
  };
}

export interface KeyboardInputEvent {
  code: string;
  target?: unknown;
  repeat?: boolean;
  preventDefault(): void;
}

export interface KeyboardInputRouter {
  keyDown(event: KeyboardInputEvent): void;
  keyUp(event: KeyboardInputEvent): void;
  releaseAll(): void;
}

export function createKeyboardInputRouter(options: {
  resolveButton(code: string): NesboxButton | undefined;
  send(button: NesboxButton, pressed: boolean): void;
  isSuspended(): boolean;
}): KeyboardInputRouter {
  const heldCodes = new Map<string, NesboxButton>();
  const heldButtonCounts = new Map<NesboxButton, number>();

  const releaseAll = () => {
    for (const button of heldButtonCounts.keys()) options.send(button, false);
    heldCodes.clear();
    heldButtonCounts.clear();
  };

  return {
    keyDown(event) {
      if (options.isSuspended()) {
        releaseAll();
        return;
      }
      if (isFormTarget(event.target)) return;
      const button = options.resolveButton(event.code);
      if (!button) return;
      event.preventDefault();
      if (heldCodes.has(event.code)) return;
      heldCodes.set(event.code, button);
      const count = heldButtonCounts.get(button) ?? 0;
      heldButtonCounts.set(button, count + 1);
      if (count === 0) options.send(button, true);
    },
    keyUp(event) {
      const button = heldCodes.get(event.code);
      if (!button) return;
      event.preventDefault();
      heldCodes.delete(event.code);
      const count = heldButtonCounts.get(button) ?? 0;
      if (count <= 1) {
        heldButtonCounts.delete(button);
        options.send(button, false);
      } else {
        heldButtonCounts.set(button, count - 1);
      }
    },
    releaseAll,
  };
}

function buttonsForProfile(profile: ControlProfileId): readonly NesboxButton[] {
  return profile === "mame" ? MAME_BUTTONS : NES_BUTTONS;
}

function normalizeProfile(value: unknown, profile: ControlProfileId): ControlBindings {
  const object = isRecord(value) ? value : {};
  const defaults = DEFAULT_KEY_BINDINGS[profile];
  const normalized: ControlBindings = {};
  for (const button of buttonsForProfile(profile)) {
    const codes = object[button];
    normalized[button] = validCodes(codes) ? [...codes] : [...(defaults[button] ?? [])];
  }
  const used = new Map<string, NesboxButton>();
  for (const button of buttonsForProfile(profile)) {
    for (const code of normalized[button] ?? []) {
      const owner = used.get(code);
      if (owner && owner !== button) return cloneProfile(defaults, profile);
      used.set(code, button);
    }
  }
  return normalized;
}

function cloneProfile(bindings: ControlBindings, profile: ControlProfileId): ControlBindings {
  return Object.fromEntries(
    buttonsForProfile(profile).map((button) => [button, [...(bindings[button] ?? [])]]),
  ) as ControlBindings;
}

function validCodes(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((code) => typeof code === "string" && code.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFormTarget(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const target = value as { tagName?: unknown; isContentEditable?: unknown; closest?: (selector: string) => unknown };
  if (target.isContentEditable === true) return true;
  const tagName = typeof target.tagName === "string" ? target.tagName.toUpperCase() : "";
  if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(tagName)) return true;
  return typeof target.closest === "function" && Boolean(target.closest("[contenteditable='true'], [contenteditable='']"));
}
