import { useEffect, useRef, useState } from "react";
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

type TouchPoint = Pick<Touch, "identifier" | "clientX" | "clientY">;

export function TouchControls({ enabled, running, onButton, onRunToggle, onReset, onSave }: TouchControlsProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const activePointersRef = useRef(new Map<number, NesboxButton>());
  const pressedCountsRef = useRef(new Map<NesboxButton, number>());
  const onButtonRef = useRef(onButton);
  const [pressedButtons, setPressedButtons] = useState<Set<NesboxButton>>(() => new Set());

  useEffect(() => {
    onButtonRef.current = onButton;
  }, [onButton]);

  useEffect(() => {
    return () => {
      for (const button of pressedCountsRef.current.keys()) onButtonRef.current(button, false);
      activePointersRef.current.clear();
      pressedCountsRef.current.clear();
    };
  }, []);

  function press(button: NesboxButton) {
    const count = pressedCountsRef.current.get(button) ?? 0;
    pressedCountsRef.current.set(button, count + 1);
    if (count === 0) {
      setPressedButtons((current) => new Set(current).add(button));
      onButtonRef.current(button, true);
    }
  }

  function release(button: NesboxButton) {
    const count = pressedCountsRef.current.get(button) ?? 0;
    if (count <= 1) {
      pressedCountsRef.current.delete(button);
      setPressedButtons((current) => {
        const next = new Set(current);
        next.delete(button);
        return next;
      });
      onButtonRef.current(button, false);
      return;
    }
    pressedCountsRef.current.set(button, count - 1);
  }

  function buttonAt(x: number, y: number): NesboxButton | null {
    const root = rootRef.current;
    if (!root) return null;

    const dpadNode = root.querySelector<HTMLElement>(".touch-controls__cluster--dpad");
    if (dpadNode) {
      const dpadRect = dpadNode.getBoundingClientRect();
      if (x >= dpadRect.left && x <= dpadRect.right && y >= dpadRect.top && y <= dpadRect.bottom) {
        const col = Math.min(2, Math.max(0, Math.floor(((x - dpadRect.left) / dpadRect.width) * 3)));
        const row = Math.min(2, Math.max(0, Math.floor(((y - dpadRect.top) / dpadRect.height) * 3)));
        if (col === 1 && row === 0) return "up";
        if (col === 0 && row === 1) return "left";
        if (col === 2 && row === 1) return "right";
        if (col === 1 && row === 2) return "down";
      }
    }

    for (const target of Array.from(root.querySelectorAll<HTMLButtonElement>("[data-touch-button]"))) {
      const rect = target.getBoundingClientRect();
      const hitSlop = target.closest(".touch-controls__cluster--face") ? 8 : 0;
      if (x >= rect.left - hitSlop && x <= rect.right + hitSlop && y >= rect.top - hitSlop && y <= rect.bottom + hitSlop) {
        return (target.dataset.touchButton as NesboxButton | undefined) ?? null;
      }
    }

    return null;
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

  function setTouchButton(touch: TouchPoint) {
    setPointerButton(touch.identifier, buttonAt(touch.clientX, touch.clientY));
  }

  function releaseTouch(touch: TouchPoint) {
    releasePointer(touch.identifier);
  }

  useEffect(() => {
    if (!enabled) return;
    const root = rootRef.current;
    if (!root) return;

    const preventControlDefault = (event: Event) => {
      event.preventDefault();
    };

    const onTouchStart = (event: TouchEvent) => {
      let handled = false;
      for (const touch of Array.from(event.changedTouches)) {
        const next = buttonAt(touch.clientX, touch.clientY);
        if (!next) continue;
        handled = true;
        setPointerButton(touch.identifier, next);
      }
      if (handled) event.preventDefault();
    };

    const onTouchMove = (event: TouchEvent) => {
      let handled = false;
      for (const touch of Array.from(event.changedTouches)) {
        if (!activePointersRef.current.has(touch.identifier)) continue;
        handled = true;
        setTouchButton(touch);
      }
      if (handled) event.preventDefault();
    };

    const onTouchEnd = (event: TouchEvent) => {
      let handled = false;
      for (const touch of Array.from(event.changedTouches)) {
        if (!activePointersRef.current.has(touch.identifier)) continue;
        handled = true;
        releaseTouch(touch);
      }
      if (handled) event.preventDefault();
    };

    root.addEventListener("touchstart", onTouchStart, { passive: false });
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    root.addEventListener("touchend", onTouchEnd, { passive: false });
    root.addEventListener("touchcancel", onTouchEnd, { passive: false });
    root.addEventListener("contextmenu", preventControlDefault);
    root.addEventListener("selectstart", preventControlDefault);
    root.addEventListener("dragstart", preventControlDefault);
    root.addEventListener("gesturestart", preventControlDefault);

    return () => {
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("touchend", onTouchEnd);
      root.removeEventListener("touchcancel", onTouchEnd);
      root.removeEventListener("contextmenu", preventControlDefault);
      root.removeEventListener("selectstart", preventControlDefault);
      root.removeEventListener("dragstart", preventControlDefault);
      root.removeEventListener("gesturestart", preventControlDefault);
    };
  });

  if (!enabled) return null;

  return (
    <div
      ref={rootRef}
      className="touch-controls"
      aria-label="터치 컨트롤러"
      onPointerDown={(event) => {
        if (event.pointerType === "touch") return;
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
        if (event.pointerType === "touch") return;
        if (!activePointersRef.current.has(event.pointerId)) return;
        event.preventDefault();
        setPointerButton(event.pointerId, buttonAt(event.clientX, event.clientY));
      }}
      onPointerUp={(event) => {
        if (event.pointerType === "touch") return;
        releasePointer(event.pointerId);
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch (_err) {
          // Already released or unsupported.
        }
      }}
      onPointerCancel={(event) => {
        if (event.pointerType === "touch") return;
        releasePointer(event.pointerId);
      }}
      onSelect={(event) => event.preventDefault()}
      onSelectCapture={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="touch-controls__cluster touch-controls__cluster--dpad">
        {dpad.map(([button, label]) => (
          <TouchButton key={button} button={button} label={label} pressed={pressedButtons.has(button)} />
        ))}
      </div>
      <div className="touch-controls__center">
        <TouchButton button="select" label="SELECT" pressed={pressedButtons.has("select")} wide />
        <TouchButton button="start" label="START" pressed={pressedButtons.has("start")} wide />
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
          <TouchButton key={button} button={button} label={label} pressed={pressedButtons.has(button)} />
        ))}
      </div>
    </div>
  );
}

function TouchButton({
  button,
  label,
  pressed,
  wide,
}: {
  button: NesboxButton;
  label: string;
  pressed: boolean;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      className={`touch-button ${pressed ? "touch-button--pressed" : ""} ${wide ? "touch-button--wide" : ""}`}
      data-touch-button={button}
      aria-label={label}
      draggable={false}
    >
      {label}
    </button>
  );
}
