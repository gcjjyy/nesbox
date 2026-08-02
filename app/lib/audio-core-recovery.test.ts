import { describe, expect, it, vi } from "vitest";
import { recoverAudioCore } from "./audio-core-recovery";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
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
});
