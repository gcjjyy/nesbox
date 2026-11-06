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

export async function fetchRomBytes(
  gameId: string,
  onProgress?: (loaded: number, total: number | null) => void,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const r = await fetch(`/api/games/${encodeURIComponent(gameId)}/rom`, {
    credentials: "same-origin",
    signal,
  });
  if (!r.ok) throw new Error(await r.text());
  const lengthHeader = r.headers.get("Content-Length");
  const parsedLength = lengthHeader === null ? Number.NaN : Number.parseInt(lengthHeader, 10);
  const total = Number.isFinite(parsedLength) && parsedLength >= 0 ? parsedLength : null;
  onProgress?.(0, total);
  if (!r.body) {
    const bytes = new Uint8Array(await r.arrayBuffer());
    onProgress?.(bytes.byteLength, total);
    return bytes;
  }

  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress?.(loaded, total);
  }
  const result = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
