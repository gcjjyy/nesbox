import { describe, expect, it, vi } from "vitest";
import { restoreAndStartCurrentCore } from "./core-load-finalizer";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function makeFinalizer(loadStatePromise: Promise<void>) {
  let current = true;
  const statuses: string[] = [];
  const core = {
    dispose: vi.fn(),
    loadState: vi.fn(() => loadStatePromise),
    start: vi.fn(),
  };
  const finalization = restoreAndStartCurrentCore({
    readSavedState: async () => new Uint8Array([1, 2, 3]),
    loadSavedState: core.loadState,
    isCurrent: () => current,
    dispose: core.dispose,
    start: core.start,
    onRestored: () => statuses.push("restored"),
    onRestoreError: () => statuses.push("restore-error"),
    onStarted: () => statuses.push("started"),
  });
  return {
    core,
    finalization,
    invalidate: () => {
      current = false;
    },
    statuses,
  };
}

describe("restoreAndStartCurrentCore", () => {
  it("does not resurrect an old core when a new game loads during successful state restoration", async () => {
    const loadState = deferred<void>();
    const { core, finalization, invalidate, statuses } = makeFinalizer(loadState.promise);
    await vi.waitFor(() => expect(core.loadState).toHaveBeenCalledTimes(1));

    invalidate();
    loadState.resolve();

    await expect(finalization).resolves.toBe("stale");
    expect(core.dispose).toHaveBeenCalledTimes(1);
    expect(core.start).not.toHaveBeenCalled();
    expect(statuses).toEqual([]);
  });

  it("does not resurrect an old core when unmount happens before state restoration rejects", async () => {
    const loadState = deferred<void>();
    const { core, finalization, invalidate, statuses } = makeFinalizer(loadState.promise);
    await vi.waitFor(() => expect(core.loadState).toHaveBeenCalledTimes(1));

    invalidate();
    loadState.reject(new Error("bad state"));

    await expect(finalization).resolves.toBe("stale");
    expect(core.dispose).toHaveBeenCalledTimes(1);
    expect(core.start).not.toHaveBeenCalled();
    expect(statuses).toEqual([]);
  });

  it("starts the current core without claiming a rejected state was restored", async () => {
    const { core, finalization, statuses } = makeFinalizer(Promise.reject(new Error("bad state")));

    await expect(finalization).resolves.toBe("started");
    expect(core.dispose).not.toHaveBeenCalled();
    expect(core.start).toHaveBeenCalledTimes(1);
    expect(statuses).toEqual(["restore-error", "started"]);
  });
});
