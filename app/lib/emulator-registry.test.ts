import { describe, expect, it } from "vitest";
import { defaultEmulatorForFile, emulatorById, emulatorsForExtension } from "./emulator-registry";

describe("arcade emulator profiles", () => {
  it("registers explicit MAME 2003-Plus and FBNeo profiles", () => {
    expect(emulatorById("mame2003-plus")).toEqual(expect.objectContaining({
      id: "mame2003-plus",
      system: "arcade",
      runtime: "emulatorjs",
      coreName: "mame2003_plus",
      status: "active",
    }));
    expect(emulatorById("fbneo")).toEqual(expect.objectContaining({
      id: "fbneo",
      system: "arcade",
      runtime: "emulatorjs",
      coreName: "fbneo",
      status: "active",
    }));
    expect(emulatorsForExtension("game.zip").map((profile) => profile.id)).toEqual(["mame2003-plus", "fbneo"]);
  });

  it("does not guess an arcade core for an uploaded ZIP", () => {
    expect(defaultEmulatorForFile("game.zip")).toBeNull();
    expect(defaultEmulatorForFile("game.nes")?.id).toBe("fceux");
  });
});
