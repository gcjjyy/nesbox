import { useEffect, useState } from "react";
import { Keyboard, Monitor, RotateCcw, Smartphone, Volume2, X } from "lucide-react";
import type { NesboxButton } from "../lib/core-contract";
import {
  assignKey,
  controlBindingRows,
  keyCodeLabel,
  resetKeyProfile,
  type ControlProfileId,
} from "../lib/control-profiles";
import type { UserSettings } from "../lib/storage";

const ICON = { size: 16, strokeWidth: 1.9, "aria-hidden": true } as const;

export interface SettingsSheetProps {
  open: boolean;
  settings: UserSettings;
  onChange: (settings: UserSettings) => void;
  onClose: () => void;
}

export function SettingsSheet({ open, settings, onChange, onClose }: SettingsSheetProps) {
  const [capture, setCapture] = useState<{ profile: ControlProfileId; button: NesboxButton } | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCapture(null);
      setCaptureError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !capture) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
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
  }, [capture, onChange, open, settings]);

  if (!open) return null;

  function startCapture(profile: ControlProfileId, button: NesboxButton) {
    setCapture({ profile, button });
    setCaptureError(null);
  }

  function resetProfile(profile: ControlProfileId) {
    if (!window.confirm(`${profile === "nes" ? "NES" : "MAME"} 키 설정을 기본값으로 복원할까요?`)) return;
    onChange({ ...settings, keyBindingsVersion: 1, keyBindings: resetKeyProfile(settings.keyBindings, profile) });
    setCapture(null);
    setCaptureError(null);
  }

  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="settings-sheet" role="dialog" aria-modal="true" aria-label="설정" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2>설정</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="닫기" title="닫기">
            <X {...ICON} />
          </button>
        </header>
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
            <small>바꿀 동작을 누른 뒤 새 키를 입력하세요. Esc는 취소합니다.</small>
          </div>
          {(["nes", "mame"] as const).map((profile) => (
            <KeyProfileEditor
              key={profile}
              profile={profile}
              settings={settings}
              capture={capture}
              onCapture={startCapture}
              onReset={() => resetProfile(profile)}
            />
          ))}
          {captureError && <p className="keyboard-settings__error" role="alert">{captureError}</p>}
        </div>
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
          const assigned = (settings.keyBindings[profile][button] ?? []).map(keyCodeLabel).join(" / ");
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
