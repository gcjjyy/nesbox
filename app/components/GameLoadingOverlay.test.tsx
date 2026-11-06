import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameLoadingOverlay } from "./GameLoadingOverlay";

describe("GameLoadingOverlay", () => {
  it("exposes measured progress with its stage label", () => {
    const markup = renderToStaticMarkup(<GameLoadingOverlay progress={{ label: "ROM 다운로드", percent: 42 }} />);
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuenow="42"');
    expect(markup).toContain("42%");
    expect(markup).toContain("ROM 다운로드");
    expect(markup).not.toContain("<button");
  });

  it("uses indeterminate progress while the core initializes", () => {
    const markup = renderToStaticMarkup(<GameLoadingOverlay progress={{ label: "게임 준비 중", percent: null }} />);
    expect(markup).toContain('role="progressbar"');
    expect(markup).not.toContain("aria-valuenow");
    expect(markup).toContain("game-loading__bar--indeterminate");
  });
});
