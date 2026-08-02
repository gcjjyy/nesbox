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
    return { kind: "unlock-failed", error };
  }
  if (!unlocked) return { kind: "unlock-failed" };
  if (!options.isCurrent()) return { kind: "stale" };

  try {
    const reloaded = await options.reload();
    if (reloaded === "stale") return { kind: "stale" };
    return reloaded ? { kind: "recovered" } : { kind: "retry-failed" };
  } catch (error) {
    return { kind: "retry-failed", error };
  }
}
