import type { KeyValueStorage } from "./recent-plays";

export const WELCOME_KEY = "nesbox:welcomed";

export function needsWelcome(storage: Pick<KeyValueStorage, "getItem"> | undefined): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(WELCOME_KEY) === null;
  } catch {
    return false;
  }
}

export function markWelcomed(storage: KeyValueStorage | undefined): void {
  try {
    storage?.setItem(WELCOME_KEY, "1");
  } catch {
    // 저장소를 못 쓰면 다음 방문에 다시 보여 줄 뿐이다.
  }
}
