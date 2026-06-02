import { Database, Play, Plus, Trash2 } from "lucide-react";
import { emulatorById } from "../lib/emulator-registry";
import { displaySystem, formatBytes } from "../lib/rom";
import type { GameEntry } from "../lib/game-types";

export interface GameLibraryProps {
  games: GameEntry[];
  importing: boolean;
  status: string;
  onAdd: () => void;
  onImportOpenEmu: () => void;
  onLaunch: (gameId: string) => void;
  onDelete: (gameId: string) => void;
}

const ICON = { size: 16, strokeWidth: 1.9, "aria-hidden": true } as const;

export function GameLibrary({ games, importing, status, onAdd, onImportOpenEmu, onLaunch, onDelete }: GameLibraryProps) {
  return (
    <section className="game-library" aria-label="게임 라이브러리">
      <header className="game-library__header">
        <div>
          <h1>Game Library</h1>
          <p>{games.length} games · {status}</p>
        </div>
        <div className="game-library__buttons">
          <button type="button" className="library-add" onClick={onImportOpenEmu} disabled={importing}>
            <Database {...ICON} />
            OpenEmu
          </button>
          <button type="button" className="library-add" onClick={onAdd}>
            <Plus {...ICON} />
            Add
          </button>
        </div>
      </header>

      {games.length === 0 ? (
        <div className="library-empty">
          <strong>No games</strong>
          <span>OpenEmu에서 가져오거나 ROM을 추가하면 SQLite 라이브러리에 저장됩니다.</span>
        </div>
      ) : (
        <div className="library-table" role="table" aria-label="등록된 게임">
          <div className="library-table__head" role="row">
            <span role="columnheader">Title</span>
            <span role="columnheader">System</span>
            <span role="columnheader">Emulator</span>
            <span role="columnheader">Size</span>
            <span role="columnheader">Actions</span>
          </div>
          <div className="library-table__body">
            {games.map((game) => {
              const emulator = emulatorById(game.emulatorId);
              return (
                <div key={game.id} className="library-row" role="row">
                  <button type="button" className="library-row__title" onClick={() => onLaunch(game.id)}>
                    <span>{game.title}</span>
                    <small>{game.fileName}</small>
                  </button>
                  <span className="library-row__cell" data-label="System">{displaySystem(game.system)}</span>
                  <span className="library-row__cell" data-label="Emulator">{emulator?.shortName ?? game.emulatorId}</span>
                  <span className="library-row__cell" data-label="Size">{formatBytes(game.size)}</span>
                  <span className="library-row__actions" data-label="Actions">
                    <button type="button" className="icon-button icon-button--primary" onClick={() => onLaunch(game.id)} title="실행" aria-label={`${game.title} 실행`}>
                      <Play {...ICON} />
                    </button>
                    <button type="button" className="icon-button" onClick={() => onDelete(game.id)} title="삭제" aria-label={`${game.title} 삭제`}>
                      <Trash2 {...ICON} />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
