export function audioUnlockStatus(unlocked: boolean): string {
  return unlocked
    ? "오디오 준비 완료"
    : "오디오를 시작하지 못했습니다. 다시 탭해 주세요.";
}

export function audioCoreRecoveryStatus(recovered: boolean): string {
  return recovered
    ? "오디오 준비 완료"
    : "오디오는 준비됐지만 게임 코어를 다시 불러오지 못했습니다.";
}
