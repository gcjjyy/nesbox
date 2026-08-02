import { useSyncExternalStore } from "react";
import { audioSession, type AudioSessionState } from "./audio-session";

export function useAudioSessionState(): AudioSessionState {
  return useSyncExternalStore(audioSession.subscribe, audioSession.getSnapshot, () => "locked");
}
