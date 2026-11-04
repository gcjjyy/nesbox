import { describe, expect, it } from "vitest";
import { readRecentPlays, recentGames, recordRecentPlay, type KeyValueStorage } from "./recent-plays";
import type { GameEntry } from "./game-types";

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

describe("recent plays", () => {
  it("returns an empty list when nothing is stored or data is corrupt", () => {
    expect(readRecentPlays(memoryStorage())).toEqual([]);
    expect(readRecentPlays(memoryStorage({ "nesbox:recent-plays": "{oops" }))).toEqual([]);
    expect(readRecentPlays(memoryStorage({ "nesbox:recent-plays": '[{"gameId":1}]' }))).toEqual([]);
  });

  it("records newest first and moves replays to the front", () => {
    const storage = memoryStorage();
    recordRecentPlay("a", 1, storage);
    recordRecentPlay("b", 2, storage);
    recordRecentPlay("a", 3, storage);
    expect(readRecentPlays(storage)).toEqual([
      { gameId: "a", playedAt: 3 },
      { gameId: "b", playedAt: 2 },
    ]);
  });

  it("keeps at most 30 entries", () => {
    const storage = memoryStorage();
    for (let i = 0; i < 40; i += 1) recordRecentPlay(`g${i}`, i, storage);
    const plays = readRecentPlays(storage);
    expect(plays).toHaveLength(30);
    expect(plays[0].gameId).toBe("g39");
  });

  it("joins plays with known games and drops removed games", () => {
    const games = [{ id: "a", title: "A" }, { id: "b", title: "B" }] as GameEntry[];
    const plays = [
      { gameId: "b", playedAt: 5 },
      { gameId: "gone", playedAt: 4 },
      { gameId: "a", playedAt: 3 },
    ];
    expect(recentGames(games, plays).map((entry) => [entry.game.id, entry.playedAt])).toEqual([
      ["b", 5],
      ["a", 3],
    ]);
  });
});
