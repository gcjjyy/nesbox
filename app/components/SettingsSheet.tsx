import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowLeft, Keyboard, Monitor, RotateCcw, Smartphone, Volume2, X } from "lucide-react";
import type { NesboxButton } from "../lib/core-contract";
import {
  assignKey,
  controlBindingRows,
  keyCodeLabel,
  resetKeyProfile,
  type ControlProfileId,
} from "../lib/control-profiles";
import type { UserSettings } from "../lib/storage";
import { ControlGuideTabs } from "./ControlGuideTabs";
import { GamepadSettings } from "./GamepadSettings";

const ICON = { size: 16, strokeWidth: 1.9, "aria-hidden": true } as const;

export interface SettingsSheetProps {
  open: boolean;
  settings: UserSettings;
  onChange: (settings: UserSettings) => void;
  onClose: () => void;
}

export function SettingsSheet({ open, settings, onChange, onClose }: SettingsSheetProps) {
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<ControlProfileId>("nes");
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const mappingButtonRef = useRef<HTMLButtonElement | null>(null);
  const [capture, setCapture] = useState<{ profile: ControlProfileId; button: NesboxButton } | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEditing(false);
      setCapture(null);
      setCaptureError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    return () => previousFocus?.focus();
  }, [open]);

  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [editing, open]);

  useEffect(() => {
    if (!open || !editing || !capture) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      const result = assignKey(settings.keyBindings, capture.profile, capture.button, event.code);
      if (result.kind === "cancelled") {
        setCapture(null);
        setCaptureError(null);
      } else if (result.kind === "rejected") {
        setCaptureError(result.message);
      } else {
        onChange({ ...settings, keyBindingsVersion: 1, keyBindings: result.bindings });
        setCapture(null);
        setCaptureError(null);
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [capture, editing, onChange, open, settings]);

  if (!open) return null;

  function startCapture(profile: ControlProfileId, button: NesboxButton) {
    setCapture({ profile, button });
    setCaptureError(null);
  }

  function selectProfile(next: ControlProfileId) {
    setProfile(next);
    setCapture(null);
    setCaptureError(null);
  }

  function finishEditing() {
    setCapture(null);
    setCaptureError(null);
    setEditing(false);
    requestAnimationFrame(() => mappingButtonRef.current?.focus());
  }

  function onDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (capture) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (editing) finishEditing();
      else onClose();
    } else if (event.key === "Tab") {
      const buttons = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex='0']")]
        .filter((node) => node.tabIndex >= 0);
      const first = buttons[0];
      const last = buttons.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }

  function resetProfile(profile: ControlProfileId) {
    if (!window.confirm(`${profile === "nes" ? "NES" : "MAME"} 키 설정을 기본값으로 복원할까요?`)) return;
    onChange({ ...settings, keyBindingsVersion: 1, keyBindings: resetKeyProfile(settings.keyBindings, profile) });
    setCapture(null);
    setCaptureError(null);
  }

  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="settings-sheet" role="dialog" aria-modal="true" aria-label={editing ? "키 설정" : "설정"} onMouseDown={(event) => event.stopPropagation()} onKeyDown={onDialogKeyDown}>
        <header>
          <div className="settings-sheet__title">
            {editing && <button type="button" className="icon-button" onClick={finishEditing} aria-label="설정으로 돌아가기"><ArrowLeft {...ICON} /></button>}
            <h2 ref={headingRef} tabIndex={-1}>{editing ? "키 설정" : "설정"}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="닫기" title="닫기">
            <X {...ICON} />
          </button>
        </header>
        {editing ? <div className="keyboard-settings">
          <div className="keyboard-settings__heading">
            <span><Keyboard {...ICON} />키 매핑 변경</span>
            <small>바꿀 동작을 누르고 새 키를 입력하세요. 변경 즉시 저장되며, Esc로 키 입력을 취소할 수 있습니다.</small>
          </div>
          <ControlGuideTabs
            bindings={settings.keyBindings}
            activeProfile={profile}
            onProfileChange={selectProfile}
            renderPanel={(active) => <KeyProfileEditor
              profile={active}
              settings={settings}
              capture={capture}
              onCapture={startCapture}
              onReset={() => resetProfile(active)}
            />}
          />
          {captureError && <p className="keyboard-settings__error" role="alert">{captureError}</p>}
          <button type="button" className="keyboard-settings__action" onClick={finishEditing}>완료</button>
        </div> : <>
          <label className="setting-row">
            <span>
              <Volume2 {...ICON} />
              볼륨
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.volume}
              onChange={(event) => onChange({ ...settings, volume: Number(event.target.value) })}
            />
          </label>
          <label className="setting-row setting-row--switch">
            <span>
              <Monitor {...ICON} />
              정수 배율
            </span>
            <input
              type="checkbox"
              checked={settings.integerScale}
              onChange={(event) => onChange({ ...settings, integerScale: event.target.checked })}
            />
          </label>
          <label className="setting-row setting-row--switch">
            <span>
              <Smartphone {...ICON} />
              터치 버튼
            </span>
            <input
              type="checkbox"
              checked={settings.touchControls}
              onChange={(event) => onChange({ ...settings, touchControls: event.target.checked })}
            />
          </label>
          <div className="keyboard-settings">
            <div className="keyboard-settings__heading">
              <span><Keyboard {...ICON} />키보드</span>
              <small>현재 설정된 키 배치입니다.</small>
            </div>
            <div className="keyboard-settings__preview">
              <ControlGuideTabs bindings={settings.keyBindings} activeProfile={profile} onProfileChange={selectProfile} />
            </div>
            <button ref={mappingButtonRef} type="button" className="keyboard-settings__action" onClick={() => setEditing(true)}>
              <Keyboard {...ICON} />키 매핑 변경
            </button>
          </div>
          <GamepadSettings settings={settings} onChange={onChange} />
        </>}
      </section>
    </div>
  );
}

function KeyProfileEditor({
  profile,
  settings,
  capture,
  onCapture,
  onReset,
}: {
  profile: ControlProfileId;
  settings: UserSettings;
  capture: { profile: ControlProfileId; button: NesboxButton } | null;
  onCapture: (profile: ControlProfileId, button: NesboxButton) => void;
  onReset: () => void;
}) {
  const title = profile === "nes" ? "NES" : "MAME (6버튼)";
  return (
    <fieldset className="key-profile">
      <legend>{title}</legend>
      <div className="key-profile__grid">
        {controlBindingRows(profile).map(({ button, label }) => {
          const capturing = capture?.profile === profile && capture.button === button;
          const assigned = [...new Set((settings.keyBindings[profile][button] ?? []).map(keyCodeLabel))].join(" / ");
          return (
            <div className="key-binding-row" key={button}>
              <span>{label}</span>
              <button
                type="button"
                className={capturing ? "key-binding-button key-binding-button--capturing" : "key-binding-button"}
                aria-label={`${title} ${label} 키 설정`}
                aria-pressed={capturing}
                onClick={() => onCapture(profile, button)}
              >
                {capturing ? "키를 누르세요…" : assigned}
              </button>
            </div>
          );
        })}
      </div>
      <button type="button" className="key-profile__reset" onClick={onReset}>
        <RotateCcw size={14} strokeWidth={1.9} aria-hidden />
        기본값 복원
      </button>
    </fieldset>
  );
}
