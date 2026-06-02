export type SystemId = "nes" | "snes" | (string & {});
export type EmulatorId = "nestopia" | "fceux" | "snes9x" | (string & {});

export interface RomInfo {
  id: string;
  name: string;
  extension: string;
  system: SystemId;
  emulatorId: EmulatorId;
  bytes: Uint8Array;
  size: number;
}

const NES_EXTENSIONS = new Set(["nes", "fds", "unf", "unif"]);
const SNES_EXTENSIONS = new Set(["sfc", "smc", "fig", "swc"]);

export function extensionOf(name: string): string {
  const clean = name.trim().toLowerCase();
  const i = clean.lastIndexOf(".");
  return i >= 0 ? clean.slice(i + 1) : "";
}

export function detectSystemFromName(name: string): SystemId | null {
  const ext = extensionOf(name);
  if (NES_EXTENSIONS.has(ext)) return "nes";
  if (SNES_EXTENSIONS.has(ext)) return "snes";
  return null;
}

export function displaySystem(system: SystemId): string {
  return system === "nes" ? "NES / Famicom" : "SNES / Super Famicom";
}

export function makeRomId(system: SystemId, emulatorId: EmulatorId, name: string, bytes: Uint8Array): string {
  const hash = fnv1a32(bytes);
  return `${system}:${emulatorId}:${hash.toString(16).padStart(8, "0")}:${name}`;
}

export async function fileToRomInfo(file: File, forcedSystem?: SystemId, forcedEmulatorId?: EmulatorId): Promise<RomInfo> {
  const ext = extensionOf(file.name);
  const system = forcedSystem ?? detectSystemFromName(file.name);
  if (!system) {
    throw new Error("지원하는 ROM 확장자가 아닙니다. NES는 .nes/.fds, SNES는 .sfc/.smc를 사용하세요.");
  }
  const emulatorId = forcedEmulatorId ?? (system === "nes" ? "nestopia" : "snes9x");
  const bytes = new Uint8Array(await file.arrayBuffer());
  return {
    id: makeRomId(system, emulatorId, file.name, bytes),
    name: file.name,
    extension: ext,
    system,
    emulatorId,
    bytes,
    size: bytes.byteLength,
  };
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function fnv1a32(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;
  const stride = Math.max(1, Math.floor(bytes.length / 65536));
  for (let i = 0; i < bytes.length; i += stride) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= bytes.length & 0xff;
  hash = Math.imul(hash, 0x01000193);
  hash ^= (bytes.length >>> 8) & 0xff;
  hash = Math.imul(hash, 0x01000193);
  return hash >>> 0;
}
