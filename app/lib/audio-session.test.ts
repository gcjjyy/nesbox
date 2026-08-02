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

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("AudioSession", () => {
  it("does not prompt before an engine is ready", () => {
    expect(audioPromptRequired(false, "locked")).toBe(false);
    expect(audioPromptRequired(false, "suspended")).toBe(false);
  });

  it("stays locked when code only acquires the context", async () => {
    const { context, session } = makeSession();
    await expect(session.getContext()).resolves.toBe(context);
    expect(context.resume).not.toHaveBeenCalled();
    expect(session.getSnapshot()).toBe("locked");
    expect(audioPromptRequired(true, session.getSnapshot())).toBe(true);
  });

  it("does not release or unlock an auto-running context until its delayed suspension completes", async () => {
    const { context, session } = makeSession();
    const suspension = deferred<void>();
    context.state = "running";
    context.suspend.mockImplementationOnce(async () => {
      await suspension.promise;
      context.state = "suspended";
      context.dispatchEvent(new Event("statechange"));
    });

    let contextReleased = false;
    const contextPromise = session.getContext().then((preparedContext) => {
      contextReleased = true;
      return preparedContext;
    });
    const unlockPromise = session.unlock();

    await Promise.resolve();
    expect(context.suspend).toHaveBeenCalledTimes(1);
    expect(contextReleased).toBe(false);
    expect(context.resume).not.toHaveBeenCalled();
    expect(session.getSnapshot()).toBe("unavailable");

    suspension.resolve();
    await expect(contextPromise).resolves.toBe(context);
    await expect(unlockPromise).resolves.toBe(true);
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot()).toBe("running");
  });

  it("rejects failed preparation without reporting a running context as locked", async () => {
    const { context, session } = makeSession();
    const suspensionError = new Error("suspend blocked");
    context.state = "running";
    context.suspend.mockRejectedValueOnce(suspensionError);

    await expect(session.getContext()).rejects.toBe(suspensionError);
    expect(context.state).toBe("running");
    expect(session.getSnapshot()).toBe("unavailable");
    expect(audioPromptRequired(true, session.getSnapshot())).toBe(true);
  });

  it("lets the explicit unlock recover after automatic suspension is rejected", async () => {
    const { context, session } = makeSession();
    context.state = "running";
    context.suspend.mockRejectedValueOnce(new Error("suspend blocked"));

    await expect(session.getContext()).rejects.toThrow("suspend blocked");
    await expect(session.unlock()).resolves.toBe(true);
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot()).toBe("running");
    await expect(session.getContext()).resolves.toBe(context);
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

  it("preserves suspension after a rejected retry following explicit unlock", async () => {
    const { context, session } = makeSession();
    await session.unlock();
    context.state = "suspended";
    context.dispatchEvent(new Event("statechange"));
    context.resumeError = new Error("blocked");

    await expect(session.unlock()).resolves.toBe(false);
    expect(session.getSnapshot()).toBe("suspended");
  });

  it("reuses the same context across consumers and emits later suspension", async () => {
    const { context, session } = makeSession();
    const states: string[] = [];
    session.subscribe(() => states.push(session.getSnapshot()));
    await session.unlock();
    context.state = "suspended";
    context.dispatchEvent(new Event("statechange"));
    await expect(session.getContext()).resolves.toBe(context);
    expect(states.at(-1)).toBe("suspended");
    expect(audioPromptRequired(true, session.getSnapshot())).toBe(true);
  });
});
