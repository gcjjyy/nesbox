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
  private preparation: Promise<AudioContext> | undefined;
  private explicitlyUnlocked = false;
  private preparing = false;
  private resumePending = false;
  private unlockPromise: Promise<boolean> | undefined;
  private snapshot: AudioSessionState = "locked";
  private readonly listeners = new Set<() => void>();

  constructor(private readonly createContext: () => AudioContext = createBrowserAudioContext) {}

  getContext(): Promise<AudioContext> {
    if (!this.preparation) this.preparation = this.prepareContext();
    return this.preparation;
  }

  async unlock(): Promise<boolean> {
    if (this.unlockPromise) return this.unlockPromise;

    const unlockPromise = this.performUnlock();
    this.unlockPromise = unlockPromise;
    try {
      return await unlockPromise;
    } finally {
      if (this.unlockPromise === unlockPromise) this.unlockPromise = undefined;
    }
  }

  getSnapshot = (): AudioSessionState => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private ensureContext(): AudioContext {
    if (this.context) return this.context;

    try {
      this.context = this.createContext();
    } catch (error) {
      this.setSnapshot("unavailable");
      throw error;
    }

    this.context.addEventListener("statechange", this.handleStateChange);
    return this.context;
  }

  private async prepareContext(): Promise<AudioContext> {
    const context = this.ensureContext();
    this.preparing = true;

    try {
      if (!this.explicitlyUnlocked && context.state === "running") {
        this.setSnapshot("unavailable");
        await context.suspend();
        if (context.state === "running") {
          throw new Error("Audio context remained running after suspension");
        }
      }

      this.setSnapshot(this.stateFromContext());
      return context;
    } catch (error) {
      this.setSnapshot(this.stateFromContext());
      throw error;
    } finally {
      this.preparing = false;
    }
  }

  private async performUnlock(): Promise<boolean> {
    let context: AudioContext;
    try {
      context = await this.getContext();
    } catch {
      if (!this.context) return false;
      context = this.context;
    }

    this.resumePending = true;
    try {
      await context.resume();
      if (context.state !== "running") {
        this.setSnapshot(this.stateFromContext());
        return false;
      }

      this.explicitlyUnlocked = true;
      this.preparation = Promise.resolve(context);
      this.setSnapshot("running");
      return true;
    } catch {
      this.setSnapshot(this.stateFromContext());
      return false;
    } finally {
      this.resumePending = false;
    }
  }

  private handleStateChange = (): void => {
    if (
      this.context &&
      !this.explicitlyUnlocked &&
      !this.resumePending &&
      this.context.state === "running"
    ) {
      this.setSnapshot("unavailable");
      if (!this.preparing) {
        this.preparation = undefined;
        void this.getContext().catch(() => undefined);
      }
      return;
    }

    if (
      this.context &&
      !this.explicitlyUnlocked &&
      !this.preparing &&
      this.context.state !== "running"
    ) {
      this.preparation = undefined;
    }
    this.setSnapshot(this.stateFromContext());
  };

  private stateFromContext(): AudioSessionState {
    if (!this.context) return this.snapshot === "unavailable" ? "unavailable" : "locked";
    if (!this.explicitlyUnlocked) return this.context.state === "running" ? "unavailable" : "locked";

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
