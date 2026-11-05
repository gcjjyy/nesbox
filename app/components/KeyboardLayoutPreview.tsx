import { KEYBOARD_LAYOUTS, type KeyBinding, type KeyboardLayoutId } from "../lib/keyboard-layout";

const BUTTON_LABEL: Record<string, string> = {
  up: "위",
  down: "아래",
  left: "왼쪽",
  right: "오른쪽",
  a: "A",
  b: "B",
  start: "스타트",
  select: "셀렉트",
};

function Keycap({ binding, wide }: { binding: KeyBinding | { label: string; button: string }; wide?: boolean }) {
  return (
    <span className={`keycap${wide ? " keycap--wide" : ""}`}>
      <kbd>{binding.label}</kbd>
      <small>{BUTTON_LABEL[binding.button] ?? binding.button}</small>
    </span>
  );
}

/** 선택한 키 배치를 실제 키보드처럼 키캡 모양으로 보여 준다. */
export function KeyboardLayoutPreview({ layoutId }: { layoutId: KeyboardLayoutId }) {
  const layout = KEYBOARD_LAYOUTS[layoutId];
  return (
    <div className="keymap" aria-label={`${layout.name} 키 배치`}>
      <div className="keymap__dpad">
        <Keycap binding={layout.dpad.up} />
        <Keycap binding={layout.dpad.left} />
        <Keycap binding={layout.dpad.down} />
        <Keycap binding={layout.dpad.right} />
      </div>
      <div className="keymap__system">
        <Keycap binding={{ label: "Shift", button: "select" }} wide />
        <Keycap binding={{ label: "Enter", button: "start" }} wide />
      </div>
      <div className="keymap__face">
        <div className="keymap__row">
          <Keycap binding={layout.b} />
          <Keycap binding={layout.a} />
        </div>
      </div>
    </div>
  );
}
