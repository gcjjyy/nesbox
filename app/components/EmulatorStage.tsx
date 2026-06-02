import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Volume2 } from "lucide-react";
import type { NesboxButton, NesboxCore, EmulatorPhase } from "../lib/core-contract";
import { createCore, drawCoreMissing, makeUnavailableCore } from "../lib/core-loader";
import { emulatorById } from "../lib/emulator-registry";
import type { GameEntry } from "../lib/game-types";
import { fetchRomBytes } from "../lib/library-client";
import type { SystemId } from "../lib/rom";
import { loadLocalStateBytes, saveLocalStateBytes } from "../lib/state-storage";
import type { UserSettings } from "../lib/storage";
import { TouchControls } from "./TouchControls";

export interface EmulatorStageHandle {
  openGame: (game: GameEntry) => Promise<void>;
  toggleRun: () => void;
  reset: () => void;
  saveState: () => Promise<void>;
  fullscreen: () => Promise<void>;
  dispose: () => void;
}

export interface EmulatorStageProps {
  settings: UserSettings;
  onPhaseChange: (phase: EmulatorPhase) => void;
  onStatus: (status: string) => void;
  onRunningChange: (running: boolean) => void;
  ref?: Ref<EmulatorStageHandle>;
}

const KEYBOARD_MAP = new Map<string, NesboxButton>([
  ["ArrowUp", "up"],
  ["ArrowDown", "down"],
  ["ArrowLeft", "left"],
  ["ArrowRight", "right"],
  ["KeyZ", "b"],
  ["KeyX", "a"],
  ["KeyA", "y"],
  ["KeyS", "x"],
  ["Enter", "start"],
  ["ShiftRight", "select"],
  ["ShiftLeft", "select"],
]);

const GAMEPAD_BUTTON_MAP = new Map<number, NesboxButton>([
  [0, "b"],
  [1, "a"],
  [2, "y"],
  [3, "x"],
  [4, "l"],
  [5, "r"],
  [8, "select"],
  [9, "start"],
  [12, "up"],
  [13, "down"],
  [14, "left"],
  [15, "right"],
]);

const GAMEPAD_AXIS_THRESHOLD = 0.45;

const SCREEN_SIZES: Record<"nes" | "snes", { width: number; height: number }> = {
  nes: { width: 256, height: 240 },
  snes: { width: 256, height: 224 },
};

function screenSizeForSystem(system: SystemId) {
  return system === "snes" ? SCREEN_SIZES.snes : SCREEN_SIZES.nes;
}

function isDesktopChrome() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /\bChrome\//.test(ua) &&
    !/\b(Edg|OPR|Opera|SamsungBrowser|CriOS)\//.test(ua) &&
    !/\b(Mobile|Android|iPhone|iPad|iPod)\b/.test(ua)
  );
}

export function EmulatorStage({ settings, onPhaseChange, onStatus, onRunningChange, ref }: EmulatorStageProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const coreRef = useRef<NesboxCore | null>(null);
  const gameRef = useRef<GameEntry | null>(null);
  const disposedRef = useRef(false);
  const loadSeqRef = useRef(0);
  const gamepadButtonsRef = useRef(new Set<NesboxButton>());
  const audioPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [phase, setPhase] = useState<EmulatorPhase>("idle");
  const [audioPromptVisible, setAudioPromptVisible] = useState(false);
  const [audioUnlocking, setAudioUnlocking] = useState(false);
  const [screenSystem, setScreenSystem] = useState<SystemId>("nes");

  useImperativeHandle(ref, () => ({
    openGame,
    toggleRun,
    reset,
    saveState,
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
    const onKey = (event: KeyboardEvent, pressed: boolean) => {
      const button = KEYBOARD_MAP.get(event.code);
      if (!button || !coreRef.current) return;
      event.preventDefault();
      if (pressed) coreRef.current.resumeAudio?.();
      coreRef.current.setButton(0, button, pressed);
    };
    const down = (event: KeyboardEvent) => onKey(event, true);
    const up = (event: KeyboardEvent) => onKey(event, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
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

  function shutdownCore(updateUi = true) {
    disposedRef.current = true;
    loadSeqRef.current += 1;
    clearAudioPromptTimer();
    disposeCore(updateUi);
  }

  function disposeCore(updateUi = true) {
    const core = coreRef.current;
    coreRef.current = null;
    gameRef.current = null;
    setAudioPromptVisible(false);
    setAudioUnlocking(false);
    if (core) core.dispose();
    if (!updateUi) return;
    setScreenSystem("nes");
    setPhase("idle");
    onRunningChange(false);
  }

  function clearAudioPromptTimer() {
    if (!audioPromptTimerRef.current) return;
    clearTimeout(audioPromptTimerRef.current);
    audioPromptTimerRef.current = null;
  }

  function scheduleAudioPrompt(seq: number) {
    clearAudioPromptTimer();
    audioPromptTimerRef.current = setTimeout(() => {
      audioPromptTimerRef.current = null;
      if (isStaleLoad(seq) || isDesktopChrome()) return;
      setAudioPromptVisible(true);
    }, 1200);
  }

  function isStaleLoad(seq: number) {
    return disposedRef.current || seq !== loadSeqRef.current;
  }

  async function openGame(game: GameEntry) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    disposedRef.current = false;
    const seq = loadSeqRef.current + 1;
    loadSeqRef.current = seq;
    setPhase("loading-core");
    onRunningChange(false);
    onStatus(`${game.title} 로딩 중`);
    disposeCore();
    setScreenSystem(game.system);
    gameRef.current = game;
    const profile = emulatorById(game.emulatorId);
    if (!profile) {
      setPhase("error");
      onStatus(`알 수 없는 에뮬레이터입니다: ${game.emulatorId}`);
      return;
    }

    let core: NesboxCore;
    try {
      core = await createCore(game.emulatorId, canvas);
      if (isStaleLoad(seq)) {
        core.dispose();
        return;
      }
      onStatus(`${core.metadata.name} 코어 준비 완료`);
    } catch (err) {
      if (isStaleLoad(seq)) return;
      console.warn("[nesbox] core unavailable:", err);
      core = makeUnavailableCore(game.emulatorId, canvas);
      drawCoreMissing(canvas, profile, game.fileName);
      onStatus("WASM 코어 파일이 없어 런타임 인터페이스만 준비되었습니다.");
    }

    coreRef.current = core;
    core.setVolume(settings.volume);
    const romBytes = await fetchRomBytes(game.id);
    if (isStaleLoad(seq)) {
      core.dispose();
      return;
    }
    await core.loadRom(romBytes, game.fileName);
    if (isStaleLoad(seq)) {
      core.dispose();
      return;
    }
    try {
      const state = await loadLocalStateBytes(game.id, game.emulatorId, 0);
      if (isStaleLoad(seq)) {
        core.dispose();
        return;
      }
      if (state) {
        await core.loadState(state);
        onStatus("이 브라우저에 저장된 상태를 복원했습니다.");
      }
    } catch (err) {
      onStatus(err instanceof Error ? err.message : "상태 복원 실패");
    }
    core.start();
    setPhase("running");
    onRunningChange(true);
    onStatus("실행 중");
    scheduleAudioPrompt(seq);
  }

  function toggleRun() {
    const core = coreRef.current;
    if (!core) return;
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

  function reset() {
    coreRef.current?.reset();
    setPhase("ready");
    onRunningChange(false);
    onStatus("리셋 완료");
  }

  async function saveState() {
    const core = coreRef.current;
    const game = gameRef.current;
    if (!core || !game) return;
    const bytes = await core.saveState();
    await saveLocalStateBytes(game.id, game.emulatorId, 0, bytes);
    onStatus(`이 브라우저의 슬롯 0 저장 완료 (${Math.round(bytes.byteLength / 1024)} KB)`);
  }

  async function fullscreen() {
    const node = shellRef.current;
    if (!node || document.fullscreenElement) return;
    await node.requestFullscreen();
  }

  async function unlockAudio(showStatus = true) {
    const core = coreRef.current;
    if (!core?.resumeAudio) return;
    setAudioUnlocking(true);
    try {
      await core.resumeAudio();
      setAudioPromptVisible(false);
      if (showStatus) onStatus("오디오 준비 완료");
    } catch (err) {
      if (showStatus) onStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setAudioUnlocking(false);
    }
  }

  function onTouchButton(button: NesboxButton, pressed: boolean) {
    if (pressed) void unlockAudio(false);
    coreRef.current?.setButton(0, button, pressed);
  }

  const screenSize = screenSizeForSystem(screenSystem);

  return (
    <section
      ref={shellRef}
      className={`emulator-stage emulator-stage--system-${screenSystem} ${settings.integerScale ? "emulator-stage--integer" : ""}`}
      onPointerDown={() => void unlockAudio(false)}
    >
      <div className="screen-bezel">
        <canvas ref={canvasRef} className="game-canvas" width={screenSize.width} height={screenSize.height} />
        {audioPromptVisible && (
          <div className="audio-unlock">
            <button
              type="button"
              className="audio-unlock__button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => void unlockAudio()}
              disabled={audioUnlocking}
            >
              <Volume2 size={18} strokeWidth={1.8} aria-hidden />
              <span>{audioUnlocking ? "음소거 해제 중" : "탭하여 음소거 해제"}</span>
            </button>
          </div>
        )}
        {phase === "idle" && (
          <div className="stage-empty">
            <strong>Load ROM</strong>
            <span>NES 또는 SNES 파일을 브라우저에서 직접 실행합니다.</span>
          </div>
        )}
      </div>
      <TouchControls
        enabled={settings.touchControls}
        running={phase === "running"}
        onButton={onTouchButton}
        onRunToggle={toggleRun}
        onReset={reset}
        onSave={() => {
          saveState().catch((err) => onStatus(err instanceof Error ? err.message : String(err)));
        }}
      />
    </section>
  );
}
