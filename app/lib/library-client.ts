import type { GameEntry } from "./game-types";

export async function listGames(): Promise<GameEntry[]> {
  const r = await fetch("/api/games", { credentials: "same-origin" });
  if (!r.ok) throw new Error(await r.text());
  const data = (await r.json()) as { games: GameEntry[] };
  return data.games;
}

export async function uploadGame(file: File): Promise<GameEntry> {
  const body = new FormData();
  body.set("rom", file);
  const r = await fetch("/api/games", { method: "POST", body, credentials: "same-origin" });
  if (!r.ok) throw new Error(await r.text());
  const data = (await r.json()) as { game: GameEntry };
  return data.game;
}

export async function importOpenEmuGames(): Promise<{ imported: number; games: GameEntry[] }> {
  const r = await fetch("/api/games", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "import-openemu" }),
  });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as { imported: number; games: GameEntry[] };
}

export function coverUrl(gameId: string): string {
  return `/api/games/${encodeURIComponent(gameId)}/cover`;
}

export async function fetchRomBytes(gameId: string): Promise<Uint8Array> {
  const r = await fetch(`/api/games/${encodeURIComponent(gameId)}/rom`, { credentials: "same-origin" });
  if (!r.ok) throw new Error(await r.text());
  return new Uint8Array(await r.arrayBuffer());
}
