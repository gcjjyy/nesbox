import type { SystemId } from "./rom";

export type NesboxButton =
  | "up"
  | "down"
  | "left"
  | "right"
  | "a"
  | "b"
  | "x"
  | "y"
  | "l"
  | "r"
  | "start"
  | "select";

export type EmulatorPhase =
  | "idle"
  | "loading-core"
  | "ready"
  | "running"
  | "paused"
  | "error";

export interface CoreMetadata {
  system: SystemId;
  name: string;
  source: string;
  license: string;
  version?: string;
}

export interface CoreRuntimeOptions {
  canvas: HTMLCanvasElement;
  wasmUrl: string;
  onVideoFrame?: (width: number, height: number) => void;
  onAudioState?: (running: boolean) => void;
  onLog?: (line: string) => void;
}

export interface NesboxCore {
  metadata: CoreMetadata;
  loadRom: (rom: Uint8Array, name: string) => Promise<void>;
  start: () => Promise<void> | void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  stop: () => void;
  setButton: (player: number, button: NesboxButton, pressed: boolean) => void;
  setVolume: (volume: number) => void;
  resumeAudio?: () => Promise<void> | void;
  saveState: () => Promise<Uint8Array>;
  loadState: (state: Uint8Array) => Promise<void>;
  dispose: () => void;
}

export type NesboxCoreFactory = (options: CoreRuntimeOptions) => Promise<NesboxCore>;

export interface CoreScriptGlobal {
  createNesboxCore?: NesboxCoreFactory;
  createNesboxNestopiaCore?: NesboxCoreFactory;
  createNesboxFceuxCore?: NesboxCoreFactory;
  createNesboxSnes9xCore?: NesboxCoreFactory;
}

declare global {
  interface Window extends CoreScriptGlobal {}
}
