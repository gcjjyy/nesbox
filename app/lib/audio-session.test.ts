import { describe, expect, it, vi } from "vitest";
import { AudioSession, audioPromptRequired } from "./audio-session";

class FakeAudioContext extends EventTarget {
  state: AudioContextState = "suspended";
  resumeError: Error | null = null;
  resume = vi.fn(async () => {
    if (this.resumeError) throw this.resumeError;
    this.state = "running";
    this.dispatchEvent(new Event("statechange"));
  });
  suspend = vi.fn(async () => {
    this.state = "suspended";
    this.dispatchEvent(new Event("statechange"));
  });
}

function makeSession() {
  const context = new FakeAudioContext();
  const session = new AudioSession(() => context as unknown as AudioContext);
  return { context, session };
}

describe("AudioSession", () => {
  it("stays locked when code only acquires the context", () => {
    const { context, session } = makeSession();
    expect(session.getContext()).toBe(context);
    expect(context.resume).not.toHaveBeenCalled();
    expect(session.getSnapshot()).toBe("locked");
    expect(audioPromptRequired(true, session.getSnapshot())).toBe(true);
  });

  it("suspends a context that auto-runs before explicit unlock", async () => {
    const { context, session } = makeSession();
    context.state = "running";
    session.getContext();
    await Promise.resolve();
    expect(context.suspend).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot()).toBe("locked");
  });

  it("reports running only after the explicit unlock succeeds", async () => {
    const { context, session } = makeSession();
    await expect(session.unlock()).resolves.toBe(true);
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot()).toBe("running");
    expect(audioPromptRequired(true, session.getSnapshot())).toBe(false);
  });

  it("remains locked after a rejected initial unlock", async () => {
    const { context, session } = makeSession();
    context.resumeError = new Error("blocked");
    await expect(session.unlock()).resolves.toBe(false);
    expect(session.getSnapshot()).toBe("locked");
  });

  it("reuses the same context across consumers and emits later suspension", async () => {
    const { context, session } = makeSession();
    const states: string[] = [];
    session.subscribe(() => states.push(session.getSnapshot()));
    await session.unlock();
    context.state = "suspended";
    context.dispatchEvent(new Event("statechange"));
    expect(session.getContext()).toBe(context);
    expect(states.at(-1)).toBe("suspended");
    expect(audioPromptRequired(true, session.getSnapshot())).toBe(true);
  });
});
