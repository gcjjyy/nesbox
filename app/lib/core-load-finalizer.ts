export interface AssignedCoreLoadOptions {
  prepare: () => void;
  fetchRom: () => Promise<Uint8Array>;
  loadRom: (rom: Uint8Array) => Promise<void>;
  readSavedState: () => Promise<Uint8Array | null>;
  loadSavedState: (state: Uint8Array) => Promise<void>;
  isCurrent: () => boolean;
  dispose: () => void;
  start: () => Promise<void> | void;
  onRomLoaded: () => void;
  onRestored: () => void;
  onStarted: () => void;
  onFailure: (error: unknown) => void;
}

export type AssignedCoreLoadResult =
  | { kind: "started" }
  | { kind: "stale" }
  | { kind: "failed"; error: unknown };

export async function loadAssignedCore(options: AssignedCoreLoadOptions): Promise<AssignedCoreLoadResult> {
  try {
    options.prepare();
    const rom = await options.fetchRom();
    if (!options.isCurrent()) return disposeStale(options);

    await options.loadRom(rom);
    if (!options.isCurrent()) return disposeStale(options);
    options.onRomLoaded();

    const state = await options.readSavedState();
    if (!options.isCurrent()) return disposeStale(options);
    if (state) {
      await options.loadSavedState(state);
      if (!options.isCurrent()) return disposeStale(options);
      options.onRestored();
    }

    if (!options.isCurrent()) return disposeStale(options);
    await options.start();
    if (!options.isCurrent()) return disposeStale(options);
    options.onStarted();
    return { kind: "started" };
  } catch (error) {
    if (!options.isCurrent()) return disposeStale(options);
    attemptDispose(options);
    options.onFailure(error);
    return { kind: "failed", error };
  }
}

function disposeStale(options: Pick<AssignedCoreLoadOptions, "dispose">): AssignedCoreLoadResult {
  attemptDispose(options);
  return { kind: "stale" };
}

function attemptDispose(options: Pick<AssignedCoreLoadOptions, "dispose">) {
  try {
    options.dispose();
  } catch {
    // Loading failures must still reach the current/stale state policy if a partial core resists cleanup.
  }
}
