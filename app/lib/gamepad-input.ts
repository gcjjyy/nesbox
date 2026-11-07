import type { NesboxButton } from "./core-contract";
import { controlBindingRows, gamepadMapForProfile, type ControlProfileId } from "./control-profiles";

export type GamepadDevice = Pick<Gamepad, "id" | "index" | "connected" | "axes"> & {
  mapping: string;
  buttons: readonly Pick<GamepadButton, "pressed" | "value">[];
};
export type GamepadBinding =
  | { kind: "button"; index: number }
  | { kind: "axis"; index: number; direction: -1 | 1 }
  | { kind: "hat"; index: number; direction: number };
type GamepadBindings = Partial<Record<NesboxButton, GamepadBinding[]>>;
export interface GamepadSettings {
  selectedDevice: string | null;
  devices: Record<string, Partial<Record<ControlProfileId, GamepadBindings>>>;
}

const AXIS_THRESHOLD = 0.45;

// The same device may expose different indices in standard and raw modes.
export function gamepadDeviceKey(device: Pick<GamepadDevice, "id" | "mapping">): string {
  return JSON.stringify([device.id, device.mapping]);
}

export function readConnectedGamepads(
  source: { getGamepads?: () => readonly (GamepadDevice | null)[] } = typeof navigator === "undefined" ? {} : navigator,
): { devices: GamepadDevice[]; error: "unsupported" | "blocked" | null } {
  if (!source.getGamepads) return { devices: [], error: "unsupported" };
  try {
    return { devices: Array.from(source.getGamepads()).filter((pad): pad is GamepadDevice => Boolean(pad?.connected)), error: null };
  } catch {
    return { devices: [], error: "blocked" };
  }
}

export function selectGamepad(devices: GamepadDevice[], selectedDevice: string | null): GamepadDevice | null {
  return devices.find((device) => !selectedDevice || gamepadDeviceKey(device) === selectedDevice) ?? null;
}

export function bindingsForGamepad(device: GamepadDevice, profile: ControlProfileId, settings?: GamepadSettings): GamepadBindings {
  const bindings: GamepadBindings = {};
  for (const [index, button] of gamepadMapForProfile(profile)) bindings[button] = [{ kind: "button", index }];
  for (const [button, index, direction] of [["left", 0, -1], ["right", 0, 1], ["up", 1, -1], ["down", 1, 1]] as const) {
    bindings[button]!.push({ kind: "axis", index, direction });
  }
  return { ...bindings, ...settings?.devices[gamepadDeviceKey(device)]?.[profile] };
}

export function readGamepadButtons(device: GamepadDevice, profile: ControlProfileId, settings?: GamepadSettings): Set<NesboxButton> {
  const pressed = new Set<NesboxButton>();
  if (!device.connected) return pressed;
  const bindings = bindingsForGamepad(device, profile, settings);
  for (const { button } of controlBindingRows(profile)) {
    if (bindings[button]?.some((binding) => bindingPressed(device, binding))) pressed.add(button);
  }
  return pressed;
}

function bindingPressed(device: GamepadDevice, binding: GamepadBinding): boolean {
  if (binding.kind === "button") {
    const button = device.buttons[binding.index];
    return Boolean(button && (button.pressed || button.value > 0.5));
  }
  const value = device.axes[binding.index];
  if (binding.kind === "hat") {
    if (!Number.isFinite(value) || Math.abs(value) > 1) return false;
    const direction = Math.round((value + 1) * 3.5);
    const distance = Math.abs(direction - binding.direction);
    // Cardinal hat bindings also activate in their adjacent diagonal sectors.
    return distance === 0 || (binding.direction % 2 === 0 && (distance === 1 || distance === 7));
  }
  return Number.isFinite(value) && Math.abs(value) <= 1 && value * binding.direction > AXIS_THRESHOLD;
}

function activeBindings(device: GamepadDevice, hatAxes = new Set<number>()): GamepadBinding[] {
  const bindings: GamepadBinding[] = [];
  device.buttons.forEach((_, index) => {
    const binding = { kind: "button", index } as const;
    if (bindingPressed(device, binding)) bindings.push(binding);
  });
  device.axes.forEach((value, index) => {
    if (hatAxes.has(index) && Number.isFinite(value) && Math.abs(value) <= 1) {
      bindings.push({ kind: "hat", index, direction: Math.round((value + 1) * 3.5) });
    } else if (!hatAxes.has(index) && Number.isFinite(value) && Math.abs(value) > 0.65 && Math.abs(value) <= 1) {
      bindings.push({ kind: "axis", index, direction: value < 0 ? -1 : 1 });
    }
  });
  return bindings;
}

export function createGamepadCapture(initial: GamepadDevice): (device: GamepadDevice) => GamepadBinding | null {
  // Raw USB POV hats commonly report a neutral value above the axis range.
  const hatAxes = new Set(initial.axes.flatMap((value, index) => Number.isFinite(value) && Math.abs(value) > 1 ? [index] : []));
  const blocked = new Set(activeBindings(initial, hatAxes).map(bindingKey));
  return (device) => {
    if (!device.connected || device.index !== initial.index || gamepadDeviceKey(device) !== gamepadDeviceKey(initial)) return null;
    device.axes.forEach((value, index) => {
      if (Number.isFinite(value) && Math.abs(value) > 1) hatAxes.add(index);
    });
    const active = activeBindings(device, hatAxes);
    const keys = new Set(active.map(bindingKey));
    for (const key of blocked) if (!keys.has(key)) blocked.delete(key);
    return active.find((binding) => !blocked.has(bindingKey(binding))) ?? null;
  };
}

export function assignGamepadBinding(settings: GamepadSettings, device: GamepadDevice, profile: ControlProfileId, button: NesboxButton, binding: GamepadBinding): GamepadSettings {
  const key = gamepadDeviceKey(device);
  const bindings = bindingsForGamepad(device, profile, settings);
  for (const { button: other } of controlBindingRows(profile)) {
    bindings[other] = (bindings[other] ?? []).filter((item) => bindingKey(item) !== bindingKey(binding));
  }
  bindings[button] = [binding];
  return { ...settings, devices: { ...settings.devices, [key]: { ...settings.devices[key], [profile]: bindings } } };
}

export function gamepadBindingLabel(binding: GamepadBinding): string {
  if (binding.kind === "hat") return `방향축 ${binding.index + 1} ${["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"][binding.direction]}`;
  return binding.kind === "button" ? `버튼 ${binding.index + 1}` : `축 ${binding.index + 1} ${binding.direction < 0 ? "−" : "+"}`;
}

function bindingKey(binding: GamepadBinding): string {
  return `${binding.kind}:${binding.index}:${binding.kind !== "button" ? binding.direction : ""}`;
}

export function normalizeGamepadSettings(value: unknown): GamepadSettings {
  const result: GamepadSettings = { selectedDevice: null, devices: {} };
  if (!isRecord(value)) return result;
  if (typeof value.selectedDevice === "string") result.selectedDevice = value.selectedDevice;
  if (!isRecord(value.devices)) return result;
  for (const [key, profiles] of Object.entries(value.devices)) {
    if (!isRecord(profiles)) continue;
    const normalized: Partial<Record<ControlProfileId, GamepadBindings>> = {};
    for (const profile of ["nes", "mame"] as const) {
      const stored = profiles[profile];
      if (!isRecord(stored)) continue;
      const bindings: GamepadBindings = {};
      for (const { button } of controlBindingRows(profile)) {
        const inputs = stored[button];
        if (Array.isArray(inputs) && inputs.every(validBinding)) bindings[button] = inputs.map((input) => ({ ...input }));
      }
      normalized[profile] = bindings;
    }
    Object.defineProperty(result.devices, key, { value: normalized, enumerable: true, configurable: true, writable: true });
  }
  return result;
}

function validBinding(value: unknown): value is GamepadBinding {
  return isRecord(value) && Number.isInteger(value.index) && Number(value.index) >= 0 && Number(value.index) < 256 &&
    (value.kind === "button" || (value.kind === "axis" && (value.direction === -1 || value.direction === 1)) ||
      (value.kind === "hat" && Number.isInteger(value.direction) && Number(value.direction) >= 0 && Number(value.direction) < 8));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
