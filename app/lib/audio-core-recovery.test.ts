import { describe, expect, it, vi } from "vitest";
import { recoverAudioCore } from "./audio-core-recovery";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("recoverAudioCore", () => {
  it("does not reload a core when the game generation changes during unlock", async () => {
    const unlock = deferred<boolean>();
    const reload = vi.fn(async () => true);
    let current = true;
    const recovery = recoverAudioCore({
      unlock: () => unlock.promise,
      isCurrent: () => current,
      reload,
    });

    current = false;
    unlock.resolve(true);

    await expect(recovery).resolves.toEqual({ kind: "stale" });
    expect(reload).not.toHaveBeenCalled();
  });

  it("keeps a failed unlock distinct from a failed core retry", async () => {
    await expect(recoverAudioCore({
      unlock: async () => false,
      isCurrent: () => true,
      reload: async () => true,
    })).resolves.toEqual({ kind: "unlock-failed" });

    await expect(recoverAudioCore({
      unlock: async () => true,
      isCurrent: () => true,
      reload: async () => false,
    })).resolves.toEqual({ kind: "retry-failed" });
  });

  it("preserves a stale result when the game changes during the reload", async () => {
    await expect(recoverAudioCore({
      unlock: async () => true,
      isCurrent: () => true,
      reload: async () => "stale",
    })).resolves.toEqual({ kind: "stale" });
  });

  it("does not publish an unlock failure after the recovery is externally invalidated", async () => {
    const unlock = deferred<boolean>();
    let current = true;
    const recovery = recoverAudioCore({
      unlock: () => unlock.promise,
      isCurrent: () => current,
      reload: async () => true,
    });

    current = false;
    unlock.reject(new Error("blocked"));

    await expect(recovery).resolves.toEqual({ kind: "stale" });
  });

  it("does not publish a retry failure when reload rejects after external invalidation", async () => {
    const reload = deferred<boolean>();
    const reloadCore = vi.fn(() => reload.promise);
    let current = true;
    const recovery = recoverAudioCore({
      unlock: async () => true,
      isCurrent: () => current,
      reload: reloadCore,
    });
    await vi.waitFor(() => expect(reloadCore).toHaveBeenCalledTimes(1));

    current = false;
    reload.reject(new Error("ROM load failed"));

    await expect(recovery).resolves.toEqual({ kind: "stale" });
  });
});
