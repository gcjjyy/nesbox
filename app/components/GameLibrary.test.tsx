import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameCard, GameLibrary } from "./GameLibrary";
import type { GameEntry } from "../lib/game-types";

const sampleGame: GameEntry = {
  id: "sample-game", title: "Sample Game", fileName: "sample.zip",
  system: "arcade", emulatorId: "fbneo", size: 1024, addedAt: 0,
  lastPlayedAt: null, originalTitle: "sample", hasCover: true, pinned: false,
};

describe("GameCard artwork", () => {
  it.each(["fbneo", "mame2003-plus"] as const)("uses the approved cabinet for %s games", (emulatorId) => {
    const markup = renderToStaticMarkup(<GameCard game={{ ...sampleGame, emulatorId }} playedAt={null} onLaunch={() => undefined} />);
    expect(markup).toContain('aria-label="Sample Game 실행"');
    expect(markup).toContain('class="cart cart--arcade"');
    expect(markup).toContain('class="arcade-grid-machine"');
    expect(markup).toContain('/api/games/sample-game/cover');
    expect(markup.match(/data-arcade-button=/g)).toHaveLength(6);
    expect(markup).not.toContain('class="cart__body"');
  });

  it("keeps cartridge artwork for NES games", () => {
    const game: GameEntry = { ...sampleGame, system: "nes", emulatorId: "fceux", fileName: "sample.nes" };
    const markup = renderToStaticMarkup(<GameCard game={game} playedAt={null} onLaunch={() => undefined} />);
    expect(markup).toContain('class="cart__body"');
    expect(markup).not.toContain('class="arcade-grid-machine"');
  });

  it("renders the cabinet fallback when no screenshot is available", () => {
    const markup = renderToStaticMarkup(<GameCard game={{ ...sampleGame, hasCover: false }} playedAt={null} onLaunch={() => undefined} />);
    expect(markup).toContain("INSERT COIN");
    expect(markup).not.toContain("<image");
  });
});

describe("GameLibrary header", () => {
  it("uses the NESBOX gamepad brand and exposes no library import controls", () => {
    const legacyCompatibleProps = {
      games: [],
      recent: [],
      importing: false,
      status: "게임을 선택하세요.",
      onAdd: () => undefined,
      onImportOpenEmu: () => undefined,
      onLaunch: () => undefined,
    };
    const markup = renderToStaticMarkup(<GameLibrary {...legacyCompatibleProps} />);

    expect(markup).toContain('aria-label="NESBOX"');
    expect(markup).toContain(">NESBOX<");
    expect(markup).not.toContain("Game Library");
    expect(markup).not.toContain("OpenEmu");
    expect(markup).not.toContain(">Add<");
  });
});
