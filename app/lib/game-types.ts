import type { EmulatorId, SystemId } from "./rom";

export interface GameEntry {
  id: string;
  title: string;
  fileName: string;
  system: SystemId;
  emulatorId: EmulatorId;
  size: number;
  addedAt: number;
  lastPlayedAt: number | null;
  /** 박스아트 조회용 원제목 또는 아케이드 ROM shortname. 없으면 null */
  originalTitle: string | null;
  hasCover: boolean;
  /** 정렬과 무관하게 카탈로그 맨 앞에 고정 */
  pinned: boolean;
}

export interface StoredGame extends GameEntry {
  romPath: string;
  coverPath: string | null;
}
