import { Gamepad2, Keyboard, X } from "lucide-react";
import type { ReactNode } from "react";

const ICON = { size: 16, strokeWidth: 1.9, "aria-hidden": true } as const;

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

const keyboardRows = [
  ["D-pad", "Arrow keys"],
  ["B", "Z"],
  ["A", "X"],
  ["Y", "A"],
  ["X", "S"],
  ["Start", "Enter"],
  ["Select", "Left Shift / Right Shift"],
];

const gamepadRows = [
  ["D-pad", "D-pad or left stick"],
  ["B", "South face button"],
  ["A", "East face button"],
  ["Y", "West face button"],
  ["X", "North face button"],
  ["L / R", "Left shoulder / Right shoulder"],
  ["Start", "Start / Menu"],
  ["Select", "Back / View"],
];

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  if (!open) return null;

  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="help-dialog" role="dialog" aria-modal="true" aria-label="키 매핑 도움말" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2>Controls</h2>
            <p>PC keyboard and standard gamepad mapping</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="닫기" title="닫기">
            <X {...ICON} />
          </button>
        </header>
        <div className="help-dialog__grid">
          <ControlTable title="Keyboard" icon={<Keyboard {...ICON} />} rows={keyboardRows} />
          <ControlTable title="Gamepad" icon={<Gamepad2 {...ICON} />} rows={gamepadRows} />
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
