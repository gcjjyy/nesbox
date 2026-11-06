import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArcadeCabinet } from "./ArcadeCabinet";

describe("ArcadeCabinet", () => {
  it("renders a compact MAME tile matching the NES grid footprint", () => {
    const markup = renderToStaticMarkup(<ArcadeCabinet />);

    expect(markup).toContain('aria-label="MAME 아케이드 게임기"');
    expect(markup).toContain('data-grid-ratio="1060:704"');
    expect(markup).toContain("arcade-grid-machine__screen");
    expect(markup).toContain("INSERT COIN");
    expect(markup.match(/data-arcade-button=/g)).toHaveLength(6);
    expect(markup).not.toContain("arcade-cabinet__marquee");
    expect(markup).not.toContain("arcade-cabinet__coin-door");
    expect(markup).not.toContain("<canvas");
    expect(markup).not.toContain("EmulatorJS");
  });
});
