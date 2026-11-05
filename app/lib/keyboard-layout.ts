import type { NesboxButton } from "./core-contract";

export type KeyboardLayoutId = "arrows" | "wasd";

export interface KeyBinding {
  code: string;
  label: string;
  button: NesboxButton;
}

export interface KeyboardLayout {
  id: KeyboardLayoutId;
  name: string;
  /** D-pad keys in up/left/down/right order. */
  dpad: { up: KeyBinding; left: KeyBinding; down: KeyBinding; right: KeyBinding };
  /** NES 패드에는 B, A 두 버튼뿐이다. */
  b: KeyBinding;
  a: KeyBinding;
}

const key = (code: string, label: string, button: NesboxButton): KeyBinding => ({ code, label, button });

export const KEYBOARD_LAYOUTS: Record<KeyboardLayoutId, KeyboardLayout> = {
  arrows: {
    id: "arrows",
    name: "방향키 + Z / X",
    dpad: {
      up: key("ArrowUp", "↑", "up"),
      left: key("ArrowLeft", "←", "left"),
      down: key("ArrowDown", "↓", "down"),
      right: key("ArrowRight", "→", "right"),
    },
    b: key("KeyZ", "Z", "b"),
    a: key("KeyX", "X", "a"),
  },
  wasd: {
    id: "wasd",
    name: "WASD + [ / ]",
    dpad: {
      up: key("KeyW", "W", "up"),
      left: key("KeyA", "A", "left"),
      down: key("KeyS", "S", "down"),
      right: key("KeyD", "D", "right"),
    },
    b: key("BracketLeft", "[", "b"),
    a: key("BracketRight", "]", "a"),
  },
};

export const SHARED_BINDINGS: KeyBinding[] = [
  key("Enter", "Enter", "start"),
  key("ShiftLeft", "Shift", "select"),
  key("ShiftRight", "Shift", "select"),
];

export const DEFAULT_KEYBOARD_LAYOUT: KeyboardLayoutId = "arrows";

export function isKeyboardLayoutId(value: unknown): value is KeyboardLayoutId {
  return value === "arrows" || value === "wasd";
}

export function keyboardMap(id: KeyboardLayoutId): Map<string, NesboxButton> {
  const layout = KEYBOARD_LAYOUTS[id];
  const bindings = [...Object.values(layout.dpad), layout.b, layout.a, ...SHARED_BINDINGS];
  return new Map(bindings.map((binding) => [binding.code, binding.button]));
}
