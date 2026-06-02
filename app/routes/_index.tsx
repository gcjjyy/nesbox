import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/_index";
import { GameLibrary } from "../components/GameLibrary";
import { HelpDialog } from "../components/HelpDialog";
import { SettingsSheet } from "../components/SettingsSheet";
import { Toolbar } from "../components/Toolbar";
import {
  deleteGame,
  importOpenEmuGames,
  listGames as listClientGames,
  uploadGame,
} from "../lib/library-client";
import type { GameEntry } from "../lib/game-types";
import {
  readSettings,
  writeSettings,
  type UserSettings,
} from "../lib/storage";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Nesbox" },
    { name: "description", content: "Personal browser emulator library for NES and SNES games." },
  ];
}

export async function loader() {
  const { importOpenEmuGames: importOpenEmuGamesServer, listGames: listServerGames } = await import("../lib/library.server");
  const existing = listServerGames();
  const games = existing.length > 0 ? existing : importOpenEmuGamesServer().games;
  return { games };
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [games, setGames] = useState<GameEntry[]>(loaderData.games);
  const [importing, setImporting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(() => readSettings());
  const [status, setStatus] = useState(loaderData.games.length > 0 ? "게임을 선택하세요." : "ROM을 등록해 라이브러리를 시작하세요.");

  const refreshGames = useCallback(async (updateStatus = true) => {
    const next = await listClientGames();
    setGames(next);
    if (updateStatus) {
      setStatus(next.length > 0 ? "게임을 선택하세요." : "ROM을 등록해 라이브러리를 시작하세요.");
    }
  }, []);

  useEffect(() => {
    refreshGames().catch((err) => setStatus(err instanceof Error ? err.message : String(err)));
  }, [refreshGames]);

  function updateSettings(next: UserSettings) {
    setSettings(next);
    writeSettings(next);
  }

  async function onFilePicked(file: File | null) {
    if (!file) return;
    try {
      const game = await uploadGame(file);
      await refreshGames();
      setStatus(`${game.title} 등록 완료`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function importFromOpenEmu() {
    setImporting(true);
    setStatus("OpenEmu 라이브러리를 SQLite로 가져오는 중");
    try {
      const result = await importOpenEmuGames();
      setGames(result.games);
      setStatus(`${result.imported}개 게임을 OpenEmu에서 가져왔습니다.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  async function removeGame(gameId: string) {
    const game = games.find((item) => item.id === gameId);
    if (!game) return;
    if (!window.confirm(`${game.title}을(를) 라이브러리에서 삭제할까요?`)) return;
    await deleteGame(gameId);
    await refreshGames();
  }

  return (
    <div className="app-shell">
      <Toolbar
        mode="library"
        running={false}
        hasRom={false}
        onBackToLibrary={() => undefined}
        onOpen={() => inputRef.current?.click()}
        onRunToggle={() => undefined}
        onReset={() => undefined}
        onSave={() => undefined}
        onFullscreen={() => undefined}
        onHelp={() => setHelpOpen(true)}
        onSettings={() => setSettingsOpen(true)}
      />
      <main className="workspace workspace--library">
        <GameLibrary
          games={games}
          importing={importing}
          status={status}
          onAdd={() => inputRef.current?.click()}
          onImportOpenEmu={() => {
            importFromOpenEmu().catch((err) => setStatus(err instanceof Error ? err.message : String(err)));
          }}
          onLaunch={(gameId) => navigate(`/play/${encodeURIComponent(gameId)}`)}
          onDelete={(gameId) => {
            removeGame(gameId).catch((err) => setStatus(err instanceof Error ? err.message : String(err)));
          }}
        />
      </main>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept=".nes,.fds,.unf,.unif,.sfc,.smc,.fig,.swc"
        onChange={(event) => onFilePicked(event.target.files?.[0] ?? null)}
      />
      <SettingsSheet
        open={settingsOpen}
        settings={settings}
        onChange={updateSettings}
        onClose={() => setSettingsOpen(false)}
      />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
