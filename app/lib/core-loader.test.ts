import { afterEach, describe, expect, it, vi } from "vitest";
import { audioSession } from "./audio-session";
import type { NesboxCore, NesboxCoreFactory } from "./core-contract";
import { createCore } from "./core-loader";

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
});
