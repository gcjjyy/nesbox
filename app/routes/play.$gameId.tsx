import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/play.$gameId";
import { EmulatorStage, type EmulatorStageHandle } from "../components/EmulatorStage";
import { HelpDialog } from "../components/HelpDialog";
import { LibraryPanel } from "../components/LibraryPanel";
import { SettingsSheet } from "../components/SettingsSheet";
import { Toolbar } from "../components/Toolbar";
import { listGames as listClientGames, touchGame } from "../lib/library-client";
import type { GameEntry } from "../lib/game-types";
import { readSettings, writeSettings, type UserSettings } from "../lib/storage";

export function meta({ data }: Route.MetaArgs) {
  const title = data?.game ? `${data.game.title} · Nesbox` : "Nesbox";
  return [{ title }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const { getGame, listGames } = await import("../lib/library.server");
  const stored = getGame(params.gameId);
  if (!stored) throw new Response("not found", { status: 404 });
  const { romPath: _romPath, ...game } = stored;
  return { game, games: listGames() };
}

export default function Play({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const stageRef = useRef<EmulatorStageHandle | null>(null);
  const [games, setGames] = useState<GameEntry[]>(loaderData.games);
  const [running, setRunning] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(() => readSettings());
  const [status, setStatus] = useState("게임 로딩 중");

  const activeGame = useMemo(
    () => games.find((game) => game.id === loaderData.game.id) ?? loaderData.game,
    [games, loaderData.game],
  );

  useEffect(() => {
    let cancelled = false;
    stageRef.current?.openGame(loaderData.game)
      .then(async () => {
        if (cancelled) return;
        await touchGame(loaderData.game.id);
        setGames(await listClientGames());
      })
      .catch((err) => {
        if (!cancelled) setStatus(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
      stageRef.current?.dispose();
    };
  }, [loaderData.game]);

  function backToLibrary() {
    stageRef.current?.dispose();
    navigate("/");
  }

  function updateSettings(next: UserSettings) {
    setSettings(next);
    writeSettings(next);
  }

  async function saveState() {
    try {
      await stageRef.current?.saveState();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="app-shell">
      <Toolbar
        mode="player"
        running={running}
        hasRom
        onBackToLibrary={backToLibrary}
        onOpen={backToLibrary}
        onRunToggle={() => stageRef.current?.toggleRun()}
        onReset={() => stageRef.current?.reset()}
        onSave={saveState}
        onFullscreen={() => stageRef.current?.fullscreen()}
        onHelp={() => setHelpOpen(true)}
        onSettings={() => setSettingsOpen(true)}
      />
      <main className="workspace workspace--player">
        <EmulatorStage
          ref={stageRef}
          settings={settings}
          onPhaseChange={() => undefined}
          onStatus={setStatus}
          onRunningChange={setRunning}
        />
        <LibraryPanel activeGame={activeGame} games={games} status={status} />
      </main>
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
