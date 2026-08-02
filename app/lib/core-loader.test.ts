import { afterEach, describe, expect, it, vi } from "vitest";
import { recoverAudioCore } from "./audio-core-recovery";
import { audioSession } from "./audio-session";
import type { NesboxCore, NesboxCoreFactory } from "./core-contract";
import { AudioContextPreparationError, createCore } from "./core-loader";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("createCore", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not hand the audio context to the core factory before preparation completes", async () => {
    const preparation = deferred<AudioContext>();
    const preparedContext = { state: "suspended" } as AudioContext;
    const core = {} as NesboxCore;
    const factory = vi.fn<NesboxCoreFactory>(async () => core);
    const existingScript = {
      addEventListener: (type: string, listener: () => void) => {
        if (type === "load") queueMicrotask(listener);
      },
    };
    vi.stubGlobal("window", { createNesboxFceuxCore: factory });
    vi.stubGlobal("document", {
      querySelector: vi.fn(() => existingScript),
    });
    vi.spyOn(audioSession, "getContext").mockReturnValue(preparation.promise);

    const corePromise = createCore("fceux", {} as HTMLCanvasElement);
    await vi.waitFor(() => expect(audioSession.getContext).toHaveBeenCalledTimes(1));
    expect(factory).not.toHaveBeenCalled();

    preparation.resolve(preparedContext);
    await expect(corePromise).resolves.toBe(core);
    expect(factory).toHaveBeenCalledWith(expect.objectContaining({ audioContext: preparedContext }));
  });

  it("replaces the placeholder with a real core after explicit unlock recovers preparation", async () => {
    const preparationError = new Error("suspend blocked");
    const recoveredContext = { state: "running" } as AudioContext;
    const placeholder = { dispose: vi.fn() } as unknown as NesboxCore;
    const realCore = { dispose: vi.fn() } as unknown as NesboxCore;
    let activeCore = placeholder;
    const factory = vi.fn<NesboxCoreFactory>(async () => realCore);
    const existingScript = {
      addEventListener: (type: string, listener: () => void) => {
        if (type === "load") queueMicrotask(listener);
      },
    };
    vi.stubGlobal("window", { createNesboxFceuxCore: factory });
    vi.stubGlobal("document", {
      querySelector: vi.fn(() => existingScript),
    });
    vi.spyOn(audioSession, "getContext")
      .mockRejectedValueOnce(preparationError)
      .mockResolvedValueOnce(recoveredContext);

    await expect(createCore("fceux", {} as HTMLCanvasElement)).rejects.toBeInstanceOf(
      AudioContextPreparationError,
    );
    expect(factory).not.toHaveBeenCalled();

    const result = await recoverAudioCore({
      unlock: async () => true,
      isCurrent: () => true,
      reload: async () => {
        activeCore.dispose();
        activeCore = await createCore("fceux", {} as HTMLCanvasElement);
        return true;
      },
    });

    expect(result).toEqual({ kind: "recovered" });
    expect(placeholder.dispose).toHaveBeenCalledTimes(1);
    expect(activeCore).toBe(realCore);
    expect(factory).toHaveBeenCalledWith(expect.objectContaining({ audioContext: recoveredContext }));
  });
});
