import { describe, expect, it } from "vitest";
import { audioCoreRecoveryStatus, audioUnlockStatus } from "./audio-unlock-policy";

describe("audio unlock status", () => {
  it("asks the user to retry when the explicit unlock returns false", () => {
    expect(audioUnlockStatus(false)).toBe("오디오를 시작하지 못했습니다. 다시 탭해 주세요.");
  });

  it("reports readiness only after the explicit unlock succeeds", () => {
    expect(audioUnlockStatus(true)).toBe("오디오 준비 완료");
  });

  it("does not claim recovery when the real core retry fails", () => {
    expect(audioCoreRecoveryStatus(false)).toBe("오디오는 준비됐지만 게임 코어를 다시 불러오지 못했습니다.");
  });
});
