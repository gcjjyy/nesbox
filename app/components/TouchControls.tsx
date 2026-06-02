import { Pause, Play, RotateCcw, Save } from "lucide-react";
import type { NesboxButton } from "../lib/core-contract";

interface TouchControlsProps {
  enabled: boolean;
  running: boolean;
  onButton: (button: NesboxButton, pressed: boolean) => void;
  onRunToggle: () => void;
  onReset: () => void;
  onSave: () => void;
}

const dpad: Array<[NesboxButton, string]> = [
  ["up", "↑"],
  ["left", "←"],
  ["right", "→"],
  ["down", "↓"],
];

const face: Array<[NesboxButton, string]> = [
  ["x", "X"],
  ["y", "Y"],
  ["a", "A"],
  ["b", "B"],
];

const ICON = { size: 16, strokeWidth: 1.9, "aria-hidden": true } as const;

export function TouchControls({ enabled, running, onButton, onRunToggle, onReset, onSave }: TouchControlsProps) {
  if (!enabled) return null;

  return (
    <div className="touch-controls" aria-label="터치 컨트롤러">
      <div className="touch-controls__cluster touch-controls__cluster--dpad">
        {dpad.map(([button, label]) => (
          <TouchButton key={button} button={button} label={label} onButton={onButton} />
        ))}
      </div>
      <div className="touch-controls__center">
        <div className="touch-controls__system">
          <TouchButton button="select" label="SELECT" onButton={onButton} wide />
          <TouchButton button="start" label="START" onButton={onButton} wide />
        </div>
        <div className="touch-controls__actions">
          <button type="button" className="touch-action" onClick={onRunToggle} title={running ? "일시정지" : "실행"} aria-label={running ? "일시정지" : "실행"}>
            {running ? <Pause {...ICON} /> : <Play {...ICON} />}
          </button>
          <button type="button" className="touch-action" onClick={onReset} title="리셋" aria-label="리셋">
            <RotateCcw {...ICON} />
          </button>
          <button type="button" className="touch-action" onClick={onSave} title="상태 저장" aria-label="상태 저장">
            <Save {...ICON} />
          </button>
        </div>
      </div>
      <div className="touch-controls__cluster touch-controls__cluster--face">
        {face.map(([button, label]) => (
          <TouchButton key={button} button={button} label={label} onButton={onButton} />
        ))}
      </div>
    </div>
  );
}

function TouchButton({
  button,
  label,
  wide,
  onButton,
}: {
  button: NesboxButton;
  label: string;
  wide?: boolean;
  onButton: (button: NesboxButton, pressed: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={`touch-button ${wide ? "touch-button--wide" : ""}`}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        onButton(button, true);
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        onButton(button, false);
      }}
      onPointerCancel={() => onButton(button, false)}
      onContextMenu={(event) => event.preventDefault()}
      aria-label={label}
    >
      {label}
    </button>
  );
}
