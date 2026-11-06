import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameLibrary } from "./GameLibrary";

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
