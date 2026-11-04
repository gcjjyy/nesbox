import type { GameEntry } from "./game-types";

export type CatalogSort = "title" | "added-desc" | "added-asc";

export const CATALOG_SORTS: { value: CatalogSort; label: string }[] = [
  { value: "title", label: "이름순" },
  { value: "added-desc", label: "최근 추가순" },
  { value: "added-asc", label: "오래된 추가순" },
];

const KOREAN_TAG = /\[K(-\d+)?\]|\(k\)|-k$/i;

export function isKoreanEdition(title: string): boolean {
  return KOREAN_TAG.test(title.trim());
}

export function arrangeGames(games: GameEntry[], sort: CatalogSort, query: string): GameEntry[] {
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? games.filter((game) => `${game.title}\n${game.originalTitle ?? ""}`.toLowerCase().includes(needle))
    : [...games];
  return matches.sort((a, b) => Number(b.pinned) - Number(a.pinned) || compare(a, b, sort));
}

function compare(a: GameEntry, b: GameEntry, sort: CatalogSort): number {
  if (sort === "added-desc") return b.addedAt - a.addedAt || byTitle(a, b);
  if (sort === "added-asc") return a.addedAt - b.addedAt || byTitle(a, b);
  return byTitle(a, b);
}

function byTitle(a: GameEntry, b: GameEntry): number {
  return a.title.localeCompare(b.title, "ko", { sensitivity: "base", numeric: true });
}
