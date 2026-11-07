import type { NesboxButton } from "./core-contract";

export function createInputMixer(send: (button: NesboxButton, pressed: boolean) => void) {
  const owners = new Map<NesboxButton, Set<string>>();
  return {
    set(source: "keyboard" | "gamepad" | "touch", button: NesboxButton, pressed: boolean) {
      const sources = owners.get(button) ?? new Set<string>();
      const wasPressed = sources.size > 0;
      if (pressed) sources.add(source);
      else sources.delete(source);
      if (sources.size) owners.set(button, sources);
      else owners.delete(button);
      if (wasPressed !== (sources.size > 0)) send(button, sources.size > 0);
    },
    releaseAll() {
      for (const button of owners.keys()) send(button, false);
      owners.clear();
    },
  };
}
