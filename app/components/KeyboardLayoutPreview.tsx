import { KEYBOARD_LAYOUTS, type KeyBinding, type KeyboardLayoutId } from "../lib/keyboard-layout";

const BUTTON_LABEL: Record<string, string> = {
  up: "위",
  down: "아래",
  left: "왼쪽",
  right: "오른쪽",
  a: "A",
  b: "B",
  x: "X",
  y: "Y",
  start: "스타트",
  select: "셀렉트",
};

function Keycap({ binding, label, secondary, wide }: { binding: KeyBinding | { label: string; button: string }; label?: string; secondary?: boolean; wide?: boolean }) {
  return (
    <span className={`keycap${secondary ? " keycap--secondary" : ""}${wide ? " keycap--wide" : ""}`}>
      <kbd>{label ?? binding.label}</kbd>
      <small>{BUTTON_LABEL[binding.button] ?? binding.button}</small>
    </span>
  );
}

/** 선택한 키 배치를 실제 키보드처럼 키캡 모양으로 보여 준다. */
export function KeyboardLayoutPreview({ layoutId }: { layoutId: KeyboardLayoutId }) {
  const layout = KEYBOARD_LAYOUTS[layoutId];
  // 키보드에서 실제로 위/아래에 놓인 순서대로 줄을 세운다(Z X 위에 A S, [ ] 아래에 ; ').
  const faceRows =
    layoutId === "arrows"
      ? [
          [layout.y, layout.x, true],
          [layout.b, layout.a, false],
        ]
      : [
          [layout.b, layout.a, false],
          [layout.y, layout.x, true],
        ];

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
        {faceRows.map(([left, right, secondary]) => (
          <div key={(left as KeyBinding).code} className="keymap__row">
            <Keycap binding={left as KeyBinding} secondary={secondary as boolean} />
            <Keycap binding={right as KeyBinding} secondary={secondary as boolean} />
          </div>
        ))}
      </div>
    </div>
  );
}
