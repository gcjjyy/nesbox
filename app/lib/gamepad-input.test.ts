import { describe, expect, it } from "vitest";
import {
  assignGamepadBinding, createGamepadCapture, gamepadDeviceKey,
  normalizeGamepadSettings, readConnectedGamepads, readGamepadButtons, selectGamepad,
  type GamepadDevice,
} from "./gamepad-input";

function pad(pressed: number[] = [], axes = [0, 0], mapping = "standard"): GamepadDevice {
  return { id: "USB joystick", index: 0, connected: true, mapping,
    axes, buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: pressed.includes(index), value: pressed.includes(index) ? 1 : 0 })) };
}

describe("joystick input", () => {
  it("preserves d-pad directions when the stick is neutral and unions diagonals", () => {
    expect([...readGamepadButtons(pad([12, 14]), "nes")].sort()).toEqual(["left", "up"]);
    expect([...readGamepadButtons(pad([12], [1, 0]), "nes")].sort()).toEqual(["right", "up"]);
  });

  it("applies a dead zone and supports the existing NES and six-button arcade defaults", () => {
    expect([...readGamepadButtons(pad([], [0.3, -0.3]), "nes")]).toEqual([]);
    expect([...readGamepadButtons(pad([0, 1, 8, 9]), "nes")].sort()).toEqual(["a", "b", "select", "start"]);
    expect([...readGamepadButtons(pad([0, 1, 2, 3, 4, 5]), "mame")].sort()).toEqual(["a", "b", "l", "r", "x", "y"]);
  });

  it("uses custom button and inverted axis bindings only for their device and profile", () => {
    const device = pad([7], [0, 0, 0.8], "");
    let settings = normalizeGamepadSettings(null);
    settings = assignGamepadBinding(settings, device, "mame", "select", { kind: "button", index: 7 });
    settings = assignGamepadBinding(settings, device, "mame", "up", { kind: "axis", index: 2, direction: 1 });
    expect([...readGamepadButtons(device, "mame", settings)].sort()).toEqual(["select", "up"]);
    expect([...readGamepadButtons(device, "nes", settings)]).toEqual([]);
    expect([...readGamepadButtons({ ...device, id: "Other" }, "mame", settings)]).toEqual([]);
    expect([...readGamepadButtons({ ...device, connected: false }, "mame", settings)]).toEqual([]);
  });

  it("moves duplicate assignments off their old action", () => {
    const device = pad([0]);
    const settings = assignGamepadBinding(normalizeGamepadSettings(null), device, "nes", "a", { kind: "button", index: 0 });
    expect([...readGamepadButtons(device, "nes", settings)]).toEqual(["a"]);
  });

  it("ignores initially held inputs and jitter until a deliberate new input", () => {
    const capture = createGamepadCapture(pad([0]));
    expect(capture(pad([0]))).toBeNull();
    expect(capture(pad([], [0.2, 0]))).toBeNull();
    expect(capture(pad([0]))).toEqual({ kind: "button", index: 0 });
    expect(createGamepadCapture(pad())(pad([], [0, -0.9]))).toEqual({ kind: "axis", index: 1, direction: -1 });
  });

  it("ignores invalid axis values and missing controls", () => {
    expect([...readGamepadButtons(pad([], [NaN, 3.28]), "nes")]).toEqual([]);
    expect([...readGamepadButtons({ ...pad(), buttons: [], axes: [] }, "mame")]).toEqual([]);
  });

  it("captures USB hat axes with an out-of-range neutral and preserves diagonals", () => {
    const neutral = pad([], [0, 0, 3.28], "");
    const up = createGamepadCapture(neutral)(pad([], [0, 0, -1], ""));
    expect(up).toEqual({ kind: "hat", index: 2, direction: 0 });
    let settings = assignGamepadBinding(normalizeGamepadSettings(null), neutral, "nes", "up", up!);
    settings = assignGamepadBinding(settings, neutral, "nes", "right", { kind: "hat", index: 2, direction: 2 });
    expect([...readGamepadButtons(pad([], [0, 0, -5 / 7], ""), "nes", settings)].sort()).toEqual(["right", "up"]);
    expect([...readGamepadButtons(neutral, "nes", settings)]).toEqual([]);
  });

  it("learns a USB hat after an initially held direction returns to neutral", () => {
    const capture = createGamepadCapture(pad([], [0, 0, -1], ""));
    expect(capture(pad([], [0, 0, -1], ""))).toBeNull();
    expect(capture(pad([], [0, 0, 3.28], ""))).toBeNull();
    expect(capture(pad([], [0, 0, -3 / 7], ""))).toEqual({ kind: "hat", index: 2, direction: 2 });
  });

  it("handles sparse lists, disconnected devices, and denied/absent APIs", () => {
    const device = pad();
    expect(readConnectedGamepads({ getGamepads: () => [null, { ...device, connected: false }, device] }).devices).toEqual([device]);
    expect(readConnectedGamepads({}).error).toBe("unsupported");
    expect(readConnectedGamepads({ getGamepads: () => { throw new Error("denied"); } }).error).toBe("blocked");
    expect(selectGamepad([device], "missing")).toBeNull();
    expect(selectGamepad([device], gamepadDeviceKey(device))).toBe(device);
    expect(selectGamepad([device], null)).toBe(device);
  });

  it("validates persisted bindings and keeps explicitly unassigned actions", () => {
    const device = pad();
    const settings = normalizeGamepadSettings({ selectedDevice: 42, devices: { [gamepadDeviceKey(device)]: { nes: {
      a: [{ kind: "axis", index: -1, direction: 0 }], b: [],
      start: [{ kind: "button", index: 6 }],
    } } } });
    expect(settings.selectedDevice).toBeNull();
    expect([...readGamepadButtons(pad([0, 1, 6]), "nes", settings)].sort()).toEqual(["a", "start"]);
  });
});
