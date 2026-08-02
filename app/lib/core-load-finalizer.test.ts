import { describe, expect, it, vi } from "vitest";
import { loadAssignedCore, type AssignedCoreLoadResult } from "./core-load-finalizer";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function makeLoad(overrides: Partial<Parameters<typeof loadAssignedCore>[0]> = {}) {
  let current = true;
  const statuses: string[] = [];
  const core = {
    dispose: vi.fn(),
    loadRom: vi.fn(async () => undefined),
    loadState: vi.fn(async () => undefined),
    start: vi.fn(),
  };
  let phase = "loading-core";
  let running = false;
  let assignedCore: typeof core | null = core;
  const options: Parameters<typeof loadAssignedCore>[0] = {
    prepare: vi.fn(),
    fetchRom: async () => new Uint8Array([7, 8]),
    loadRom: core.loadRom,
    readSavedState: async () => new Uint8Array([1, 2, 3]),
    loadSavedState: core.loadState,
    isCurrent: () => current && assignedCore === core,
    dispose: () => {
      if (assignedCore === core) assignedCore = null;
      core.dispose();
    },
    start: core.start,
    onRomLoaded: () => statuses.push("rom-loaded"),
    onRestored: () => statuses.push("restored"),
    onStarted: () => {
      phase = "running";
      running = true;
      statuses.push("started");
    },
    onFailure: (error) => {
      phase = "error";
      running = false;
      statuses.push(error instanceof Error ? error.message : String(error));
    },
    ...overrides,
  };
  const loading = loadAssignedCore(options);
  return {
    core,
    invalidate: () => {
      current = false;
    },
    loading,
    hasAssignedCore: () => assignedCore === core,
    phase: () => phase,
    running: () => running,
    statuses,
  };
}

async function expectCurrentFailure(
  stage: "prepare" | "fetchRom" | "loadRom" | "readSavedState" | "loadSavedState" | "start",
) {
  const error = new Error(`${stage} failed`);
  const overrides: Partial<Parameters<typeof loadAssignedCore>[0]> = {};
  if (stage === "prepare") overrides.prepare = () => { throw error; };
  if (stage === "fetchRom") overrides.fetchRom = async () => { throw error; };
  if (stage === "loadRom") overrides.loadRom = async () => { throw error; };
  if (stage === "readSavedState") overrides.readSavedState = async () => { throw error; };
  if (stage === "loadSavedState") overrides.loadSavedState = async () => { throw error; };
  const failingStart = stage === "start" ? vi.fn(() => { throw error; }) : null;
  if (failingStart) overrides.start = failingStart;
  const load = makeLoad(overrides);

  await expect(load.loading).resolves.toEqual({ kind: "failed", error } satisfies AssignedCoreLoadResult);
  expect(load.core.dispose).toHaveBeenCalledTimes(1);
  expect(load.hasAssignedCore()).toBe(false);
  expect(load.phase()).toBe("error");
  expect(load.running()).toBe(false);
  expect(load.statuses.at(-1)).toBe(error.message);
  expect(load.core.start).not.toHaveBeenCalled();
  if (failingStart) expect(failingStart).toHaveBeenCalledTimes(1);
}

describe("loadAssignedCore", () => {
  it("does not resurrect an old core when a new game loads during successful state restoration", async () => {
    const loadState = deferred<void>();
    const loadSavedState = vi.fn(() => loadState.promise);
    const load = makeLoad({ loadSavedState });
    await vi.waitFor(() => expect(loadSavedState).toHaveBeenCalledTimes(1));

    load.invalidate();
    loadState.resolve();

    await expect(load.loading).resolves.toEqual({ kind: "stale" });
    expect(load.core.dispose).toHaveBeenCalledTimes(1);
    expect(load.core.start).not.toHaveBeenCalled();
    expect(load.statuses).toEqual(["rom-loaded"]);
  });

  it("does not report a failure when unmount happens before state restoration rejects", async () => {
    const loadState = deferred<void>();
    const loadSavedState = vi.fn(() => loadState.promise);
    const load = makeLoad({ loadSavedState });
    await vi.waitFor(() => expect(loadSavedState).toHaveBeenCalledTimes(1));

    load.invalidate();
    loadState.reject(new Error("bad state"));

    await expect(load.loading).resolves.toEqual({ kind: "stale" });
    expect(load.core.dispose).toHaveBeenCalledTimes(1);
    expect(load.core.start).not.toHaveBeenCalled();
    expect(load.phase()).toBe("loading-core");
    expect(load.statuses).toEqual(["rom-loaded"]);
  });

  it.each(["prepare", "fetchRom", "loadRom", "readSavedState", "loadSavedState", "start"] as const)(
    "disposes and reports a current-generation %s failure",
    expectCurrentFailure,
  );

  it("silently disposes a stale fetch rejection", async () => {
    const fetchRom = deferred<Uint8Array>();
    const load = makeLoad({ fetchRom: () => fetchRom.promise });
    load.invalidate();
    fetchRom.reject(new Error("late fetch failure"));

    await expect(load.loading).resolves.toEqual({ kind: "stale" });
    expect(load.core.dispose).toHaveBeenCalledTimes(1);
    expect(load.phase()).toBe("loading-core");
    expect(load.running()).toBe(false);
    expect(load.statuses).toEqual([]);
  });

  it("still reports the original current failure when disposal itself throws", async () => {
    const loadError = new Error("ROM load failed");
    const disposeError = new Error("dispose failed");
    const dispose = vi.fn(() => { throw disposeError; });
    const load = makeLoad({
      dispose,
      loadRom: async () => { throw loadError; },
    });

    await expect(load.loading).resolves.toEqual({ kind: "failed", error: loadError });
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(load.phase()).toBe("error");
    expect(load.running()).toBe(false);
    expect(load.statuses.at(-1)).toBe(loadError.message);
  });

  it("keeps stale failure handling silent when disposal itself throws", async () => {
    const fetchRom = deferred<Uint8Array>();
    const dispose = vi.fn(() => { throw new Error("dispose failed"); });
    const load = makeLoad({ dispose, fetchRom: () => fetchRom.promise });
    load.invalidate();
    fetchRom.reject(new Error("late fetch failure"));

    await expect(load.loading).resolves.toEqual({ kind: "stale" });
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(load.phase()).toBe("loading-core");
    expect(load.statuses).toEqual([]);
  });

  it("starts only after the ROM and saved state finish for the current generation", async () => {
    const load = makeLoad();

    await expect(load.loading).resolves.toEqual({ kind: "started" });
    expect(load.core.dispose).not.toHaveBeenCalled();
    expect(load.core.start).toHaveBeenCalledTimes(1);
    expect(load.phase()).toBe("running");
    expect(load.running()).toBe(true);
    expect(load.statuses).toEqual(["rom-loaded", "restored", "started"]);
  });
});
