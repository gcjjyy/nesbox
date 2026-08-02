export type AudioSessionState =
  | "locked"
  | "running"
  | "suspended"
  | "interrupted"
  | "closed"
  | "unavailable";

type AudioContextConstructor = new () => AudioContext;

function createBrowserAudioContext(): AudioContext {
  const browser = globalThis as typeof globalThis & {
    webkitAudioContext?: AudioContextConstructor;
  };
  const Constructor = browser.AudioContext ?? browser.webkitAudioContext;

  if (!Constructor) {
    throw new Error("Web Audio is unavailable");
  }

  return new Constructor();
}

export class AudioSession {
  private context: AudioContext | undefined;
  private explicitlyUnlocked = false;
  private unlocking = false;
  private snapshot: AudioSessionState = "locked";
  private readonly listeners = new Set<() => void>();

  constructor(private readonly createContext: () => AudioContext = createBrowserAudioContext) {}

  getContext(): AudioContext {
    if (this.context) return this.context;

    try {
      this.context = this.createContext();
    } catch (error) {
      this.setSnapshot("unavailable");
      throw error;
    }

    this.context.addEventListener("statechange", this.handleStateChange);
    this.enforceExplicitUnlock();
    return this.context;
  }

  async unlock(): Promise<boolean> {
    const context = this.getContext();
    this.unlocking = true;

    try {
      await context.resume();
      if (context.state !== "running") return false;

      this.explicitlyUnlocked = true;
      this.setSnapshot("running");
      return true;
    } catch {
      this.setSnapshot(this.stateFromContext());
      return false;
    } finally {
      this.unlocking = false;
    }
  }

  getSnapshot = (): AudioSessionState => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private handleStateChange = (): void => {
    this.enforceExplicitUnlock();
    this.setSnapshot(this.stateFromContext());
  };

  private enforceExplicitUnlock(): void {
    if (!this.context || this.explicitlyUnlocked || this.unlocking || this.context.state !== "running") {
      return;
    }

    void this.context.suspend();
  }

  private stateFromContext(): AudioSessionState {
    if (!this.context || !this.explicitlyUnlocked) return "locked";

    switch (this.context.state as AudioSessionState) {
      case "running":
      case "suspended":
      case "interrupted":
      case "closed":
        return this.context.state as AudioSessionState;
      default:
        return "locked";
    }
  }

  private setSnapshot(snapshot: AudioSessionState): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}

export const audioSession = new AudioSession();

export function audioPromptRequired(engineReady: boolean, state: AudioSessionState): boolean {
  return engineReady && state !== "running";
}
