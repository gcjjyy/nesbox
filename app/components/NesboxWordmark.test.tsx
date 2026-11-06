import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NesboxWordmark } from "./NesboxWordmark";

describe("NesboxWordmark", () => {
  it("renders a self-contained, accessible six-letter vector mark", () => {
    const markup = renderToStaticMarkup(<NesboxWordmark />);

    expect(markup).toContain('aria-label="NESBOX"');
    expect(markup).toContain("<title>NESBOX</title>");
    expect(markup.match(/data-letter=/g)).toHaveLength(6);
    expect(markup).not.toContain("Game Library");
  });
});
