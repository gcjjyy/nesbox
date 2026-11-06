import type { NesboxButton, NesboxCore } from "./core-contract";
import type { EmulatorProfile } from "./emulator-registry";
import { runtimeLoadProgress, type GameLoadProgress } from "./game-load-progress";
import { takeArcadeAudio } from "./arcade-audio";
import { watchArcadeHealth } from "./arcade-health";

const DATA_PATH = "/emulatorjs/data/";
const RETROPAD_INDEX: Record<NesboxButton, number> = {
  b: 0,
  y: 1,
  select: 2,
  start: 3,
  up: 4,
  down: 5,
  left: 6,
  right: 7,
  a: 8,
  x: 9,
  l: 10,
  r: 11,
};

export interface EmulatorJsMountConfig {
  hostElement: HTMLElement;
  coreName: string;
  gameName: string;
  gameUrl: string;
  dataPath: string;
  volume: number;
  signal?: AbortSignal;
  onProgress?: (progress: GameLoadProgress) => void;
  onRuntimeStatus?: (message: string) => void;
}

export interface EmulatorJsInstance {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  setVolume: (volume: number) => void;
  setInput: (player: number, index: number, pressed: boolean) => void;
  saveState: () => Promise<Uint8Array>;
  loadState: (state: Uint8Array) => Promise<void>;
  destroy: () => void;
}

export interface EmulatorJsBridge {
  mount: (config: EmulatorJsMountConfig) => Promise<EmulatorJsInstance>;
}

export async function createEmulatorJsCore(
  profile: EmulatorProfile,
  hostElement: HTMLElement,
  bridge: EmulatorJsBridge = browserEmulatorJsBridge,
  onProgress?: (progress: GameLoadProgress) => void,
  onRuntimeStatus?: (message: string) => void,
): Promise<NesboxCore> {
  if (profile.runtime !== "emulatorjs" || !profile.coreName) {
    throw new Error(`${profile.id} 프로필은 EmulatorJS 아케이드 코어가 아닙니다.`);
  }

  let romName: string | null = null;
  let romUrl: string | null = null;
  let mountPromise: Promise<EmulatorJsInstance> | null = null;
  let instance: EmulatorJsInstance | null = null;
  let disposed = false;
  let revoked = false;
  let currentVolume = 0.5;
  const mountAbort = new AbortController();
  const pressed = new Map<string, { player: number; index: number }>();

  const revokeRomUrl = () => {
    if (!romUrl || revoked) return;
    URL.revokeObjectURL(romUrl);
    revoked = true;
  };

  const releaseInputs = (target: EmulatorJsInstance) => {
    for (const { player, index } of pressed.values()) {
      target.setInput(player, index, false);
    }
  };

  const destroyInstance = (target: EmulatorJsInstance) => {
    releaseInputs(target);
    target.destroy();
  };

  return {
    metadata: {
      system: profile.system,
      name: profile.name,
      source: profile.sourceUrl,
      license: profile.license,
      version: "4.2.3",
    },
    async loadRom(rom, name) {
      if (disposed) throw new Error("이미 종료된 아케이드 코어입니다.");
      if (mountPromise) throw new Error("실행 중인 아케이드 코어에는 새 ROM을 불러올 수 없습니다.");
      revokeRomUrl();
      revoked = false;
      romName = name;
      romUrl = URL.createObjectURL(new Blob([Uint8Array.from(rom).buffer], { type: "application/zip" }));
    },
    async start() {
      if (disposed) return;
      if (instance) {
        instance.resume();
        return;
      }
      if (!romName || !romUrl) throw new Error("아케이드 ROM을 먼저 불러와야 합니다.");
      if (!mountPromise) {
        mountPromise = bridge.mount({
          hostElement,
          coreName: profile.coreName!,
          gameName: romName,
          gameUrl: romUrl,
          dataPath: DATA_PATH,
          volume: currentVolume,
          signal: mountAbort.signal,
          onRuntimeStatus: (message) => {
            if (!disposed) onRuntimeStatus?.(message);
          },
          onProgress: (progress) => {
            if (!disposed && !instance) onProgress?.(progress);
          },
        });
      }
      const mounted = await mountPromise;
      if (disposed) {
        destroyInstance(mounted);
        return;
      }
      instance = mounted;
      instance.setVolume(currentVolume);
      for (const { player, index } of pressed.values()) {
        instance.setInput(player, index, true);
      }
    },
    pause() {
      instance?.pause();
    },
    resume() {
      instance?.resume();
    },
    reset() {
      instance?.reset();
    },
    stop() {
      instance?.pause();
    },
    setButton(player, button, isPressed) {
      const index = RETROPAD_INDEX[button];
      const key = `${player}:${index}`;
      if (isPressed) pressed.set(key, { player, index });
      else pressed.delete(key);
      instance?.setInput(player, index, isPressed);
    },
    setVolume(volume) {
      const normalized = Math.max(0, Math.min(1, volume));
      currentVolume = normalized;
      instance?.setVolume(normalized);
    },
    async saveState() {
      if (!instance) throw new Error("게임을 시작한 뒤 상태를 저장할 수 있습니다.");
      return instance.saveState();
    },
    async loadState(state) {
      if (!instance) throw new Error("게임을 시작한 뒤 상태를 불러올 수 있습니다.");
      await instance.loadState(state);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mountAbort.abort();
      revokeRomUrl();
      if (instance) destroyInstance(instance);
      instance = null;
    },
  };
}

interface RawGameManager {
  functions?: { getFrameNum?: () => number };
  restart?: () => void;
  simulateInput?: (player: number, index: number, value: number) => void;
  supportsStates?: () => boolean;
  getState?: () => Uint8Array;
  loadState?: (state: Uint8Array) => void;
  getVideoDimensions?: (type: "width" | "height" | "aspect") => number | undefined;
}

interface RawEmulatorJs {
  Module?: { AL?: { currentCtx?: { audioCtx?: AudioContext } } };
  started?: boolean;
  failedToStart?: boolean;
  paused?: boolean;
  textElem?: { innerText?: string } | null;
  canvas?: HTMLCanvasElement;
  gameManager?: RawGameManager;
  gamepad?: { terminate?: () => void; listeners?: Record<string, unknown> };
  pause?: () => void;
  play?: () => void;
  setVolume?: (volume: number) => void;
  callEvent?: (event: string) => void;
  startGameError?: (message: string) => void;
  addEventListener?: (...args: unknown[]) => unknown;
  removeEventListener?: (registrations: unknown) => void;
}

interface EmulatorJsWindow extends Window {
  EJS_player?: string;
  EJS_core?: string;
  EJS_gameName?: string;
  EJS_gameUrl?: string;
  EJS_pathtodata?: string;
  EJS_language?: string;
  EJS_disableAutoLang?: boolean;
  EJS_startOnLoaded?: boolean;
  EJS_noAutoFocus?: boolean;
  EJS_disableDatabases?: boolean;
  EJS_disableLocalStorage?: boolean;
  EJS_threads?: boolean;
  EJS_volume?: number;
  EJS_DEBUG_XX?: boolean;
  EJS_Buttons?: Record<string, boolean>;
  EJS_defaultControls?: Record<number, Record<string, never>>;
  EJS_ready?: () => void;
  EJS_onGameStart?: () => void;
  EJS_emulator?: RawEmulatorJs;
}

let hostSequence = 0;

export const browserEmulatorJsBridge: EmulatorJsBridge = {
  async mount(config) {
    config.onProgress?.({ label: "게임 코어 준비 중", percent: null });
    const audio = takeArcadeAudio();

    // Each launch owns a browsing context. Removing it also stops late loaders,
    // workers, timers and window listeners that the upstream exit event leaves alive.
    const frame = document.createElement("iframe");
    frame.title = "아케이드 게임 화면";
    frame.className = "emulatorjs-frame";
    frame.allow = "autoplay; gamepad";
    const resumeAudio = () => {
      if (audio && audio.state !== "running" && audio.state !== "closed") void audio.resume().catch(() => undefined);
    };
    let audioStateChanged = () => {};
    let removed = false;
    const removeFrame = () => {
      if (removed) return;
      removed = true;
      window.removeEventListener("pointerdown", resumeAudio, true);
      window.removeEventListener("keydown", resumeAudio, true);
      audio?.removeEventListener("statechange", audioStateChanged);
      if (audio && audio.state !== "closed") void audio.close().catch(() => undefined);
      if (frame.parentElement === config.hostElement) {
        delete config.hostElement.dataset.nesboxVideoWidth;
        delete config.hostElement.dataset.nesboxVideoHeight;
      }
      frame.remove();
    };
    try {
      await requireLocalCoreAssets(config.dataPath, config.coreName);
      if (config.signal?.aborted) throw new DOMException("EmulatorJS mount cancelled", "AbortError");
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          frame.onload = null;
          removeFrame();
          reject(new DOMException("EmulatorJS mount cancelled", "AbortError"));
        };
        frame.onload = () => {
          config.signal?.removeEventListener("abort", abort);
          resolve();
        };
        config.signal?.addEventListener("abort", abort, { once: true });
        frame.srcdoc = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
          html,body,#game { margin:0; width:100%; height:100%; overflow:hidden; background:#030404; }
          #game .ejs_parent,#game .ejs_game,#game .ejs_canvas_parent,#game .ejs_canvas { width:100%!important; height:100%!important; }
          .ejs_canvas { object-fit:contain; image-rendering:pixelated; }
          .ejs_menu_bar,.ejs_context_menu,.ejs_virtualGamepad_parent,.ejs_virtualGamepad_open { display:none!important; }
          #resume-audio { position:absolute; z-index:10000; bottom:20px; left:50%; transform:translateX(-50%); padding:12px 18px; border:1px solid #58615e; border-radius:8px; background:#191f20; color:#fff; cursor:pointer; white-space:nowrap; }
        </style></head><body><div id="game"></div><button id="resume-audio" hidden>클릭하여 게임 계속하기</button></body></html>`;
        config.hostElement.replaceChildren(frame);
      });
      if (config.signal?.aborted) throw new DOMException("EmulatorJS mount cancelled", "AbortError");
      const runtimeWindow = frame.contentWindow as Window & typeof globalThis;
      const runtimeHost = frame.contentDocument!.getElementById("game")!;
      if (audio) {
        // The WASM engine must use the context unlocked by the original library click.
        const AudioConstructor = function () { return audio; } as unknown as typeof AudioContext;
        runtimeWindow.AudioContext = AudioConstructor;
        (runtimeWindow as typeof runtimeWindow & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext = AudioConstructor;
        const prompt = frame.contentDocument!.getElementById("resume-audio")!;
        audioStateChanged = () => { prompt.hidden = audio.state === "running"; };
        audio.addEventListener("statechange", audioStateChanged);
        audioStateChanged();
        prompt.addEventListener("click", resumeAudio);
        window.addEventListener("pointerdown", resumeAudio, true);
        window.addEventListener("keydown", resumeAudio, true);
        runtimeWindow.addEventListener("pointerdown", resumeAudio, true);
        runtimeWindow.addEventListener("keydown", resumeAudio, true);
      }
      const forwardKey = (event: KeyboardEvent) => {
        const forwarded = new KeyboardEvent(event.type, {
          key: event.key, code: event.code, repeat: event.repeat,
          shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, altKey: event.altKey,
          metaKey: event.metaKey, bubbles: true, cancelable: true,
        });
        window.dispatchEvent(forwarded);
        if (forwarded.defaultPrevented) event.preventDefault();
      };
      runtimeWindow.addEventListener("keydown", forwardKey);
      runtimeWindow.addEventListener("keyup", forwardKey);
      runtimeWindow.addEventListener("blur", () => window.dispatchEvent(new Event("blur")));
      const instance = await mountBrowserRuntime({ ...config, hostElement: runtimeHost }, runtimeWindow);
      Object.assign(config.hostElement.dataset, runtimeHost.dataset);
      return { ...instance, destroy() {
        try { instance.destroy(); } finally { removeFrame(); }
      } };
    } catch (error) {
      removeFrame();
      throw error;
    }
  },
};

async function mountBrowserRuntime(config: EmulatorJsMountConfig, window: Window & typeof globalThis): Promise<EmulatorJsInstance> {
  const document = window.document;
  const URL = window.URL;
  config.onProgress?.({ label: "게임 코어 준비 중", percent: null });
  if (config.signal?.aborted) throw new DOMException("EmulatorJS mount cancelled", "AbortError");
  const ejsWindow = window as EmulatorJsWindow;
  const hostId = config.hostElement.id || `nesbox-ejs-${++hostSequence}`;
  config.hostElement.id = hostId;
  config.hostElement.replaceChildren();
  // A repeated launch must not read the previous runtime's progress or error state.
  ejsWindow.EJS_emulator = undefined;

  ejsWindow.EJS_player = `#${hostId}`;
  ejsWindow.EJS_core = config.coreName;
  ejsWindow.EJS_gameName = config.gameName;
  ejsWindow.EJS_gameUrl = config.gameUrl;
  ejsWindow.EJS_pathtodata = config.dataPath;
  ejsWindow.EJS_language = "ko-KO";
  ejsWindow.EJS_disableAutoLang = false;
  ejsWindow.EJS_startOnLoaded = true;
  ejsWindow.EJS_noAutoFocus = true;
  ejsWindow.EJS_disableDatabases = false;
  ejsWindow.EJS_disableLocalStorage = true;
  ejsWindow.EJS_threads = false;
  ejsWindow.EJS_volume = config.volume;
  // The npm package ships readable source assets, not emulator.min.js/css.
  ejsWindow.EJS_DEBUG_XX = true;
  ejsWindow.EJS_defaultControls = { 0: {}, 1: {}, 2: {}, 3: {} };
  ejsWindow.EJS_Buttons = hiddenEmulatorJsButtons();

  return new Promise<EmulatorJsInstance>((resolve, reject) => {
    const script = document.createElement("script");
    const capturedUrls = new Set<string>();
    const listenerRegistrations: unknown[] = [];
    const originalCreateObjectUrl = URL.createObjectURL.bind(URL);
    const originalFetch = window.fetch.bind(window);
    let raw: RawEmulatorJs | undefined;
    let settled = false;
    let runtimePatched = false;
    let errorPoll = 0;
    let lastProgressMessage = "";

    URL.createObjectURL = ((object: Blob | MediaSource) => {
      const url = originalCreateObjectUrl(object);
      capturedUrls.add(url);
      return url;
    }) as typeof URL.createObjectURL;
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (/^https:\/\/cdn\.emulatorjs\.org\//i.test(url)) {
        return Promise.resolve(new Response("", { status: 403, statusText: "External runtime access disabled" }));
      }
      return originalFetch(input, init);
    }) as typeof window.fetch;

    const restoreGlobals = () => {
      URL.createObjectURL = originalCreateObjectUrl;
      window.fetch = originalFetch;
      config.signal?.removeEventListener("abort", abortMount);
    };
    const cleanupFailedMount = () => {
      try {
        raw?.gamepad?.terminate?.();
        raw?.callEvent?.("exit");
      } catch {
        // Continue removing runtime-owned resources.
      }
      for (const url of capturedUrls) {
        for (const childScript of document.querySelectorAll<HTMLScriptElement>("script[src]")) {
          if (childScript.src === url) childScript.remove();
        }
        URL.revokeObjectURL(url);
      }
      capturedUrls.clear();
      config.hostElement.replaceChildren();
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      window.clearInterval(errorPoll);
      restoreGlobals();
      cleanupFailedMount();
      script.remove();
      reject(normalizeStartupError(error, config.coreName));
    };
    const abortMount = () => fail(new DOMException("EmulatorJS mount cancelled", "AbortError"));
    const patchRuntime = () => {
      raw = ejsWindow.EJS_emulator;
      if (!raw || runtimePatched) return;
      runtimePatched = true;
      if (raw.addEventListener && raw.removeEventListener) {
        const originalAdd = raw.addEventListener.bind(raw);
        raw.addEventListener = (...args: unknown[]) => {
          const registration = originalAdd(...args);
          listenerRegistrations.push(registration);
          return registration;
        };
      }
      if (raw.startGameError) {
        const originalError = raw.startGameError.bind(raw);
        raw.startGameError = (message: string) => {
          originalError(message);
          fail(message);
        };
      }
    };

    ejsWindow.EJS_ready = patchRuntime;
    ejsWindow.EJS_onGameStart = () => {
      if (settled) return;
      patchRuntime();
      if (!raw?.gameManager) {
        fail(new Error("EmulatorJS game manager was not created"));
        return;
      }
      settled = true;
      window.clearInterval(errorPoll);
      restoreGlobals();
      script.remove();
      raw.gamepad?.terminate?.();
      if (raw.gamepad) raw.gamepad.listeners = {};
      resolve(wrapRawInstance(raw, config.hostElement, listenerRegistrations, capturedUrls, config.onRuntimeStatus));
    };
    script.src = `${config.dataPath}loader.js`;
    script.async = true;
    script.dataset.nesboxEmulatorjs = config.coreName;
    script.onerror = () => fail(new Error(`missing loader: ${script.src}`));
    config.signal?.addEventListener("abort", abortMount, { once: true });
    document.head.appendChild(script);

    errorPoll = window.setInterval(() => {
      raw = raw ?? ejsWindow.EJS_emulator;
      if (raw?.failedToStart) {
        fail(raw.textElem?.innerText || "EmulatorJS failed to start");
        return;
      }
      const message = raw?.textElem?.innerText?.trim();
      if (message && message !== lastProgressMessage) {
        lastProgressMessage = message;
        config.onProgress?.(runtimeLoadProgress(message));
      }
    }, 50);
  });
}

function wrapRawInstance(
  raw: RawEmulatorJs,
  hostElement: HTMLElement,
  listenerRegistrations: unknown[],
  capturedUrls: Set<string>,
  onRuntimeStatus?: (message: string) => void,
): EmulatorJsInstance {
  const document = hostElement.ownerDocument;
  const URL = document.defaultView!.URL;
  let destroyed = false;
  let graphicsLost = false;
  const onContextLost = () => {
    graphicsLost = true;
    onRuntimeStatus?.("그래픽 연결이 끊겨 게임이 멈췄습니다. 라이브러리에서 다시 실행해 주세요.");
  };
  const onContextRestored = () => { graphicsLost = false; };
  raw.canvas?.addEventListener("webglcontextlost", onContextLost);
  raw.canvas?.addEventListener("webglcontextrestored", onContextRestored);
  const stopHealthCheck = watchArcadeHealth(() => ({
    frame: raw.gameManager?.functions?.getFrameNum?.(),
    paused: !!raw.paused,
    hidden: document.hidden,
    audio: raw.Module?.AL?.currentCtx?.audioCtx?.state,
    graphicsLost,
  }), (message) => onRuntimeStatus?.(message));
  const manager = () => {
    if (!raw.gameManager) throw new Error("아케이드 런타임이 아직 준비되지 않았습니다.");
    return raw.gameManager;
  };
  const videoWidth = manager().getVideoDimensions?.("width");
  const videoHeight = manager().getVideoDimensions?.("height");
  if (videoWidth && videoHeight) {
    hostElement.dataset.nesboxVideoWidth = String(Math.round(videoWidth));
    hostElement.dataset.nesboxVideoHeight = String(Math.round(videoHeight));
  }
  return {
    pause: () => raw.pause?.(),
    resume: () => raw.play?.(),
    reset: () => manager().restart?.(),
    setVolume: (volume) => raw.setVolume?.(volume),
    setInput: (player, index, pressed) => manager().simulateInput?.(player, index, pressed ? 1 : 0),
    async saveState() {
      const gameManager = manager();
      if (!gameManager.supportsStates?.() || !gameManager.getState) {
        throw new Error("이 아케이드 코어는 상태 저장을 지원하지 않습니다.");
      }
      try {
        return new Uint8Array(gameManager.getState());
      } catch (error) {
        throw new Error("아케이드 상태를 직렬화하지 못했습니다.", { cause: error });
      }
    },
    async loadState(state) {
      const gameManager = manager();
      if (!gameManager.supportsStates?.() || !gameManager.loadState) {
        throw new Error("이 아케이드 코어는 상태 불러오기를 지원하지 않습니다.");
      }
      try {
        gameManager.loadState(state);
      } catch (error) {
        throw new Error("아케이드 상태를 불러오지 못했습니다.", { cause: error });
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopHealthCheck();
      raw.canvas?.removeEventListener("webglcontextlost", onContextLost);
      raw.canvas?.removeEventListener("webglcontextrestored", onContextRestored);
      try { raw.pause?.(); } catch { /* Continue cleanup. */ }
      try { raw.gamepad?.terminate?.(); } catch { /* Continue cleanup. */ }
      for (const registration of listenerRegistrations) {
        try { raw.removeEventListener?.(registration); } catch { /* Continue cleanup. */ }
      }
      try { raw.callEvent?.("exit"); } catch { /* Continue cleanup. */ }
      for (const url of capturedUrls) {
        for (const script of document.querySelectorAll<HTMLScriptElement>("script[src]")) {
          if (script.src === url) script.remove();
        }
        URL.revokeObjectURL(url);
      }
      capturedUrls.clear();
      delete hostElement.dataset.nesboxVideoWidth;
      delete hostElement.dataset.nesboxVideoHeight;
      hostElement.replaceChildren();
    },
  };
}

async function requireLocalCoreAssets(dataPath: string, coreName: string): Promise<void> {
  for (const variant of ["wasm", "legacy-wasm"]) {
    const url = `${dataPath}cores/${coreName}-${variant}.data`;
    let response: Response;
    try {
      response = await fetch(url, { method: "HEAD", credentials: "same-origin" });
    } catch (error) {
      throw new Error(`아케이드 코어 자산을 확인하지 못했습니다: ${url}`, { cause: error });
    }
    if (!response.ok) throw new Error(`아케이드 코어 자산을 찾을 수 없습니다: ${url}`);
  }
}

function hiddenEmulatorJsButtons(): Record<string, boolean> {
  return Object.fromEntries([
    "playPause", "restart", "mute", "settings", "fullscreen", "saveState", "loadState",
    "screenRecord", "gamepad", "cheat", "volumeSlider", "saveSavFiles", "loadSavFiles",
    "quickSave", "quickLoad", "screenshot", "cacheManager", "exitEmulation", "netplay", "diskButton",
  ].map((key) => [key, false]));
}

function normalizeStartupError(error: unknown, coreName: string): Error {
  if (error instanceof DOMException && error.name === "AbortError") return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/webgl|glctx|graphics|context lost/i.test(message)) {
    return new Error("그래픽 화면을 초기화하지 못했습니다. 게임을 다시 실행해 주세요.", { cause: error });
  }
  if (/memory|allocation|out of bounds/i.test(message)) {
    return new Error("아케이드 게임을 시작할 메모리가 부족합니다.", { cause: error });
  }
  if (/core|loader|asset|404|not found/i.test(message)) {
    return new Error(`아케이드 코어 자산을 불러오지 못했습니다 (${coreName}).`, { cause: error });
  }
  return new Error(`아케이드 게임을 시작하지 못했습니다 (${coreName}). ROM 호환성 또는 브라우저 실행 상태를 확인해 주세요.`, { cause: error });
}
