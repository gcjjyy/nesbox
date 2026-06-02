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
}

export interface StoredGame extends GameEntry {
  romPath: string;
}
