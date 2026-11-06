import { describe, expect, it } from "vitest";
import {
  arrangeGames,
  catalogCategoryForGame,
  catalogCounts,
  filterRecentGames,
  isKoreanEdition,
} from "./catalog";
import type { GameEntry } from "./game-types";

function game(id: string, title: string, addedAt: number, extra: Partial<GameEntry> = {}): GameEntry {
  return {
    id,
    title,
    fileName: `${title}.nes`,
    system: "nes",
    emulatorId: "fceux",
    size: 1,
    addedAt,
    lastPlayedAt: null,
    originalTitle: null,
    hasCover: false,
    pinned: false,
    ...extra,
  };
}

const GAMES = [
  game("b", "Bubble Bobble (U)", 2),
  game("a", "[K]ROCKMAN4", 3, { originalTitle: "Rockman 4 - Aratanaru Yabou!!" }),
  game("c", "Contra", 1),
  game("p", "HOG TANUKI", 0, { pinned: true }),
];

describe("arrangeGames", () => {
  it("keeps pinned games first regardless of sort", () => {
    expect(arrangeGames(GAMES, "title", "").map((g) => g.id)).toEqual(["p", "a", "b", "c"]);
    expect(arrangeGames(GAMES, "added-desc", "").map((g) => g.id)).toEqual(["p", "a", "b", "c"]);
    expect(arrangeGames(GAMES, "added-asc", "").map((g) => g.id)).toEqual(["p", "c", "b", "a"]);
  });

  it("filters by title and original title, case-insensitively", () => {
    expect(arrangeGames(GAMES, "title", "rockman 4").map((g) => g.id)).toEqual(["a"]);
    expect(arrangeGames(GAMES, "title", "BUBBLE").map((g) => g.id)).toEqual(["b"]);
    expect(arrangeGames(GAMES, "title", "zzz")).toEqual([]);
  });

  it("does not mutate the input", () => {
    const copy = [...GAMES];
    arrangeGames(GAMES, "added-asc", "");
    expect(GAMES).toEqual(copy);
  });
});

describe("isKoreanEdition", () => {
  it("recognizes common Korean tags", () => {
    expect(isKoreanEdition("[K]ROCKMAN4")).toBe(true);
    expect(isKoreanEdition("[K-2]Dragon BallZ")).toBe(true);
    expect(isKoreanEdition("SuperMario3 (K)v1.2")).toBe(true);
    expect(isKoreanEdition("DBZ3(k)")).toBe(true);
    expect(isKoreanEdition("bikkuri-k")).toBe(true);
  });

  it("ignores other titles", () => {
    expect(isKoreanEdition("Kickle Cubicle (U)")).toBe(false);
    expect(isKoreanEdition("Dr. Mario (JU)")).toBe(false);
    expect(isKoreanEdition("HOG TANUKI")).toBe(false);
  });
});

describe("catalog categories", () => {
  const mixed = [
    game("nes", "Contra", 1),
    game("mame", "Metal Slug", 2, { system: "arcade", emulatorId: "mame2003-plus", fileName: "mslug.zip" }),
    game("fbneo", "Street Fighter II", 3, { system: "arcade", emulatorId: "fbneo", fileName: "sf2.zip" }),
    game("snes", "Street Fighter II SNES", 4, { system: "snes", emulatorId: "snes9x", fileName: "sf2.sfc" }),
  ];

  it("counts all games while grouping both arcade cores under MAME", () => {
    expect(catalogCounts(mixed)).toEqual({ all: 4, nes: 1, mame: 2 });
    expect(catalogCategoryForGame(mixed[0])).toBe("nes");
    expect(catalogCategoryForGame(mixed[1])).toBe("mame");
    expect(catalogCategoryForGame(mixed[2])).toBe("mame");
    expect(catalogCategoryForGame(mixed[3])).toBeNull();
  });

  it("applies search only after category selection and preserves sort/pin rules", () => {
    expect(arrangeGames(mixed, "title", "street fighter", "mame").map((entry) => entry.id)).toEqual(["fbneo"]);
    expect(arrangeGames(mixed, "title", "street fighter", "nes")).toEqual([]);
    expect(arrangeGames(mixed, "added-desc", "", "mame").map((entry) => entry.id)).toEqual(["fbneo", "mame"]);
  });

  it("filters recent games by category and query without changing recent-first order", () => {
    const recent = [mixed[3], mixed[1], mixed[0], mixed[2]].map((entry, index) => ({ game: entry, playedAt: 100 - index }));

    expect(filterRecentGames(recent, "", "mame").map((entry) => entry.game.id)).toEqual(["mame", "fbneo"]);
    expect(filterRecentGames(recent, "metal", "mame").map((entry) => entry.game.id)).toEqual(["mame"]);
    expect(recent.map((entry) => entry.game.id)).toEqual(["snes", "mame", "nes", "fbneo"]);
  });
});
