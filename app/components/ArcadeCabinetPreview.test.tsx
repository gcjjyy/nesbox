import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArcadeCabinetPreview } from "./ArcadeCabinetPreview";

describe("ArcadeCabinetPreview", () => {
  it("renders the review-only upright cabinet contract", () => {
    const markup = renderToStaticMarkup(<ArcadeCabinetPreview />);

    expect(markup).toContain('aria-label="NESBOX MAME 업라이트 캐비닛 시안"');
    expect(markup).toContain("NESBOX");
    expect(markup).toContain("ARCADE");
    expect(markup).toContain("INSERT COIN");
    expect(markup).toContain("JOYSTICK");
    expect(markup.match(/data-arcade-button=/g)).toHaveLength(6);
    expect(markup).not.toContain("<canvas");
    expect(markup).not.toContain("EmulatorJS");
  });
});
