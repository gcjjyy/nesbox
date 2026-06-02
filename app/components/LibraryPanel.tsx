import { Clock3, Cpu, FileArchive, Info } from "lucide-react";
import { emulatorById } from "../lib/emulator-registry";
import { displaySystem, formatBytes } from "../lib/rom";
import type { GameEntry } from "../lib/game-types";

export interface LibraryPanelProps {
  activeGame: GameEntry | null;
  games: GameEntry[];
  status: string;
}

const ICON = { size: 15, strokeWidth: 1.9, "aria-hidden": true } as const;

export function LibraryPanel({ activeGame, games, status }: LibraryPanelProps) {
  const target = activeGame ? emulatorById(activeGame.emulatorId) : null;

  return (
    <aside className="library-panel">
      <section className="panel-section">
        <h2>
          <FileArchive {...ICON} />
          Cartridge
        </h2>
        {activeGame ? (
          <dl className="details-list">
            <div>
              <dt>Title</dt>
              <dd>{activeGame.title}</dd>
            </div>
            <div>
              <dt>System</dt>
              <dd>{displaySystem(activeGame.system)}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{formatBytes(activeGame.size)}</dd>
            </div>
          </dl>
        ) : (
          <p className="muted-copy">게임을 선택하면 SQLite 라이브러리의 에뮬레이터 매핑과 상태 저장 슬롯을 불러옵니다.</p>
        )}
      </section>

      <section className="panel-section">
        <h2>
          <Cpu {...ICON} />
          Core
        </h2>
        {target ? (
          <dl className="details-list">
            <div>
              <dt>Target</dt>
              <dd>{target.name}</dd>
            </div>
            <div>
              <dt>License</dt>
              <dd>{target.license}</dd>
            </div>
            <div>
              <dt>Runtime</dt>
              <dd>{target.scriptUrl}</dd>
            </div>
          </dl>
        ) : (
          <p className="muted-copy">게임 등록 시 확장자와 프로필에 따라 정확한 emulatorId를 고정합니다.</p>
        )}
      </section>

      <section className="panel-section">
        <h2>
          <Clock3 {...ICON} />
          Recent
        </h2>
        {games.length > 0 ? (
          <ol className="recent-list">
            {games.slice(0, 5).map((game) => (
              <li key={game.id}>
                <span>{game.title}</span>
                <small>{game.system.toUpperCase()} · {game.emulatorId}</small>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted-copy">브라우저 보안상 ROM 본문은 자동 보관하지 않고, 최근 목록과 세이브 상태만 저장합니다.</p>
        )}
      </section>

      <section className="panel-section panel-section--status">
        <h2>
          <Info {...ICON} />
          Status
        </h2>
        <p>{status}</p>
      </section>
    </aside>
  );
}
