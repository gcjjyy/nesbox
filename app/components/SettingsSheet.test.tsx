import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../lib/storage";
import { assignKey } from "../lib/control-profiles";
import { SettingsSheet } from "./SettingsSheet";

describe("SettingsSheet overview", () => {
  it("shows the current key graphics before entering mapping mode", () => {
    const assigned = assignKey(DEFAULT_SETTINGS.keyBindings, "nes", "b", "KeyQ");
    const markup = renderToStaticMarkup(<SettingsSheet open settings={{ ...DEFAULT_SETTINGS, keyBindings: assigned.bindings }} onChange={() => undefined} onClose={() => undefined} />);
    expect(markup).toContain('aria-label="NES PC 키 배치"');
    expect(markup).toContain("<kbd>Q</kbd>");
    expect(markup).toContain("키 매핑 변경");
    expect(markup).not.toContain('class="key-profile"');
    expect(markup.match(/role="dialog"/g)).toHaveLength(1);
  });

  it("renders nothing when closed", () => {
    expect(renderToStaticMarkup(<SettingsSheet open={false} settings={DEFAULT_SETTINGS} onChange={() => undefined} onClose={() => undefined} />)).toBe("");
  });
});
