import { Monitor, Smartphone, Volume2, X } from "lucide-react";
import type { UserSettings } from "../lib/storage";

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
          <h2>Settings</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="닫기" title="닫기">
            <X {...ICON} />
          </button>
        </header>
        <label className="setting-row">
          <span>
            <Volume2 {...ICON} />
            Volume
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
            Integer scale
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
            Touch controls
          </span>
          <input
            type="checkbox"
            checked={settings.touchControls}
            onChange={(event) => onChange({ ...settings, touchControls: event.target.checked })}
          />
        </label>
      </section>
    </div>
  );
}
