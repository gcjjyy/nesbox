import type { GameEntry } from "./game-types";

export type CatalogSort = "title" | "added-desc" | "added-asc";
export type CatalogCategory = "all" | "nes" | "mame";

export interface CatalogCounts {
  all: number;
  nes: number;
  mame: number;
}

export const CATALOG_SORTS: { value: CatalogSort; label: string }[] = [
  { value: "title", label: "이름순" },
  { value: "added-desc", label: "최근 추가순" },
  { value: "added-asc", label: "오래된 추가순" },
];

const KOREAN_TAG = /\[K(-\d+)?\]|\(k\)|-k$/i;

export function isKoreanEdition(title: string): boolean {
  return KOREAN_TAG.test(title.trim());
}

export function catalogCategoryForGame(game: GameEntry): Exclude<CatalogCategory, "all"> | null {
  if (game.system === "arcade" || game.emulatorId === "mame2003-plus" || game.emulatorId === "fbneo") return "mame";
  if (game.system === "nes") return "nes";
  return null;
}

export function catalogCounts(games: GameEntry[]): CatalogCounts {
  const counts: CatalogCounts = { all: games.length, nes: 0, mame: 0 };
  for (const game of games) {
    const category = catalogCategoryForGame(game);
    if (category) counts[category] += 1;
  }
  return counts;
}

export function arrangeGames(
  games: GameEntry[],
  sort: CatalogSort,
  query: string,
  category: CatalogCategory = "all",
): GameEntry[] {
  const matches = games.filter((game) => matchesCategory(game, category) && matchesQuery(game, query));
  return matches.sort((a, b) => Number(b.pinned) - Number(a.pinned) || compare(a, b, sort));
}

export function filterRecentGames<T extends { game: GameEntry }>(
  recent: T[],
  query: string,
  category: CatalogCategory = "all",
): T[] {
  return recent.filter(({ game }) => matchesCategory(game, category) && matchesQuery(game, query));
}

function matchesCategory(game: GameEntry, category: CatalogCategory): boolean {
  return category === "all" || catalogCategoryForGame(game) === category;
}

function matchesQuery(game: GameEntry, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return !needle || `${game.title}\n${game.originalTitle ?? ""}`.toLowerCase().includes(needle);
}

function compare(a: GameEntry, b: GameEntry, sort: CatalogSort): number {
  if (sort === "added-desc") return b.addedAt - a.addedAt || byTitle(a, b);
  if (sort === "added-asc") return a.addedAt - b.addedAt || byTitle(a, b);
  return byTitle(a, b);
}

function byTitle(a: GameEntry, b: GameEntry): number {
  return a.title.localeCompare(b.title, "ko", { sensitivity: "base", numeric: true });
}
