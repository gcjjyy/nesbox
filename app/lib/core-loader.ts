import type { CoreMetadata, NesboxButton, NesboxCore, NesboxCoreFactory } from "./core-contract";
import { emulatorById, EMULATOR_PROFILES, type EmulatorProfile } from "./emulator-registry";
import type { EmulatorId } from "./rom";

export const CORE_TARGETS = EMULATOR_PROFILES;

const loadedScripts = new Map<string, Promise<void>>();

export async function createCore(emulatorId: EmulatorId, canvas: HTMLCanvasElement): Promise<NesboxCore> {
  const target = requiredProfile(emulatorId);
  await loadScript(target.scriptUrl);
  const factory = window[target.factoryName as keyof Window] as NesboxCoreFactory | undefined;
  if (!factory) {
    throw new Error(`${target.factoryName} is not registered by ${target.scriptUrl}`);
  }
  return factory({
    canvas,
    wasmUrl: target.wasmUrl,
    onLog: (line) => console.debug(`[${emulatorId}] ${line}`),
  });
}

export function drawCoreMissing(canvas: HTMLCanvasElement, profile: EmulatorProfile, romName?: string): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = 768;
  const height = profile.system === "nes" ? 672 : 648;
  canvas.width = width;
  canvas.height = height;
  ctx.fillStyle = "#101316";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#d8ded5";
  ctx.font = "600 28px system-ui";
  ctx.fillText(profile.system.toUpperCase(), 44, 68);
  ctx.font = "500 18px system-ui";
  ctx.fillText(`${profile.shortName} WASM core is not installed yet.`, 44, 118);
  ctx.fillStyle = "#8f9b8f";
  ctx.font = "15px system-ui";
  ctx.fillText(romName ? `ROM ready: ${romName}` : "Drop a ROM file to prepare runtime state.", 44, 155);
  ctx.fillText(`Expected: ${profile.scriptUrl}`, 44, 190);
  ctx.fillText(`Expected: ${profile.wasmUrl}`, 44, 218);
  ctx.fillStyle = "#d94841";
  ctx.fillRect(44, height - 92, width - 88, 8);
}

export function makeUnavailableCore(emulatorId: EmulatorId, canvas: HTMLCanvasElement): NesboxCore {
  const profile = requiredProfile(emulatorId);
  const metadata: CoreMetadata = {
    system: profile.system,
    name: `${profile.shortName} placeholder`,
    source: profile.sourceUrl,
    license: profile.license,
  };
  return {
    metadata,
    async loadRom(_rom: Uint8Array, name: string) {
      drawCoreMissing(canvas, profile, name);
    },
    start() {
      drawCoreMissing(canvas, profile);
    },
    pause() {},
    resume() {},
    reset() {
      drawCoreMissing(canvas, profile);
    },
    stop() {},
    setButton(_player: number, _button: NesboxButton, _pressed: boolean) {},
    setVolume(_volume: number) {},
    async saveState() {
      throw new Error("WASM 코어가 설치되지 않아 상태 저장을 만들 수 없습니다.");
    },
    async loadState(_state: Uint8Array) {
      throw new Error("WASM 코어가 설치되지 않아 상태 저장을 불러올 수 없습니다.");
    },
    dispose() {},
  };
}

function requiredProfile(emulatorId: EmulatorId): EmulatorProfile {
  const profile = emulatorById(emulatorId);
  if (!profile) throw new Error(`Unknown emulator: ${emulatorId}`);
  return profile;
}

function loadScript(src: string): Promise<void> {
  const cached = loadedScripts.get(src);
  if (cached) return cached;
  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-nesbox-core="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`failed to load ${src}`)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.nesboxCore = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(script);
  });
  loadedScripts.set(src, promise);
  return promise;
}
