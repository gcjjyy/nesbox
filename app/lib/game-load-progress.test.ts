import { describe, expect, it } from "vitest";
import { romLoadProgress, runtimeLoadProgress } from "./game-load-progress";

describe("game loading progress", () => {
  it("reports ROM byte progress without exceeding 100 percent", () => {
    expect(romLoadProgress(25, 100).percent).toBe(25);
    expect(romLoadProgress(101, 100).percent).toBe(100);
  });

  it("keeps unknown download lengths indeterminate", () => {
    expect(romLoadProgress(1048576, null)).toEqual({ label: "ROM 다운로드", percent: null, detail: "1.0 MB" });
    expect(romLoadProgress(0, 0).percent).toBeNull();
  });

  it("extracts the actual percentage for the current runtime step", () => {
    expect(runtimeLoadProgress("게임 코어 다운로드 42%")).toEqual({ label: "게임 코어 다운로드", percent: 42 });
    expect(runtimeLoadProgress("Download Game Core 42%")).toEqual({ label: "게임 코어 다운로드", percent: 42 });
    expect(runtimeLoadProgress("게임 코어 압축 해제 12.5%")).toEqual({ label: "게임 코어 압축 해제", percent: 13 });
  });

  it("does not invent a percentage for initialization or unknown-length runtime transfers", () => {
    expect(runtimeLoadProgress("게임 코어 준비 중")).toEqual({ label: "게임 코어 준비 중", percent: null });
    expect(runtimeLoadProgress("게임 코어 다운로드 2.45MB")).toEqual({ label: "게임 코어 다운로드", percent: null, detail: "2.45MB" });
  });
});
