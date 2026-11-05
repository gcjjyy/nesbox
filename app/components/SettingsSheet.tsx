import { Keyboard, Monitor, Smartphone, Volume2, X } from "lucide-react";
import { KEYBOARD_LAYOUTS, type KeyboardLayoutId } from "../lib/keyboard-layout";
import type { UserSettings } from "../lib/storage";
import { KeyboardLayoutPreview } from "./KeyboardLayoutPreview";

const ICON = { size: 16, strokeWidth: 1.9, "aria-hidden": true } as const;

export interface SettingsSheetProps {
  open: boolean;
  settings: UserSettings;
  onChange: (settings: UserSettings) => void;
  onClose: () => void;
}

export function SettingsSheet({ open, settings, onChange, onClose }: SettingsSheetProps) {
  if (!open) return null;

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
        <fieldset className="setting-row setting-row--keys">
          <legend>
            <span>
              <Keyboard {...ICON} />
              PC 키 배치
            </span>
          </legend>
          <div className="key-layout-options">
            {(Object.keys(KEYBOARD_LAYOUTS) as KeyboardLayoutId[]).map((id) => (
              <label key={id} className="key-layout-option">
                <input
                  type="radio"
                  name="keyboard-layout"
                  value={id}
                  checked={settings.keyboardLayout === id}
                  onChange={() => onChange({ ...settings, keyboardLayout: id })}
                />
                <span className="key-layout-option__name">{KEYBOARD_LAYOUTS[id].name}</span>
                <KeyboardLayoutPreview layoutId={id} />
              </label>
            ))}
          </div>
        </fieldset>
      </section>
    </div>
  );
}
