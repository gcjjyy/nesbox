export interface CoreLoadFinalizerOptions {
  readSavedState: () => Promise<Uint8Array | null>;
  loadSavedState: (state: Uint8Array) => Promise<void>;
  isCurrent: () => boolean;
  dispose: () => void;
  start: () => void;
  onRestored: () => void;
  onRestoreError: (error: unknown) => void;
  onStarted: () => void;
}

export async function restoreAndStartCurrentCore(
  options: CoreLoadFinalizerOptions,
): Promise<"started" | "stale"> {
  let state: Uint8Array | null = null;
  try {
    state = await options.readSavedState();
  } catch (error) {
    if (!options.isCurrent()) return disposeStale(options);
    options.onRestoreError(error);
  }

  if (!options.isCurrent()) return disposeStale(options);
  if (state) {
    let restored = false;
    try {
      await options.loadSavedState(state);
      restored = true;
    } catch (error) {
      if (!options.isCurrent()) return disposeStale(options);
      options.onRestoreError(error);
    }

    if (!options.isCurrent()) return disposeStale(options);
    if (restored) options.onRestored();
  }

  if (!options.isCurrent()) return disposeStale(options);
  options.start();
  options.onStarted();
  return "started";
}

function disposeStale(options: CoreLoadFinalizerOptions): "stale" {
  options.dispose();
  return "stale";
}
