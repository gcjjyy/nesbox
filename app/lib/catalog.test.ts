import { describe, expect, it } from "vitest";
import { arrangeGames, isKoreanEdition } from "./catalog";
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
