import { describe, expect, it } from "vitest";
import { audioUnlockStatus } from "./audio-unlock-policy";

describe("audio unlock status", () => {
  it("asks the user to retry when the explicit unlock returns false", () => {
    expect(audioUnlockStatus(false)).toBe("오디오를 시작하지 못했습니다. 다시 탭해 주세요.");
  });

  it("reports readiness only after the explicit unlock succeeds", () => {
    expect(audioUnlockStatus(true)).toBe("오디오 준비 완료");
  });
});
