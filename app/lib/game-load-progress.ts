export interface GameLoadProgress {
  label: string;
  percent: number | null;
  detail?: string;
}

const RUNTIME_LABELS: Record<string, string> = {
  "Loading...": "게임 준비 중",
  "Download Game Core": "게임 코어 다운로드",
  "Decompress Game Core": "게임 코어 압축 해제",
  "Download Game Data": "게임 데이터 준비 중",
  "Decompress Game Data": "게임 데이터 압축 해제",
  "Download Game BIOS": "게임 BIOS 준비 중",
  "Decompress Game BIOS": "게임 BIOS 압축 해제",
  "Start Game": "게임 시작 준비 중",
};

function runtimeLabel(label: string) {
  return RUNTIME_LABELS[label] ?? (label || "게임 준비 중");
}

export function romLoadProgress(loaded: number, total: number | null): GameLoadProgress {
  return {
    label: "ROM 다운로드",
    percent: total && total > 0 ? Math.min(100, Math.round(loaded / total * 100)) : null,
    detail: `${(loaded / 1024 / 1024).toFixed(1)} MB`,
  };
}

/** EmulatorJS reports measured download/extraction progress in its loading text. */
export function runtimeLoadProgress(message: string): GameLoadProgress {
  const text = message.trim();
  const percent = text.match(/\s+(\d+(?:\.\d+)?)\s*%$/);
  if (percent) {
    return { label: runtimeLabel(text.slice(0, percent.index).trim()), percent: Math.min(100, Math.round(Number(percent[1]))) };
  }
  const size = text.match(/\s+(\d+(?:\.\d+)?\s*[KMGT]?B)$/i);
  if (size) return { label: runtimeLabel(text.slice(0, size.index).trim()), percent: null, detail: size[1] };
  return { label: runtimeLabel(text), percent: null };
}
