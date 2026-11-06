import { describe, expect, it, vi } from "vitest";
import { emulatorById } from "./emulator-registry";
import {
  createEmulatorJsCore,
  type EmulatorJsBridge,
  type EmulatorJsInstance,
  type EmulatorJsMountConfig,
} from "./emulatorjs-core";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function fakeHost() {
  const children = [{ id: "old" }];
  return {
    children,
    replaceChildren: vi.fn((...next: unknown[]) => {
      children.splice(0, children.length, ...next as { id: string }[]);
    }),
  } as unknown as HTMLElement;
}

function fakeInstance(): EmulatorJsInstance {
  return {
    pause: vi.fn(),
    resume: vi.fn(),
    reset: vi.fn(),
    setVolume: vi.fn(),
    setInput: vi.fn(),
    saveState: vi.fn(async () => new Uint8Array([8, 9])),
    loadState: vi.fn(async () => undefined),
    destroy: vi.fn(),
  };
}

describe("createEmulatorJsCore", () => {
  it("forwards startup progress only while the current core is mounting", async () => {
    const mounting = deferred<EmulatorJsInstance>();
    let config!: EmulatorJsMountConfig;
    const bridge: EmulatorJsBridge = { mount: vi.fn((next) => { config = next; return mounting.promise; }) };
    const onProgress = vi.fn();
    const core = await createEmulatorJsCore(emulatorById("fbneo")!, fakeHost(), bridge, onProgress);
    await core.loadRom(new Uint8Array([1]), "sf2ce.zip");
    const starting = core.start();
    config.onProgress?.({ label: "게임 코어 다운로드", percent: 40 });
    expect(onProgress).toHaveBeenLastCalledWith({ label: "게임 코어 다운로드", percent: 40 });
    core.dispose();
    onProgress.mockClear();
    config.onProgress?.({ label: "게임 코어 다운로드", percent: 90 });
    expect(onProgress).not.toHaveBeenCalled();
    mounting.resolve(fakeInstance());
    await starting;
  });

  it("mounts once with the original arcade shortname and delegates the core contract", async () => {
    const instance = fakeInstance();
    const mount = vi.fn(async (_config: EmulatorJsMountConfig) => instance);
    const bridge: EmulatorJsBridge = { mount };
    const host = fakeHost();
    const profile = emulatorById("fbneo");
    expect(profile).not.toBeNull();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:sf2ce");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    const core = await createEmulatorJsCore(profile!, host, bridge);
    await core.loadRom(new Uint8Array([1, 2, 3]), "sf2ce.zip");
    await core.start();
    await core.start();

    expect(mount).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledWith(expect.objectContaining({
      coreName: "fbneo",
      dataPath: "/emulatorjs/data/",
      gameName: "sf2ce.zip",
      gameUrl: "blob:sf2ce",
      hostElement: host,
    }));

    core.pause();
    core.resume();
    core.reset();
    core.setVolume(0.25);
    const buttons = ["b", "y", "select", "start", "up", "down", "left", "right", "a", "x", "l", "r"] as const;
    buttons.forEach((button, index) => core.setButton(0, button, true));
    await expect(core.saveState()).resolves.toEqual(new Uint8Array([8, 9]));
    await core.loadState(new Uint8Array([4, 5]));

    expect(instance.pause).toHaveBeenCalledTimes(1);
    expect(instance.resume).toHaveBeenCalledTimes(2);
    expect(instance.reset).toHaveBeenCalledTimes(1);
    expect(instance.setVolume).toHaveBeenCalledWith(0.25);
    expect(instance.setInput).toHaveBeenCalledTimes(12);
    buttons.forEach((_button, index) => {
      expect(instance.setInput).toHaveBeenCalledWith(0, index, true);
    });
    expect(instance.loadState).toHaveBeenCalledWith(new Uint8Array([4, 5]));

    core.dispose();
    core.dispose();
    expect(instance.destroy).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it("destroys a late instance and releases held inputs after disposal", async () => {
    const mounting = deferred<EmulatorJsInstance>();
    const bridge: EmulatorJsBridge = { mount: vi.fn(() => mounting.promise) };
    const instance = fakeInstance();
    const host = fakeHost();
    const profile = emulatorById("mame2003-plus")!;
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:1942");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const core = await createEmulatorJsCore(profile, host, bridge);
    await core.loadRom(new Uint8Array([7]), "1942.zip");
    core.setButton(0, "b", true);
    core.setButton(0, "right", true);

    const starting = Promise.resolve(core.start());
    core.dispose();
    const nextGame = { id: "next-game" };
    host.replaceChildren(nextGame as unknown as Node);
    mounting.resolve(instance);
    await starting;

    expect(instance.setInput).toHaveBeenCalledWith(0, 0, false);
    expect(instance.setInput).toHaveBeenCalledWith(0, 7, false);
    expect(instance.destroy).toHaveBeenCalledTimes(1);
    expect(host.children[0]).toBe(nextGame);
    expect(host.replaceChildren).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledTimes(1);
  });
});
