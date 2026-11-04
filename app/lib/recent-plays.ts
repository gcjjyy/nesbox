import type { GameEntry } from "./game-types";

// 최근 플레이 기록은 서버가 아닌 각 브라우저에만 저장한다.
const RECENT_KEY = "nesbox:recent-plays";
const MAX_ENTRIES = 30;

export interface RecentPlay {
  gameId: string;
  playedAt: number;
}

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): KeyValueStorage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

export function readRecentPlays(storage: KeyValueStorage | null = defaultStorage()): RecentPlay[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(RECENT_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RecentPlay =>
        typeof item?.gameId === "string" && typeof item?.playedAt === "number" && Number.isFinite(item.playedAt),
    );
  } catch {
    return [];
  }
}

export function recordRecentPlay(
  gameId: string,
  playedAt = Date.now(),
  storage: KeyValueStorage | null = defaultStorage(),
): void {
  if (!storage) return;
  const next = [{ gameId, playedAt }, ...readRecentPlays(storage).filter((play) => play.gameId !== gameId)];
  try {
    storage.setItem(RECENT_KEY, JSON.stringify(next.slice(0, MAX_ENTRIES)));
  } catch {
    // 저장 공간이 막혀 있어도 게임 실행은 계속한다.
  }
}

export function recentGames(games: GameEntry[], plays: RecentPlay[]): { game: GameEntry; playedAt: number }[] {
  const byId = new Map(games.map((game) => [game.id, game]));
  return plays.flatMap((play) => {
    const game = byId.get(play.gameId);
    return game ? [{ game, playedAt: play.playedAt }] : [];
  });
}
