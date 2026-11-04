import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Save } from "lucide-react";
import type { NesboxButton } from "../lib/core-contract";
import { stickButtons } from "../lib/touch-stick";

interface TouchControlsProps {
  enabled: boolean;
  running: boolean;
  onButton: (button: NesboxButton, pressed: boolean) => void;
  onRunToggle: () => void;
  onReset: () => void;
  onSave: () => void;
}

// NES에는 A/B만 있으므로 Y/X 대신 윗줄 전체를 A+B 동시 입력 버튼으로 쓴다(열혈 시리즈 점프 등).
const face: Array<{ buttons: NesboxButton[]; label: string; combo?: boolean }> = [
  { buttons: ["a", "b"], label: "A+B", combo: true },
  { buttons: ["b"], label: "B" },
  { buttons: ["a"], label: "A" },
];

const ICON = { size: 16, strokeWidth: 1.9, "aria-hidden": true } as const;
const STICK_THROW = 42;

type TouchPoint = Pick<Touch, "identifier" | "clientX" | "clientY">;
type ButtonSet = Set<NesboxButton>;

interface TouchHit {
  buttons: ButtonSet;
  track: boolean;
  stick: boolean;
}

export function TouchControls({ enabled, running, onButton, onRunToggle, onReset, onSave }: TouchControlsProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const activePointersRef = useRef(new Map<number, ButtonSet>());
  // 스틱에서 시작한 터치는 손을 뗄 때까지 스틱에 묶어 둔다.
  const stickPointersRef = useRef(new Set<number>());
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
      stickPointersRef.current.clear();
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

  function buttonsAt(x: number, y: number, ownedByStick = false): TouchHit {
    const root = rootRef.current;
    if (!root) return { buttons: new Set(), track: false, stick: false };

    const stickNode = root.querySelector<HTMLElement>("[data-touch-stick]");
    if (stickNode) {
      const stickRect = stickNode.getBoundingClientRect();
      const inside = x >= stickRect.left && x <= stickRect.right && y >= stickRect.top && y <= stickRect.bottom;
      if (ownedByStick || inside) return { buttons: stickButtons(x, y, stickRect), track: true, stick: true };
    }
    if (ownedByStick) return { buttons: new Set(), track: true, stick: true };

    for (const target of Array.from(root.querySelectorAll<HTMLButtonElement>("[data-touch-button]"))) {
      const rect = target.getBoundingClientRect();
      const hitSlop = target.closest(".touch-controls__cluster--face") ? 8 : 0;
      if (x >= rect.left - hitSlop && x <= rect.right + hitSlop && y >= rect.top - hitSlop && y <= rect.bottom + hitSlop) {
        const buttons = (target.dataset.touchButton ?? "").split("+").filter(Boolean) as NesboxButton[];
        return { buttons: new Set(buttons), track: buttons.length > 0, stick: false };
      }
    }

    return { buttons: new Set(), track: false, stick: false };
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

  function startPointer(pointerId: number, hit: TouchHit) {
    if (hit.stick) stickPointersRef.current.add(pointerId);
    setPointerButtons(pointerId, hit.buttons);
  }

  function movePointer(pointerId: number, x: number, y: number) {
    setPointerButtons(pointerId, buttonsAt(x, y, stickPointersRef.current.has(pointerId)).buttons);
  }

  function releasePointer(pointerId: number) {
    const prev = activePointersRef.current.get(pointerId) ?? new Set<NesboxButton>();
    for (const button of prev) release(button);
    activePointersRef.current.delete(pointerId);
    stickPointersRef.current.delete(pointerId);
  }

  function setTouchButton(touch: TouchPoint) {
    movePointer(touch.identifier, touch.clientX, touch.clientY);
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
        startPointer(touch.identifier, next);
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
        startPointer(event.pointerId, next);
      }}
      onPointerMove={(event) => {
        if (event.pointerType === "touch") return;
        if (!activePointersRef.current.has(event.pointerId)) return;
        event.preventDefault();
        movePointer(event.pointerId, event.clientX, event.clientY);
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
        {face.map(({ buttons, label, combo }) => (
          <TouchButton
            key={label}
            button={buttons}
            label={label}
            pressed={buttons.every((button) => pressedButtons.has(button))}
            combo={combo}
          />
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
  combo,
}: {
  button: NesboxButton | NesboxButton[];
  label: string;
  pressed: boolean;
  wide?: boolean;
  combo?: boolean;
}) {
  return (
    <button
      type="button"
      className={`touch-button ${pressed ? "touch-button--pressed" : ""} ${wide ? "touch-button--wide" : ""} ${
        combo ? "touch-button--combo" : ""
      }`}
      data-touch-button={Array.isArray(button) ? button.join("+") : button}
      aria-label={label}
      draggable={false}
    >
      {label}
    </button>
  );
}
