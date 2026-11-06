import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArcadeCabinetPreview } from "./ArcadeCabinetPreview";

describe("ArcadeCabinetPreview", () => {
  it("renders a compact MAME tile matching the NES grid footprint", () => {
    const markup = renderToStaticMarkup(<ArcadeCabinetPreview />);

    expect(markup).toContain('aria-label="MAME 그리드 카드 시안"');
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
