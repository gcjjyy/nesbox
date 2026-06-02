import { describe, expect, it } from "vitest";
import { detectSystemFromName, extensionOf, formatBytes, makeRomId } from "./rom";

describe("rom helpers", () => {
  it("detects supported systems from filename", () => {
    expect(detectSystemFromName("zelda.NES")).toBe("nes");
    expect(detectSystemFromName("metroid.sfc")).toBe("snes");
    expect(detectSystemFromName("readme.txt")).toBeNull();
  });

  it("extracts lowercase extensions", () => {
    expect(extensionOf("A/B/Mario.SMC")).toBe("smc");
    expect(extensionOf("NoExtension")).toBe("");
  });

  it("creates stable ids", () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    expect(makeRomId("nes", "nestopia", "game.nes", bytes)).toBe(makeRomId("nes", "nestopia", "game.nes", bytes));
  });

  it("formats byte counts", () => {
    expect(formatBytes(42)).toBe("42 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });
});
