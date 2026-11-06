let reserved: AudioContext | undefined;

function createContext(): AudioContext | undefined {
  const browser = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const Constructor = browser.AudioContext ?? browser.webkitAudioContext;
  try { return Constructor ? new Constructor() : undefined; } catch { return undefined; }
}

/** Must run in the game click, before navigation/download awaits consume Safari's activation. */
export function prepareArcadeAudio(): void {
  if (reserved) void reserved.close().catch(() => undefined);
  reserved = createContext();
  if (reserved) void reserved.resume().catch(() => undefined);
}

export function takeArcadeAudio(): AudioContext | undefined {
  const context = reserved ?? createContext();
  reserved = undefined;
  return context;
}
