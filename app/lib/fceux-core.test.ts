import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type FceuxFactory = (options: {
  canvas: HTMLCanvasElement;
  wasmUrl: string;
  audioContext: AudioContext;
}) => Promise<{
  start: () => void;
  dispose: () => void;
}>;

type FceuxWrapperWindow = {
  FCEUX: (options: Record<string, unknown>) => Promise<Record<string, unknown>>;
  createNesboxFceuxCore?: FceuxFactory;
};

function fakeCanvas(): HTMLCanvasElement {
  return {
    id: "",
    style: { setProperty: vi.fn() },
  } as unknown as HTMLCanvasElement;
}

async function loadFceuxWrapperWithFakeModule() {
  let moduleOptions: Record<string, unknown> | undefined;
  const fakeFceuxModule = {
    init: vi.fn(() => true),
    setMuted: vi.fn(),
    setPaused: vi.fn(),
    setControllerBits: vi.fn(),
    update: vi.fn(),
    reset: vi.fn(),
    loadGame: vi.fn(),
    setState: vi.fn(),
    saveState: vi.fn(),
    exportSaveFiles: vi.fn(() => ({})),
    importSaveFiles: vi.fn(),
    loadState: vi.fn(),
    scriptProcessorNode: {
      onaudioprocess: null,
      disconnect: vi.fn(),
    },
  };
  const window: FceuxWrapperWindow = {
    FCEUX: async (options) => {
      moduleOptions = options;
      return { ...fakeFceuxModule, _audioContext: options._audioContext };
    },
  };
  const context = {
    window,
    CSS: { escape: (value: string) => value },
    requestAnimationFrame: vi.fn(() => 1),
    cancelAnimationFrame: vi.fn(),
    TextEncoder,
    TextDecoder,
    btoa: (value: string) => Buffer.from(value, "binary").toString("base64"),
    atob: (value: string) => Buffer.from(value, "base64").toString("binary"),
  };
  const source = await readFile(new URL("../../public/cores/nesbox_fceux.js", import.meta.url), "utf8");

  runInNewContext(source, context);

  return {
    factory: window.createNesboxFceuxCore as FceuxFactory,
    receivedModuleOptions: () => moduleOptions,
  };
}

describe("FCEUX core wrapper", () => {
  it("reuses the supplied context without resuming on start or closing on dispose", async () => {
    const sharedContext = {
      state: "suspended",
      resume: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    };
    const { factory, receivedModuleOptions } = await loadFceuxWrapperWithFakeModule();
    const core = await factory({
      canvas: fakeCanvas(),
      wasmUrl: "/cores/vendor/fceux.wasm",
      audioContext: sharedContext as unknown as AudioContext,
    });

    expect(receivedModuleOptions()?._audioContext).toBe(sharedContext);
    core.start();
    expect(sharedContext.resume).not.toHaveBeenCalled();
    core.dispose();
    expect(sharedContext.close).not.toHaveBeenCalled();
  });
});
