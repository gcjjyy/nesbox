import {
  CircleHelp,
  FolderOpen,
  Gamepad2,
  Settings,
  Volume2,
} from "lucide-react";
import { version } from "../../package.json";
import {
  DOS_MUSEUM_URL,
  SITE_BRAND_PREFIX,
  SITE_BRAND_PRODUCT,
  SITE_NAME,
} from "../lib/site-metadata";

const ICON = { size: 16, strokeWidth: 1.9, "aria-hidden": true } as const;

export interface ToolbarProps {
  mode: "library" | "player";
  running: boolean;
  hasRom: boolean;
  onBackToLibrary: () => void;
  onOpen: () => void;
  onRunToggle: () => void;
  onReset: () => void;
  onSave: () => void;
  onFullscreen: () => void;
  onHelp: () => void;
  onSettings: () => void;
}

export function Toolbar({
  mode,
  onOpen,
  onHelp,
  onSettings,
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="toolbar__brand" aria-label={SITE_NAME}>
        <Gamepad2 size={17} strokeWidth={1.9} aria-hidden />
        <a
          className="toolbar__brand-link"
          href={DOS_MUSEUM_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          {SITE_BRAND_PREFIX}
        </a>
        <span>{SITE_BRAND_PRODUCT}</span>
        <small>v{version}</small>
      </div>
      <div className="toolbar__actions">
        {mode === "player" && (
          <span className="toolbar__mode" aria-label="플레이 모드">PLAY</span>
        )}
        {mode === "library" && (
          <button type="button" className="icon-button icon-button--primary" onClick={onOpen} title="ROM 열기" aria-label="ROM 열기">
            <FolderOpen {...ICON} />
          </button>
        )}
        <button type="button" className="icon-button" onClick={onHelp} title="도움말" aria-label="도움말">
          <CircleHelp {...ICON} />
        </button>
        <button type="button" className="icon-button" onClick={onSettings} title="설정" aria-label="설정">
          <Settings {...ICON} />
        </button>
        <Volume2 className="toolbar__volume" size={16} strokeWidth={1.9} aria-hidden />
      </div>
    </header>
  );
}
