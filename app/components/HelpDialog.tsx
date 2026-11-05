import { Gamepad2, Keyboard, X } from "lucide-react";
import type { ReactNode } from "react";
import { KEYBOARD_LAYOUTS, type KeyboardLayoutId } from "../lib/keyboard-layout";
import { KeyboardLayoutPreview } from "./KeyboardLayoutPreview";

const ICON = { size: 16, strokeWidth: 1.9, "aria-hidden": true } as const;

interface HelpDialogProps {
  open: boolean;
  keyboardLayout: KeyboardLayoutId;
  onClose: () => void;
}

const gamepadRows = [
  ["방향", "십자키 또는 왼쪽 스틱"],
  ["B", "아래쪽 버튼"],
  ["A", "오른쪽 버튼"],
  ["Y", "왼쪽 버튼"],
  ["X", "위쪽 버튼"],
  ["L / R", "왼쪽 / 오른쪽 숄더"],
  ["스타트", "Start / Menu"],
  ["셀렉트", "Back / View"],
];

export function HelpDialog({ open, keyboardLayout, onClose }: HelpDialogProps) {
  if (!open) return null;

  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="help-dialog" role="dialog" aria-modal="true" aria-label="키 매핑 도움말" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2>조작법</h2>
            <p>PC 키보드와 표준 게임패드 배치</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="닫기" title="닫기">
            <X {...ICON} />
          </button>
        </header>
        <div className="help-dialog__grid">
          <section className="control-map" aria-label="Keyboard">
            <h3>
              <Keyboard {...ICON} />
              키보드 · {KEYBOARD_LAYOUTS[keyboardLayout].name}
            </h3>
            <div className="control-map__keys">
              <KeyboardLayoutPreview layoutId={keyboardLayout} />
              <p>설정에서 배치를 바꿀 수 있어요. Y / X는 SNES 전용.</p>
            </div>
          </section>
          <ControlTable title="게임패드" icon={<Gamepad2 {...ICON} />} rows={gamepadRows} />
        </div>
      </section>
    </div>
  );
}

function ControlTable({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: ReactNode;
  rows: string[][];
}) {
  return (
    <section className="control-map" aria-label={title}>
      <h3>
        {icon}
        {title}
      </h3>
      <dl>
        {rows.map(([button, input]) => (
          <div key={button}>
            <dt>{button}</dt>
            <dd>{input}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
