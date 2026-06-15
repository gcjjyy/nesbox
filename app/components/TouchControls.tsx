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

const face: Array<[NesboxButton, string]> = [
  ["y", "Y"],
  ["x", "X"],
  ["b", "B"],
  ["a", "A"],
];

const ICON = { size: 16, strokeWidth: 1.9, "aria-hidden": true } as const;
const STICK_DEADZONE = 0.28;
const STICK_THROW = 42;

type TouchPoint = Pick<Touch, "identifier" | "clientX" | "clientY">;
type ButtonSet = Set<NesboxButton>;

interface TouchHit {
  buttons: ButtonSet;
  track: boolean;
}

export function TouchControls({ enabled, running, onButton, onRunToggle, onReset, onSave }: TouchControlsProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const activePointersRef = useRef(new Map<number, ButtonSet>());
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

  function buttonsAt(x: number, y: number): TouchHit {
    const root = rootRef.current;
    if (!root) return { buttons: new Set(), track: false };

    const stickNode = root.querySelector<HTMLElement>("[data-touch-stick]");
    if (stickNode) {
      const stickRect = stickNode.getBoundingClientRect();
      if (x >= stickRect.left && x <= stickRect.right && y >= stickRect.top && y <= stickRect.bottom) {
        const radius = Math.min(stickRect.width, stickRect.height) / 2;
        const dx = (x - (stickRect.left + stickRect.width / 2)) / radius;
        const dy = (y - (stickRect.top + stickRect.height / 2)) / radius;
        const distance = Math.hypot(dx, dy);
        const buttons = new Set<NesboxButton>();
        if (distance > STICK_DEADZONE) {
          if (dx < -STICK_DEADZONE) buttons.add("left");
          if (dx > STICK_DEADZONE) buttons.add("right");
          if (dy < -STICK_DEADZONE) buttons.add("up");
          if (dy > STICK_DEADZONE) buttons.add("down");
        }
        return { buttons, track: true };
      }
    }

    for (const target of Array.from(root.querySelectorAll<HTMLButtonElement>("[data-touch-button]"))) {
      const rect = target.getBoundingClientRect();
      const hitSlop = target.closest(".touch-controls__cluster--face") ? 8 : 0;
      if (x >= rect.left - hitSlop && x <= rect.right + hitSlop && y >= rect.top - hitSlop && y <= rect.bottom + hitSlop) {
        const button = target.dataset.touchButton as NesboxButton | undefined;
        return { buttons: button ? new Set([button]) : new Set(), track: Boolean(button) };
      }
    }

    return { buttons: new Set(), track: false };
  }

  function setPointerButtons(pointerId: number, next: ButtonSet) {
    const tracking = activePointersRef.current.has(pointerId);
    const prev = activePointersRef.current.get(pointerId) ?? new Set<NesboxButton>();
    if (tracking && sameButtons(prev, next)) return;

    for (const button of prev) {
      if (!next.has(button)) release(button);
    }
    for (const button of next) {
      if (!prev.has(button)) press(button);
    }
    activePointersRef.current.set(pointerId, next);
  }

  function releasePointer(pointerId: number) {
    const prev = activePointersRef.current.get(pointerId) ?? new Set<NesboxButton>();
    for (const button of prev) release(button);
    activePointersRef.current.delete(pointerId);
  }

  function setTouchButton(touch: TouchPoint) {
    setPointerButtons(touch.identifier, buttonsAt(touch.clientX, touch.clientY).buttons);
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
        const next = buttonsAt(touch.clientX, touch.clientY);
        if (!next.track) continue;
        handled = true;
        setPointerButtons(touch.identifier, next.buttons);
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
        const next = buttonsAt(event.clientX, event.clientY);
        if (!next.track) return;
        event.preventDefault();
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch (_err) {
          // Some browsers reject capture for synthetic events.
        }
        setPointerButtons(event.pointerId, next.buttons);
      }}
      onPointerMove={(event) => {
        if (event.pointerType === "touch") return;
        if (!activePointersRef.current.has(event.pointerId)) return;
        event.preventDefault();
        setPointerButtons(event.pointerId, buttonsAt(event.clientX, event.clientY).buttons);
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
      <TouchStick pressedButtons={pressedButtons} />
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

function sameButtons(a: ButtonSet, b: ButtonSet) {
  if (a.size !== b.size) return false;
  for (const button of a) {
    if (!b.has(button)) return false;
  }
  return true;
}

function TouchStick({ pressedButtons }: { pressedButtons: Set<NesboxButton> }) {
  const x = (pressedButtons.has("left") ? -1 : 0) + (pressedButtons.has("right") ? 1 : 0);
  const y = (pressedButtons.has("up") ? -1 : 0) + (pressedButtons.has("down") ? 1 : 0);
  const diagonal = x !== 0 && y !== 0 ? Math.SQRT1_2 : 1;
  const stickX = x * STICK_THROW * diagonal;
  const stickY = y * STICK_THROW * diagonal;

  return (
    <div
      className={`touch-controls__cluster touch-controls__cluster--dpad ${pressedButtons.has("up") ? "touch-stick--up" : ""} ${
        pressedButtons.has("right") ? "touch-stick--right" : ""
      } ${pressedButtons.has("down") ? "touch-stick--down" : ""} ${pressedButtons.has("left") ? "touch-stick--left" : ""}`}
      data-touch-stick
      role="group"
      aria-label="방향 조이스틱"
    >
      <span className="touch-stick__marker touch-stick__marker--up" aria-hidden>
        ↑
      </span>
      <span className="touch-stick__marker touch-stick__marker--right" aria-hidden>
        →
      </span>
      <span className="touch-stick__marker touch-stick__marker--down" aria-hidden>
        ↓
      </span>
      <span className="touch-stick__marker touch-stick__marker--left" aria-hidden>
        ←
      </span>
      <span className="touch-stick__gate" aria-hidden />
      <span className="touch-stick__nub" style={{ transform: `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))` }} aria-hidden />
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
