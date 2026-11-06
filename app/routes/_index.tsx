import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/_index";
import { GameLibrary } from "../components/GameLibrary";
import { HelpDialog } from "../components/HelpDialog";
import { WelcomeDialog } from "../components/WelcomeDialog";
import { SettingsSheet } from "../components/SettingsSheet";
import { Toolbar } from "../components/Toolbar";
import { listGames as listClientGames } from "../lib/library-client";
import type { GameEntry } from "../lib/game-types";
import { readRecentPlays, recentGames, type RecentPlay } from "../lib/recent-plays";
import { SITE_NAME } from "../lib/site-metadata";
import {
  readSettings,
  writeSettings,
  type UserSettings,
} from "../lib/storage";

export function meta(_: Route.MetaArgs) {
  return [
    { title: SITE_NAME },
    { name: "description", content: "도스박물관 NESBOX browser emulator library for NES and SNES games." },
  ];
}

export async function loader() {
  const { listGames: listServerGames } = await import("../lib/library.server");
  return { games: listServerGames() };
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const [games, setGames] = useState<GameEntry[]>(loaderData.games);
  const [recentPlays, setRecentPlays] = useState<RecentPlay[]>([]);
  const recent = useMemo(() => recentGames(games, recentPlays), [games, recentPlays]);
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
    setRecentPlays(readRecentPlays());
  }, []);

  useEffect(() => {
    refreshGames().catch((err) => setStatus(err instanceof Error ? err.message : String(err)));
  }, [refreshGames]);

  function updateSettings(next: UserSettings) {
    setSettings(next);
    writeSettings(next);
  }

  return (
    <div className="app-shell">
      <Toolbar
        mode="library"
        running={false}
        hasRom={false}
        onBackToLibrary={() => undefined}
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
          recent={recent}
          status={status}
          onLaunch={(gameId) => navigate(`/play/${encodeURIComponent(gameId)}`)}
        />
      </main>
      <SettingsSheet
        open={settingsOpen}
        settings={settings}
        onChange={updateSettings}
        onClose={() => setSettingsOpen(false)}
      />
      <HelpDialog open={helpOpen} bindings={settings.keyBindings} onClose={() => setHelpOpen(false)} />
      <WelcomeDialog bindings={settings.keyBindings} />
    </div>
  );
}
