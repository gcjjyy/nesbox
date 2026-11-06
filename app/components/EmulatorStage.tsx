import { useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type Ref } from "react";
import { Volume2 } from "lucide-react";
import type { NesboxButton, NesboxCore, EmulatorPhase } from "../lib/core-contract";
import { recoverAudioCore } from "../lib/audio-core-recovery";
import { AudioContextPreparationError, createCore, drawCoreMissing, makeUnavailableCore } from "../lib/core-loader";
import { loadAssignedCore, type AssignedCoreStartResult } from "../lib/core-load-finalizer";
import { emulatorById } from "../lib/emulator-registry";
import type { GameEntry } from "../lib/game-types";
import { fetchRomBytes } from "../lib/library-client";
import type { SystemId } from "../lib/rom";
import { loadLocalStateBytes, saveLocalStateBytes } from "../lib/state-storage";
import type { UserSettings } from "../lib/storage";
import { KEYBOARD_MAP } from "../lib/keyboard-layout";
import { hasTouchSurface } from "../lib/touch-surface";
import { audioPromptRequired, audioSession } from "../lib/audio-session";
import { audioCoreRecoveryStatus, audioUnlockStatus } from "../lib/audio-unlock-policy";
import { useAudioSessionState } from "../lib/use-audio-session-state";
import { TouchControls } from "./TouchControls";

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
  onPhaseChange: (phase: EmulatorPhase) => void;
  onStatus: (status: string) => void;
  onRunningChange: (running: boolean) => void;
  onSavedStateChange?: (hasSavedState: boolean) => void;
  ref?: Ref<EmulatorStageHandle>;
}

const GAMEPAD_BUTTON_MAP = new Map<number, NesboxButton>([
  [0, "b"],
  [1, "a"],
  [8, "select"],
  [9, "start"],
  [12, "up"],
  [13, "down"],
  [14, "left"],
  [15, "right"],
]);

const GAMEPAD_AXIS_THRESHOLD = 0.45;

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

export function EmulatorStage({ settings, onPhaseChange, onStatus, onRunningChange, onSavedStateChange, ref }: EmulatorStageProps) {
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
  const fetchAbortRef = useRef<AbortController | null>(null);
  const readyStartRef = useRef<{
    seq: number;
    start: () => Promise<AssignedCoreStartResult>;
  } | null>(null);
  const [phase, setPhase] = useState<EmulatorPhase>("idle");
  const [audioUnlocking, setAudioUnlocking] = useState(false);
  const [startingArcade, setStartingArcade] = useState(false);
  const [romProgress, setRomProgress] = useState<string | null>(null);
  const [screenSystem, setScreenSystem] = useState<SystemId>("nes");
  const [screenPixels, setScreenPixels] = useState(screenSizeForSystem("nes"));
  const [touchSurface, setTouchSurface] = useState(false);
  const [hasSavedState, setHasSavedState] = useState(false);
  const audioState = useAudioSessionState();
  const audioPromptVisible = screenSystem !== "arcade" && audioPromptRequired(phase === "running", audioState);

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
    onPhaseChange(phase);
  }, [onPhaseChange, phase]);

  useEffect(() => {
    const held = new Set<NesboxButton>();
    const onKey = (event: KeyboardEvent, pressed: boolean) => {
      const button = KEYBOARD_MAP.get(event.code);
      if (!button || !coreRef.current) return;
      // 검색창 등에 글자를 칠 수 있도록 입력 필드에서는 가로채지 않는다.
      if (pressed && event.target instanceof HTMLElement && event.target.matches("input:not([type=range]):not([type=checkbox]):not([type=radio]), textarea, [contenteditable]")) return;
      event.preventDefault();
      coreRef.current.setButton(0, button, pressed);
      if (pressed) held.add(button);
      else held.delete(button);
    };
    const down = (event: KeyboardEvent) => onKey(event, true);
    const up = (event: KeyboardEvent) => onKey(event, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      // 언마운트될 때 눌려 있던 버튼이 남지 않도록 놓아 준다.
      for (const button of held) coreRef.current?.setButton(0, button, false);
    };
  }, []);

  useEffect(() => {
    let raf = 0;

    function setGamepadButton(next: Set<NesboxButton>, button: NesboxButton, pressed: boolean) {
      if (pressed) next.add(button);
      else next.delete(button);
    }

    function readGamepad() {
      const next = new Set<NesboxButton>();
      const gamepads = navigator.getGamepads?.() ?? [];
      const gamepad = Array.from(gamepads).find((item): item is Gamepad => Boolean(item));
      if (gamepad) {
        for (const [index, button] of GAMEPAD_BUTTON_MAP) {
          setGamepadButton(next, button, Boolean(gamepad.buttons[index]?.pressed));
        }
        const xAxis = gamepad.axes[0] ?? 0;
        const yAxis = gamepad.axes[1] ?? 0;
        setGamepadButton(next, "left", xAxis < -GAMEPAD_AXIS_THRESHOLD);
        setGamepadButton(next, "right", xAxis > GAMEPAD_AXIS_THRESHOLD);
        setGamepadButton(next, "up", yAxis < -GAMEPAD_AXIS_THRESHOLD);
        setGamepadButton(next, "down", yAxis > GAMEPAD_AXIS_THRESHOLD);
      }

      const previous = gamepadButtonsRef.current;
      for (const button of previous) {
        if (!next.has(button)) coreRef.current?.setButton(0, button, false);
      }
      for (const button of next) {
        if (!previous.has(button)) coreRef.current?.setButton(0, button, true);
      }
      gamepadButtonsRef.current = next;
      raf = requestAnimationFrame(readGamepad);
    }

    raf = requestAnimationFrame(readGamepad);
    return () => {
      cancelAnimationFrame(raf);
      for (const button of gamepadButtonsRef.current) {
        coreRef.current?.setButton(0, button, false);
      }
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
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = null;
    readyStartRef.current = null;
    const core = coreRef.current;
    coreRef.current = null;
    gameRef.current = null;
    setAudioUnlocking(false);
    setStartingArcade(false);
    setRomProgress(null);
    if (core) disposeOwnedCore(core);
    if (!updateUi) return;
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
    setPhase("loading-core");
    setRomProgress(null);
    onRunningChange(false);
    onStatus(`${game.title} 로딩 중`);
    disposeCore();
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
      core = await createCore(game.emulatorId, { canvas, hostElement });
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
        const progress = total && total > 0
          ? `${Math.min(100, Math.round((loaded / total) * 100))}%`
          : `${(loaded / 1024 / 1024).toFixed(1)} MB`;
        setRomProgress(progress);
        onStatus(`${game.title} ROM 불러오는 중 · ${progress}`);
      }, abortController.signal),
      loadRom: (romBytes) => core.loadRom(romBytes, game.fileName),
      isCurrent: () => !isStaleLoad(seq) && coreRef.current === core,
      dispose: disposeLoadCore,
      start: () => core.start(),
      autoStart: profile.runtime !== "emulatorjs",
      onRomLoaded: () => {
        setRomProgress(null);
        if (profile.runtime !== "emulatorjs" && canvasRef.current) {
          syncScreenPixelsFromCanvas(canvasRef.current);
        }
      },
      onStarted: () => {
        readyStartRef.current = null;
        setStartingArcade(false);
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
        readyStartRef.current = null;
        audioRecoveryRef.current = null;
        setPhase("error");
        onRunningChange(false);
        onStatus(statusFromError(error));
      },
    });
    if (fetchAbortRef.current === abortController) fetchAbortRef.current = null;
    if (finalization.kind === "stale") return "stale";
    if (finalization.kind === "failed") return false;
    if (finalization.kind === "ready") {
      readyStartRef.current = { seq, start: finalization.start };
      setPhase("ready");
      onStatus("ROM 준비 완료 · 게임 시작을 눌러주세요.");
    }
    return realCore;
  }

  async function startReadyGame(): Promise<boolean> {
    const pending = readyStartRef.current;
    if (!pending || pending.seq !== loadSeqRef.current || startingArcade) return false;
    setStartingArcade(true);
    onStatus("아케이드 코어 시작 중");
    const result = await pending.start();
    if (result.kind !== "started" && pending === readyStartRef.current) {
      setStartingArcade(false);
    }
    return result.kind === "started";
  }

  function toggleRun() {
    const core = coreRef.current;
    if (!core) return;
    if (phase === "ready") {
      void startReadyGame();
      return;
    }
    if (phase === "running") {
      core.pause();
      setPhase("paused");
      onRunningChange(false);
      onStatus("일시정지");
      return;
    }
    if (phase === "paused") core.resume();
    else core.start();
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
    if (!core || !game) return;
    const bytes = await loadLocalStateBytes(game.id, game.emulatorId, 0);
    if (coreRef.current !== core || gameRef.current !== game) return;
    if (!bytes) {
      updateSavedState(false);
      onStatus("이 브라우저에 저장된 상태가 없습니다.");
      return;
    }
    const startedFromReady = phase === "ready";
    if (startedFromReady && !await startReadyGame()) return;
    await core.loadState(bytes);
    if (coreRef.current !== core) return;
    if (phase !== "running" && !startedFromReady) {
      if (phase === "paused") core.resume();
      else await core.start();
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
    const node = shellRef.current;
    if (!node || document.fullscreenElement) return;
    await node.requestFullscreen();
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
    coreRef.current?.setButton(0, button, pressed);
  }

  const screenSize = screenSizeForSystem(screenSystem);
  const screenStyle = {
    "--screen-aspect": `${screenPixels.width} / ${screenPixels.height}`,
    "--screen-width": screenPixels.width,
    "--screen-height": screenPixels.height,
  } as CSSProperties;

  return (
    <section
      ref={shellRef}
      className={`emulator-stage emulator-stage--system-${screenSystem} ${settings.integerScale ? "emulator-stage--integer" : ""}`}
      style={screenStyle}
    >
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
            {screenSystem === "arcade" && phase === "loading-core" && (
              <div className="arcade-start-overlay" aria-live="polite">
                <strong>ROM 준비 중</strong>
                <span>{romProgress ?? "코어를 확인하고 있습니다."}</span>
              </div>
            )}
            {screenSystem === "arcade" && phase === "ready" && (
              <div className="arcade-start-overlay">
                <button
                  type="button"
                  className="arcade-start-button"
                  onClick={() => void startReadyGame()}
                  disabled={startingArcade}
                >
                  {startingArcade ? "시작 중…" : "게임 시작"}
                </button>
                <span>클릭하면 아케이드 코어와 오디오를 시작합니다.</span>
              </div>
            )}
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
        enabled={settings.touchControls && touchSurface}
        running={phase === "running"}
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
