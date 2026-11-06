export interface AssignedCoreLoadOptions {
  prepare: () => void;
  fetchRom: () => Promise<Uint8Array>;
  loadRom: (rom: Uint8Array) => Promise<void>;
  isCurrent: () => boolean;
  dispose: () => void;
  start: () => Promise<void> | void;
  onRomLoaded: () => void;
  onStarted: () => void;
  onFailure: (error: unknown) => void;
  autoStart?: boolean;
}

export type AssignedCoreLoadResult =
  | { kind: "started" }
  | { kind: "ready"; start: () => Promise<AssignedCoreStartResult> }
  | { kind: "stale" }
  | { kind: "failed"; error: unknown };

export type AssignedCoreStartResult = Exclude<AssignedCoreLoadResult, { kind: "ready" }>;

export async function loadAssignedCore(options: AssignedCoreLoadOptions): Promise<AssignedCoreLoadResult> {
  try {
    options.prepare();
    const rom = await options.fetchRom();
    if (!options.isCurrent()) return disposeStale(options);

    await options.loadRom(rom);
    if (!options.isCurrent()) return disposeStale(options);
    options.onRomLoaded();

    if (options.autoStart === false) {
      let startResult: Promise<AssignedCoreStartResult> | null = null;
      return {
        kind: "ready",
        start: () => {
          startResult ??= startAssignedCore(options);
          return startResult;
        },
      };
    }

    // 저장 상태는 자동으로 복원하지 않는다. 불러오기 버튼으로만 되돌린다.
    return await startAssignedCore(options);
  } catch (error) {
    if (!options.isCurrent()) return disposeStale(options);
    attemptDispose(options);
    options.onFailure(error);
    return { kind: "failed", error };
  }
}

async function startAssignedCore(options: AssignedCoreLoadOptions): Promise<AssignedCoreStartResult> {
  if (!options.isCurrent()) return disposeStale(options);
  try {
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

function disposeStale(options: Pick<AssignedCoreLoadOptions, "dispose">): AssignedCoreStartResult {
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
