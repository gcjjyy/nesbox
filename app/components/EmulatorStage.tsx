import { useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type Ref } from "react";
import { Minimize, Volume2 } from "lucide-react";
import { useGameFullscreen } from "../lib/use-game-fullscreen";
import type { NesboxButton, NesboxCore, EmulatorPhase } from "../lib/core-contract";
import {
  controlProfileForGame,
  createKeyboardInputRouter,
  createPressedInputTracker,
  keyboardMapForProfile,
  type ControlProfileId,
  type KeyboardInputRouter,
  type PressedInputTracker,
} from "../lib/control-profiles";
import { readConnectedGamepads, readGamepadButtons, selectGamepad } from "../lib/gamepad-input";
import { createInputMixer } from "../lib/input-mixer";
import { recoverAudioCore } from "../lib/audio-core-recovery";
import { AudioContextPreparationError, createCore, drawCoreMissing, makeUnavailableCore } from "../lib/core-loader";
import { loadAssignedCore } from "../lib/core-load-finalizer";
import { emulatorById } from "../lib/emulator-registry";
import type { GameEntry } from "../lib/game-types";
import { fetchRomBytes } from "../lib/library-client";
import type { SystemId } from "../lib/rom";
import { loadLocalStateBytes, saveLocalStateBytes } from "../lib/state-storage";
import type { UserSettings } from "../lib/storage";
import { hasTouchSurface } from "../lib/touch-surface";
import { audioPromptRequired, audioSession } from "../lib/audio-session";
import { audioCoreRecoveryStatus, audioUnlockStatus } from "../lib/audio-unlock-policy";
import { useAudioSessionState } from "../lib/use-audio-session-state";
import { TouchControls } from "./TouchControls";
import { GameLoadingOverlay } from "./GameLoadingOverlay";
import { romLoadProgress, type GameLoadProgress } from "../lib/game-load-progress";

export interface EmulatorStageHandle {
  openGame: (game: GameEntry) => Promise<void>;
  toggleRun: () => void;
  reset: () => void;
  saveState: () => Promise<void>;
  loadState: () => Promise<void>;
  fullscreen: () => Promise<void>;
  dispose: () => void;
}

export interface EmulatorStageProps {
  settings: UserSettings;
  inputSuspended: boolean;
  onPhaseChange: (phase: EmulatorPhase) => void;
  onStatus: (status: string) => void;
  onRunningChange: (running: boolean) => void;
  onSavedStateChange?: (hasSavedState: boolean) => void;
  ref?: Ref<EmulatorStageHandle>;
}

// em-fceux는 위아래 오버스캔을 뺀 224줄을 8:7 픽셀 비율로 출력한다(292x224).
// 화면 틀을 처음부터 이 비율로 잡아야 코어가 맞춘 캔버스와 틀이 어긋나지 않는다.
const SCREEN_SIZES: Record<"nes" | "snes" | "arcade", { width: number; height: number }> = {
  nes: { width: 292, height: 224 },
  snes: { width: 256, height: 224 },
  arcade: { width: 320, height: 240 },
};

type GameLoadResult = boolean | "stale";

interface PendingAudioRecovery {
  game: GameEntry;
  lifecycleGeneration: number;
  seq: number;
}

interface AudioUnlockAttempt {
  lifecycleGeneration: number;
}

function screenSizeForSystem(system: SystemId) {
  if (system === "snes") return SCREEN_SIZES.snes;
  if (system === "arcade") return SCREEN_SIZES.arcade;
  return SCREEN_SIZES.nes;
}

export function EmulatorStage({ settings, inputSuspended, onPhaseChange, onStatus, onRunningChange, onSavedStateChange, ref }: EmulatorStageProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const emulatorJsHostRef = useRef<HTMLDivElement | null>(null);
  const coreRef = useRef<NesboxCore | null>(null);
  const disposedCoresRef = useRef(new WeakSet<NesboxCore>());
  const gameRef = useRef<GameEntry | null>(null);
  const disposedRef = useRef(false);
  const loadSeqRef = useRef(0);
  const lifecycleGenerationRef = useRef(0);
  const audioRecoveryRef = useRef<PendingAudioRecovery | null>(null);
  const audioUnlockAttemptRef = useRef<AudioUnlockAttempt | null>(null);
  const gamepadButtonsRef = useRef(new Set<NesboxButton>());
  const settingsRef = useRef(settings);
  const inputProfileRef = useRef<ControlProfileId>("nes");
  const inputSuspendedRef = useRef(inputSuspended);
  const keyboardRouterRef = useRef<KeyboardInputRouter | null>(null);
  const gamepadTrackerRef = useRef<PressedInputTracker | null>(null);
  const inputMixerRef = useRef<ReturnType<typeof createInputMixer> | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<EmulatorPhase>("idle");
  const [audioUnlocking, setAudioUnlocking] = useState(false);
  const [arcadeAudioRunning, setArcadeAudioRunning] = useState(false);
  const [loadProgress, setLoadProgress] = useState<GameLoadProgress>({ label: "게임 준비 중", percent: null });
  const [screenSystem, setScreenSystem] = useState<SystemId>("nes");
  const [inputProfile, setInputProfile] = useState<ControlProfileId>("nes");
  const [screenPixels, setScreenPixels] = useState(screenSizeForSystem("nes"));
  const [touchSurface, setTouchSurface] = useState(false);
  const fullscreenView = useGameFullscreen(shellRef, screenPixels, touchSurface);
  const [hasSavedState, setHasSavedState] = useState(false);
  const audioState = useAudioSessionState();
  const activeAudioState = screenSystem === "arcade" ? (arcadeAudioRunning ? "running" : "locked") : audioState;
  const audioPromptVisible = audioPromptRequired(phase === "running", activeAudioState);
  settingsRef.current = settings;
  inputSuspendedRef.current = inputSuspended;

  if (!inputMixerRef.current) {
    inputMixerRef.current = createInputMixer((button, pressed) => coreRef.current?.setButton(0, button, pressed));
  }
  if (!keyboardRouterRef.current) {
    keyboardRouterRef.current = createKeyboardInputRouter({
      resolveButton: (code) => keyboardMapForProfile(
        settingsRef.current.keyBindings,
        inputProfileRef.current,
      ).get(code),
      send: (button, pressed) => inputMixerRef.current?.set("keyboard", button, pressed),
      isSuspended: () => inputSuspendedRef.current,
    });
  }
  if (!gamepadTrackerRef.current) {
    gamepadTrackerRef.current = createPressedInputTracker(
      (button, pressed) => inputMixerRef.current?.set("gamepad", button, pressed),
    );
  }

  useImperativeHandle(ref, () => ({
    openGame,
    toggleRun,
    reset,
    saveState,
    loadState,
    fullscreen,
    dispose: shutdownCore,
  }));

  useEffect(() => {
    coreRef.current?.setVolume(settings.volume);
  }, [settings.volume]);

  useEffect(() => {
    if (inputSuspended) releaseAllTrackedInput();
  }, [inputSuspended]);

  useEffect(() => {
    onPhaseChange(phase);
  }, [onPhaseChange, phase]);

  useEffect(() => {
    const router = keyboardRouterRef.current!;
    const down = (event: KeyboardEvent) => router.keyDown(event);
    const up = (event: KeyboardEvent) => router.keyUp(event);
    const releaseAll = () => releaseAllTrackedInput();
    const onVisibilityChange = () => {
      if (document.hidden) releaseAll();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      releaseAll();
    };
  }, []);

  useEffect(() => {
    let raf = 0;

    function readGamepad() {
      const gamepad = selectGamepad(readConnectedGamepads().devices, settingsRef.current.gamepad.selectedDevice);
      const next = gamepad && coreRef.current && !inputSuspendedRef.current && !document.hidden && document.hasFocus()
        ? readGamepadButtons(gamepad, inputProfileRef.current, settingsRef.current.gamepad)
        : new Set<NesboxButton>();

      const previous = gamepadButtonsRef.current;
      for (const button of previous) {
        if (!next.has(button)) gamepadTrackerRef.current?.set(button, false);
      }
      for (const button of next) {
        if (!previous.has(button)) gamepadTrackerRef.current?.set(button, true);
      }
      gamepadButtonsRef.current = next;
      raf = requestAnimationFrame(readGamepad);
    }

    raf = requestAnimationFrame(readGamepad);
    return () => {
      cancelAnimationFrame(raf);
      gamepadTrackerRef.current?.releaseAll();
      gamepadButtonsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    disposedRef.current = false;
    return () => shutdownCore(false);
  }, []);

  useEffect(() => {
    const query = window.matchMedia?.("(pointer: coarse)");
    const update = () => setTouchSurface(hasTouchSurface());
    update();
    query?.addEventListener("change", update);
    return () => query?.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const emulatorJsHost = emulatorJsHostRef.current;
    if (!canvas || !emulatorJsHost) return;

    let raf = 0;
    let stopped = false;

    const update = () => syncScreenPixelsFromActiveCanvas();
    const observer = new MutationObserver(update);
    observer.observe(canvas, { attributes: true, attributeFilter: ["height", "style", "width"] });
    observer.observe(emulatorJsHost, {
      attributes: true,
      attributeFilter: ["data-nesbox-video-height", "data-nesbox-video-width", "height", "style", "width"],
      childList: true,
      subtree: true,
    });

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    resizeObserver?.observe(canvas);
    resizeObserver?.observe(emulatorJsHost);

    const startedAt = performance.now();
    const tick = () => {
      update();
      if (!stopped && performance.now() - startedAt < 3000) raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
      resizeObserver?.disconnect();
    };
  }, []);

  function shutdownCore(updateUi = true) {
    disposedRef.current = true;
    loadSeqRef.current += 1;
    invalidateAudioRecovery();
    disposeCore(updateUi);
  }

  function disposeCore(updateUi = true) {
    releaseAllTrackedInput();
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = null;
    const core = coreRef.current;
    coreRef.current = null;
    gameRef.current = null;
    setAudioUnlocking(false);
    setArcadeAudioRunning(false);
    if (core) disposeOwnedCore(core);
    if (!updateUi) return;
    switchInputProfile("nes");
    setScreenSystem("nes");
    setScreenPixels(screenSizeForSystem("nes"));
    setPhase("idle");
    onRunningChange(false);
  }

  function disposeOwnedCore(core: NesboxCore) {
    if (coreRef.current === core) coreRef.current = null;
    if (disposedCoresRef.current.has(core)) return;
    disposedCoresRef.current.add(core);
    core.dispose();
  }

  function syncScreenPixelsFromCanvas(canvas: HTMLCanvasElement) {
    const next = readScreenPixelsFromCanvas(canvas);
    if (!next) return;
    setScreenPixels((prev) => (prev.width === next.width && prev.height === next.height ? prev : next));
  }

  function syncScreenPixelsFromActiveCanvas() {
    if (gameRef.current?.system === "arcade") {
      const host = emulatorJsHostRef.current;
      if (!host) return;
      const width = Number(host.dataset.nesboxVideoWidth);
      const height = Number(host.dataset.nesboxVideoHeight);
      const aspect = width / height;
      // EmulatorJS stretches its canvas to the host, so the bridge exposes the core's own
      // framebuffer dimensions. Feeding CSS canvas sizes back here causes a resize loop.
      if (width > 0 && height > 0 && aspect >= 0.5 && aspect <= 2.5) {
        setScreenPixels((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
      }
      return;
    }
    if (canvasRef.current) syncScreenPixelsFromCanvas(canvasRef.current);
  }

  function isStaleLoad(seq: number) {
    return disposedRef.current || seq !== loadSeqRef.current;
  }

  async function openGame(game: GameEntry): Promise<void> {
    invalidateAudioRecovery();
    await loadGame(game);
  }

  function invalidateAudioRecovery() {
    lifecycleGenerationRef.current += 1;
    audioRecoveryRef.current = null;
    audioUnlockAttemptRef.current = null;
  }

  async function loadGame(game: GameEntry): Promise<GameLoadResult> {
    const canvas = canvasRef.current;
    const hostElement = emulatorJsHostRef.current;
    if (!canvas || !hostElement) return "stale";
    disposedRef.current = false;
    audioRecoveryRef.current = null;
    const seq = loadSeqRef.current + 1;
    loadSeqRef.current = seq;
    disposeCore();
    setPhase("loading-core");
    setLoadProgress({ label: "게임 준비 중", percent: null });
    onRunningChange(false);
    onStatus(`${game.title} 로딩 중`);
    switchInputProfile(controlProfileForGame(game));
    setScreenSystem(game.system);
    setScreenPixels(screenSizeForSystem(game.system));
    gameRef.current = game;
    updateSavedState(false);
    loadLocalStateBytes(game.id, game.emulatorId, 0)
      .then((bytes) => {
        if (gameRef.current?.id === game.id) updateSavedState(bytes !== null);
      })
      .catch(() => undefined);
    const profile = emulatorById(game.emulatorId);
    if (!profile) {
      setPhase("error");
      onStatus(`알 수 없는 에뮬레이터입니다: ${game.emulatorId}`);
      return false;
    }

    let core: NesboxCore;
    let realCore = true;
    let audioPreparationFailed = false;
    try {
      core = await createCore(game.emulatorId, {
        canvas, hostElement,
        onAudioState: (running) => {
          if (!isStaleLoad(seq)) setArcadeAudioRunning(running);
        },
        onRuntimeStatus: (message) => {
          if (!isStaleLoad(seq)) onStatus(message);
        },
        onLoadProgress: (progress) => {
          if (isStaleLoad(seq)) return;
          setLoadProgress(progress);
          onStatus(`${progress.label}${progress.percent === null ? "" : ` · ${progress.percent}%`}`);
        },
      });
      if (isStaleLoad(seq)) {
        disposeOwnedCore(core);
        return "stale";
      }
      onStatus(`${core.metadata.name} 코어 준비 완료`);
    } catch (err) {
      if (isStaleLoad(seq)) return "stale";
      console.warn("[nesbox] core unavailable:", err);
      realCore = false;
      audioPreparationFailed = err instanceof AudioContextPreparationError;
      if (audioPreparationFailed) {
        audioRecoveryRef.current = {
          game,
          lifecycleGeneration: lifecycleGenerationRef.current,
          seq,
        };
      }
      core = makeUnavailableCore(game.emulatorId, canvas);
      drawCoreMissing(canvas, profile, game.fileName);
    }

    coreRef.current = core;
    const abortController = new AbortController();
    fetchAbortRef.current = abortController;
    const disposeLoadCore = () => {
      const wasCurrent = coreRef.current === core;
      if (wasCurrent && gameRef.current?.id === game.id) gameRef.current = null;
      disposeOwnedCore(core);
    };
    const finalization = await loadAssignedCore({
      prepare: () => core.setVolume(settings.volume),
      fetchRom: () => fetchRomBytes(game.id, (loaded, total) => {
        if (isStaleLoad(seq)) return;
        const progress = romLoadProgress(loaded, total ?? game.size);
        setLoadProgress(progress);
        onStatus(`${game.title} ROM 불러오는 중 · ${progress.percent === null ? progress.detail : `${progress.percent}%`}`);
      }, abortController.signal),
      loadRom: (romBytes) => core.loadRom(romBytes, game.fileName),
      isCurrent: () => !isStaleLoad(seq) && coreRef.current === core,
      dispose: disposeLoadCore,
      start: () => core.start(),
      onRomLoaded: () => {
        setLoadProgress({ label: "게임 시작 준비 중", percent: null });
        if (profile.runtime !== "emulatorjs" && canvasRef.current) {
          syncScreenPixelsFromCanvas(canvasRef.current);
        }
      },
      onStarted: () => {
        syncScreenPixelsFromActiveCanvas();
        setPhase("running");
        onRunningChange(true);
        if (audioPreparationFailed) {
          onStatus("오디오 버튼을 눌러 게임을 다시 불러오세요.");
        } else if (realCore) {
          onStatus("실행 중");
        } else {
          onStatus("WASM 코어 파일이 없어 런타임 인터페이스만 준비되었습니다.");
        }
      },
      onFailure: (error) => {
        audioRecoveryRef.current = null;
        setPhase("error");
        onRunningChange(false);
        onStatus(statusFromError(error));
      },
    });
    if (fetchAbortRef.current === abortController) fetchAbortRef.current = null;
    if (finalization.kind === "stale") return "stale";
    if (finalization.kind === "failed") return false;
    return realCore;
  }

  function toggleRun() {
    const core = coreRef.current;
    if (!core || (phase !== "running" && phase !== "paused")) return;
    if (phase === "running") {
      core.pause();
      setPhase("paused");
      onRunningChange(false);
      onStatus("일시정지");
      return;
    }
    core.resume();
    setPhase("running");
    onRunningChange(true);
    onStatus("실행 중");
  }

  // 실기의 리셋 버튼처럼 처음부터 다시 돌린다. 일시정지 중이었어도 바로 실행한다.
  function reset() {
    const core = coreRef.current;
    if (!core || (phase !== "running" && phase !== "paused")) return;
    core.reset();
    if (phase === "paused") core.resume();
    setPhase("running");
    onRunningChange(true);
    onStatus("리셋했습니다.");
  }

  async function saveState() {
    const core = coreRef.current;
    const game = gameRef.current;
    if (!core || !game) return;
    const bytes = await core.saveState();
    await saveLocalStateBytes(game.id, game.emulatorId, 0, bytes);
    updateSavedState(true);
    onStatus(`이 브라우저에 저장했습니다 (${Math.round(bytes.byteLength / 1024)} KB)`);
  }

  async function loadState() {
    const core = coreRef.current;
    const game = gameRef.current;
    if (!core || !game || (phase !== "running" && phase !== "paused")) return;
    const bytes = await loadLocalStateBytes(game.id, game.emulatorId, 0);
    if (coreRef.current !== core || gameRef.current !== game) return;
    if (!bytes) {
      updateSavedState(false);
      onStatus("이 브라우저에 저장된 상태가 없습니다.");
      return;
    }
    await core.loadState(bytes);
    if (coreRef.current !== core) return;
    if (phase === "paused") {
      core.resume();
      setPhase("running");
      onRunningChange(true);
    }
    onStatus("저장한 상태를 불러왔습니다.");
  }

  function updateSavedState(next: boolean) {
    setHasSavedState(next);
    onSavedStateChange?.(next);
  }

  async function fullscreen() {
    releaseAllTrackedInput();
    await fullscreenView.toggle();
  }

  async function unlockAudio() {
    const attempt: AudioUnlockAttempt = {
      lifecycleGeneration: lifecycleGenerationRef.current,
    };
    audioUnlockAttemptRef.current = attempt;
    setAudioUnlocking(true);
    const isAttemptCurrent = () => (
      audioUnlockAttemptRef.current === attempt &&
      lifecycleGenerationRef.current === attempt.lifecycleGeneration &&
      !disposedRef.current
    );
    try {
      if (gameRef.current?.system === "arcade") {
        const unlocked = await coreRef.current?.unlockAudio?.() ?? false;
        if (isAttemptCurrent()) onStatus(audioUnlockStatus(unlocked));
        return;
      }
      const pendingRecovery = audioRecoveryRef.current;
      const recoveryMatchesCurrentGame = Boolean(
        pendingRecovery &&
        pendingRecovery.lifecycleGeneration === attempt.lifecycleGeneration &&
        pendingRecovery.seq === loadSeqRef.current &&
        gameRef.current?.id === pendingRecovery.game.id
      );
      if (!pendingRecovery || !recoveryMatchesCurrentGame) {
        const unlocked = await audioSession.unlock();
        if (isAttemptCurrent()) onStatus(audioUnlockStatus(unlocked));
        return;
      }

      const result = await recoverAudioCore({
        unlock: () => audioSession.unlock(),
        isCurrent: isAttemptCurrent,
        reload: () => loadGame(pendingRecovery.game),
      });
      if (!isAttemptCurrent()) return;

      switch (result.kind) {
        case "unlock-failed":
          onStatus(result.error ? statusFromError(result.error) : audioUnlockStatus(false));
          break;
        case "recovered":
          onStatus(audioCoreRecoveryStatus(true));
          break;
        case "retry-failed":
          if (audioRecoveryRef.current) onStatus(audioUnlockStatus(false));
          else onStatus(result.error ? statusFromError(result.error) : audioCoreRecoveryStatus(false));
          break;
        case "stale":
          break;
      }
    } catch (err) {
      if (isAttemptCurrent()) onStatus(statusFromError(err));
    } finally {
      if (isAttemptCurrent()) {
        audioUnlockAttemptRef.current = null;
        setAudioUnlocking(false);
      }
    }
  }

  function onTouchButton(button: NesboxButton, pressed: boolean) {
    if (pressed && inputSuspendedRef.current) return;
    inputMixerRef.current?.set("touch", button, pressed);
  }

  function releaseAllTrackedInput() {
    keyboardRouterRef.current?.releaseAll();
    gamepadTrackerRef.current?.releaseAll();
    gamepadButtonsRef.current.clear();
    inputMixerRef.current?.releaseAll();
  }

  function switchInputProfile(next: ControlProfileId) {
    if (inputProfileRef.current === next) return;
    releaseAllTrackedInput();
    inputProfileRef.current = next;
    setInputProfile(next);
  }

  const screenSize = screenSizeForSystem(screenSystem);
  const screenStyle = {
    "--screen-aspect": `${screenPixels.width} / ${screenPixels.height}`,
    "--screen-width": screenPixels.width,
    "--screen-height": screenPixels.height,
    "--fullscreen-width": `${fullscreenView.layout.width}px`,
    "--fullscreen-height": `${fullscreenView.layout.height}px`,
    "--fullscreen-rotation": `${fullscreenView.layout.rotation}deg`,
  } as CSSProperties;

  return (
    <section
      ref={shellRef}
      className={`emulator-stage emulator-stage--system-${screenSystem} ${settings.integerScale ? "emulator-stage--integer" : ""} ${fullscreenView.active ? "emulator-stage--fullscreen" : ""}`}
      style={screenStyle}
      data-fullscreen-orientation={fullscreenView.active ? fullscreenView.layout.orientation : undefined}
    >
      <div className="emulator-stage__surface">
        {fullscreenView.active && (
          <button
            type="button"
            className="fullscreen-exit icon-button"
            onClick={() => { releaseAllTrackedInput(); void fullscreenView.exit(); }}
            aria-label="전체 화면 종료"
            title="전체 화면 종료"
          >
            <Minimize size={20} aria-hidden />
          </button>
        )}
        <div className="screen-slot">
          <div className="screen-bezel">
            <div className="screen-viewport">
              <canvas ref={canvasRef} className="game-canvas" width={screenSize.width} height={screenSize.height} />
              <div ref={emulatorJsHostRef} className="emulatorjs-host" aria-label="아케이드 게임 화면" />
              {phase === "idle" && (
                <div className="stage-empty">
                  <strong>Load ROM</strong>
                  <span>NES 또는 아케이드 게임을 브라우저에서 직접 실행합니다.</span>
                </div>
              )}
              {phase === "loading-core" && <GameLoadingOverlay progress={loadProgress} />}
            </div>
            {audioPromptVisible && (
              <div className="audio-unlock">
                <button
                  type="button"
                  className="audio-unlock__button"
                  onClick={() => void unlockAudio()}
                  disabled={audioUnlocking}
                >
                  <Volume2 size={18} strokeWidth={1.8} aria-hidden />
                  <span>{audioUnlocking ? "음소거 해제 중" : "탭하여 음소거 해제"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
        <TouchControls
          rotation={fullscreenView.active ? fullscreenView.layout.rotation : 0}
          enabled={settings.touchControls && touchSurface && !inputSuspended}
          running={phase === "running"}
          profile={inputProfile}
          onButton={onTouchButton}
          onRunToggle={toggleRun}
          onReset={reset}
          canLoad={hasSavedState}
          onSave={() => {
            saveState().catch((err) => onStatus(statusFromError(err)));
          }}
          onLoad={() => {
            loadState().catch((err) => onStatus(statusFromError(err)));
          }}
        />
      </div>
    </section>
  );
}

function statusFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readScreenPixelsFromCanvas(canvas: HTMLCanvasElement) {
  const styleWidth = parsePixelSize(canvas.style.width);
  const styleHeight = parsePixelSize(canvas.style.height);
  const width = styleWidth ?? canvas.width;
  const height = styleHeight ?? canvas.height;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width: Math.round(width), height: Math.round(height) };
}

function parsePixelSize(value: string) {
  const trimmed = value.trim();
  if (!trimmed.endsWith("px")) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
