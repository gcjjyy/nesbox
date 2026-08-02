export type AudioCoreRecoveryResult =
  | { kind: "unlock-failed"; error?: unknown }
  | { kind: "stale" }
  | { kind: "recovered" }
  | { kind: "retry-failed"; error?: unknown };

export interface AudioCoreRecoveryOptions {
  unlock: () => Promise<boolean>;
  isCurrent: () => boolean;
  reload: () => Promise<boolean | "stale">;
}

export async function recoverAudioCore(
  options: AudioCoreRecoveryOptions,
): Promise<AudioCoreRecoveryResult> {
  let unlocked: boolean;
  try {
    unlocked = await options.unlock();
  } catch (error) {
    return options.isCurrent() ? { kind: "unlock-failed", error } : { kind: "stale" };
  }
  if (!options.isCurrent()) return { kind: "stale" };
  if (!unlocked) return { kind: "unlock-failed" };

  try {
    const reloaded = await options.reload();
    if (!options.isCurrent()) return { kind: "stale" };
    if (reloaded === "stale") return { kind: "stale" };
    return reloaded ? { kind: "recovered" } : { kind: "retry-failed" };
  } catch (error) {
    return options.isCurrent() ? { kind: "retry-failed", error } : { kind: "stale" };
  }
}
