import type { NesboxButton } from "./core-contract";

export interface KeyBinding {
  code: string;
  label: string;
  button: NesboxButton;
}

const key = (code: string, label: string, button: NesboxButton): KeyBinding => ({ code, label, button });

/** PC 키 배치는 방향키 + Z / X 하나로 고정한다. NES 패드에는 B, A 두 버튼뿐이다. */
export const KEYBOARD_LAYOUT = {
  dpad: {
    up: key("ArrowUp", "↑", "up"),
    left: key("ArrowLeft", "←", "left"),
    down: key("ArrowDown", "↓", "down"),
    right: key("ArrowRight", "→", "right"),
  },
  b: key("KeyZ", "Z", "b"),
  a: key("KeyX", "X", "a"),
  start: key("Enter", "Enter", "start"),
  select: [key("ShiftLeft", "Shift", "select"), key("ShiftRight", "Shift", "select")],
} as const;

export const KEYBOARD_MAP: ReadonlyMap<string, NesboxButton> = new Map(
  [
    ...Object.values(KEYBOARD_LAYOUT.dpad),
    KEYBOARD_LAYOUT.b,
    KEYBOARD_LAYOUT.a,
    KEYBOARD_LAYOUT.start,
    ...KEYBOARD_LAYOUT.select,
  ].map((binding) => [binding.code, binding.button]),
);
