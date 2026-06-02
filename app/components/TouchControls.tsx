import type { NesboxButton } from "../lib/core-contract";

interface TouchControlsProps {
  enabled: boolean;
  onButton: (button: NesboxButton, pressed: boolean) => void;
}

const dpad: Array<[NesboxButton, string]> = [
  ["up", "↑"],
  ["left", "←"],
  ["right", "→"],
  ["down", "↓"],
];

const face: Array<[NesboxButton, string]> = [
  ["b", "B"],
  ["a", "A"],
  ["y", "Y"],
  ["x", "X"],
];

export function TouchControls({ enabled, onButton }: TouchControlsProps) {
  if (!enabled) return null;

  return (
    <div className="touch-controls" aria-label="터치 컨트롤러">
      <div className="touch-controls__cluster touch-controls__cluster--dpad">
        {dpad.map(([button, label]) => (
          <TouchButton key={button} button={button} label={label} onButton={onButton} />
        ))}
      </div>
      <div className="touch-controls__center">
        <TouchButton button="select" label="SELECT" onButton={onButton} wide />
        <TouchButton button="start" label="START" onButton={onButton} wide />
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
