import { describe, expect, it } from "vitest";
import { libraryCardLabels } from "./game-display";

describe("libraryCardLabels", () => {
  it("puts a trimmed NES metadata title above the filename-derived label", () => {
    expect(libraryCardLabels({
      system: "nes",
      title: "[K]ROCKMAN4",
      fileName: "[K]ROCKMAN4.nes",
      originalTitle: "  Rockman 4 - Aratanaru Yabou!!  ",
    })).toEqual({
      primary: "Rockman 4 - Aratanaru Yabou!!",
      secondary: "[K]ROCKMAN4",
    });
  });

  it.each([null, "", "   "])("falls back from NES metadata title %j to the filename stem", (originalTitle) => {
    expect(libraryCardLabels({
      system: "nes",
      title: "Ignored catalog label",
      fileName: "Mega.Man.4.nes",
      originalTitle,
    })).toEqual({
      primary: "Mega.Man.4",
      secondary: null,
    });
  });

  it("keeps the existing title and original-title order for non-NES games", () => {
    expect(libraryCardLabels({
      system: "arcade",
      title: "스트리트 파이터 2",
      fileName: "sf2ce.zip",
      originalTitle: "sf2ce",
    })).toEqual({
      primary: "스트리트 파이터 2",
      secondary: "sf2ce",
    });
  });
});
