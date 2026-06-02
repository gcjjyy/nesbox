import type { EmulatorId } from "./rom";
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

export async function deleteGame(gameId: string): Promise<void> {
  const r = await fetch(`/api/games/${encodeURIComponent(gameId)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!r.ok) throw new Error(await r.text());
}

export async function touchGame(gameId: string): Promise<void> {
  const r = await fetch(`/api/games/${encodeURIComponent(gameId)}`, {
    method: "PATCH",
    credentials: "same-origin",
  });
  if (!r.ok) throw new Error(await r.text());
}

export async function fetchRomBytes(gameId: string): Promise<Uint8Array> {
  const r = await fetch(`/api/games/${encodeURIComponent(gameId)}/rom`, { credentials: "same-origin" });
  if (!r.ok) throw new Error(await r.text());
  return new Uint8Array(await r.arrayBuffer());
}

export async function loadStateBytes(gameId: string, emulatorId: EmulatorId, slot: number): Promise<Uint8Array | null> {
  const r = await fetch(`/api/states/${encodeURIComponent(gameId)}/${encodeURIComponent(emulatorId)}/${slot}`, {
    credentials: "same-origin",
  });
  if (r.status === 204 || r.status === 404) return null;
  if (!r.ok) throw new Error(await r.text());
  return new Uint8Array(await r.arrayBuffer());
}

export async function saveStateBytes(gameId: string, emulatorId: EmulatorId, slot: number, bytes: Uint8Array): Promise<void> {
  const r = await fetch(`/api/states/${encodeURIComponent(gameId)}/${encodeURIComponent(emulatorId)}/${slot}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/octet-stream" },
    body: bytesToArrayBuffer(bytes),
  });
  if (!r.ok) throw new Error(await r.text());
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
