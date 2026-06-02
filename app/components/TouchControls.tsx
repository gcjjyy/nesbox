import { useRef } from "react";
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
  ["y", "Y"],
  ["x", "X"],
  ["b", "B"],
  ["a", "A"],
];

const ICON = { size: 16, strokeWidth: 1.9, "aria-hidden": true } as const;

export function TouchControls({ enabled, running, onButton, onRunToggle, onReset, onSave }: TouchControlsProps) {
  const activePointersRef = useRef(new Map<number, NesboxButton>());
  const pressedCountsRef = useRef(new Map<NesboxButton, number>());

  if (!enabled) return null;

  function press(button: NesboxButton) {
    const count = pressedCountsRef.current.get(button) ?? 0;
    pressedCountsRef.current.set(button, count + 1);
    if (count === 0) onButton(button, true);
  }

  function release(button: NesboxButton) {
    const count = pressedCountsRef.current.get(button) ?? 0;
    if (count <= 1) {
      pressedCountsRef.current.delete(button);
      onButton(button, false);
      return;
    }
    pressedCountsRef.current.set(button, count - 1);
  }

  function buttonAt(x: number, y: number): NesboxButton | null {
    const target = document.elementFromPoint(x, y)?.closest<HTMLButtonElement>("[data-touch-button]");
    return (target?.dataset.touchButton as NesboxButton | undefined) ?? null;
  }

  function setPointerButton(pointerId: number, next: NesboxButton | null) {
    const prev = activePointersRef.current.get(pointerId) ?? null;
    if (prev === next) return;
    if (prev) release(prev);
    if (next) {
      activePointersRef.current.set(pointerId, next);
      press(next);
    } else {
      activePointersRef.current.delete(pointerId);
    }
  }

  function releasePointer(pointerId: number) {
    setPointerButton(pointerId, null);
  }

  return (
    <div
      className="touch-controls"
      aria-label="터치 컨트롤러"
      onPointerDown={(event) => {
        const next = buttonAt(event.clientX, event.clientY);
        if (!next) return;
        event.preventDefault();
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch (_err) {
          // Some browsers reject capture for synthetic events.
        }
        setPointerButton(event.pointerId, next);
      }}
      onPointerMove={(event) => {
        if (!activePointersRef.current.has(event.pointerId)) return;
        event.preventDefault();
        setPointerButton(event.pointerId, buttonAt(event.clientX, event.clientY));
      }}
      onPointerUp={(event) => {
        releasePointer(event.pointerId);
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch (_err) {
          // Already released or unsupported.
        }
      }}
      onPointerCancel={(event) => releasePointer(event.pointerId)}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="touch-controls__cluster touch-controls__cluster--dpad">
        {dpad.map(([button, label]) => (
          <TouchButton key={button} button={button} label={label} />
        ))}
      </div>
      <div className="touch-controls__center">
        <TouchButton button="select" label="SELECT" wide />
        <TouchButton button="start" label="START" wide />
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
      <div className="touch-controls__cluster touch-controls__cluster--face">
        {face.map(([button, label]) => (
          <TouchButton key={button} button={button} label={label} />
        ))}
      </div>
    </div>
  );
}

function TouchButton({
  button,
  label,
  wide,
}: {
  button: NesboxButton;
  label: string;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      className={`touch-button ${wide ? "touch-button--wide" : ""}`}
      data-touch-button={button}
      aria-label={label}
    >
      {label}
    </button>
  );
}
