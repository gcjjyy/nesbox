import { Gamepad2, Keyboard, X } from "lucide-react";
import type { ReactNode } from "react";
import type { KeyboardBindings } from "../lib/control-profiles";
import { ControlGuideTabs } from "./ControlGuideTabs";

const ICON = { size: 16, strokeWidth: 1.9, "aria-hidden": true } as const;

interface HelpDialogProps {
  open: boolean;
  bindings: KeyboardBindings;
  onClose: () => void;
}

const gamepadRows = [
  ["방향", "십자키 또는 왼쪽 스틱"],
  ["B", "아래쪽 버튼"],
  ["A", "오른쪽 버튼"],
  ["스타트", "Start / Menu"],
  ["셀렉트", "Back / View"],
  ["MAME 버튼 1–6", "게임패드 버튼 0–5"],
];

export function HelpDialog({ open, bindings, onClose }: HelpDialogProps) {
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
          <section className="control-map" aria-label="키보드">
            <h3>
              <Keyboard {...ICON} />
              키보드
            </h3>
            <div className="control-map__keys">
              <ControlGuideTabs bindings={bindings} />
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
