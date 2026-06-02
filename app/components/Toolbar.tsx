import {
  ArrowLeft,
  CircleHelp,
  FolderOpen,
  Gamepad2,
  Maximize,
  Pause,
  Play,
  RotateCcw,
  Save,
  Settings,
  Volume2,
} from "lucide-react";
import { version } from "../../package.json";

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
  running,
  hasRom,
  onBackToLibrary,
  onOpen,
  onRunToggle,
  onReset,
  onSave,
  onFullscreen,
  onHelp,
  onSettings,
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="toolbar__brand" aria-label="Nesbox">
        <Gamepad2 size={17} strokeWidth={1.9} aria-hidden />
        <span>NESBOX</span>
        <small>v{version}</small>
      </div>
      <div className="toolbar__actions">
        {mode === "player" && (
          <button type="button" className="icon-button" onClick={onBackToLibrary} title="라이브러리" aria-label="라이브러리로 돌아가기">
            <ArrowLeft {...ICON} />
          </button>
        )}
        {mode === "library" && (
          <button type="button" className="icon-button icon-button--primary" onClick={onOpen} title="ROM 열기" aria-label="ROM 열기">
            <FolderOpen {...ICON} />
          </button>
        )}
        {mode === "player" && (
          <>
            <button
              type="button"
              className="icon-button"
              onClick={onRunToggle}
              disabled={!hasRom}
              title={running ? "일시정지" : "실행"}
              aria-label={running ? "일시정지" : "실행"}
            >
              {running ? <Pause {...ICON} /> : <Play {...ICON} />}
            </button>
            <button type="button" className="icon-button" onClick={onReset} disabled={!hasRom} title="리셋" aria-label="리셋">
              <RotateCcw {...ICON} />
            </button>
            <button type="button" className="icon-button" onClick={onSave} disabled={!hasRom} title="상태 저장" aria-label="상태 저장">
              <Save {...ICON} />
            </button>
            <span className="toolbar__sep" aria-hidden />
            <button type="button" className="icon-button" onClick={onFullscreen} title="전체 화면" aria-label="전체 화면">
              <Maximize {...ICON} />
            </button>
          </>
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
