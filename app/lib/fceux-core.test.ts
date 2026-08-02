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

type FakeFceuxModule = Record<string, unknown> & {
  _audioContext?: unknown;
  init: ReturnType<typeof vi.fn>;
  scriptProcessorNode: {
    onaudioprocess: unknown;
    disconnect: ReturnType<typeof vi.fn>;
  };
};

function fakeCanvas(): HTMLCanvasElement {
  return {
    id: "",
    style: { setProperty: vi.fn() },
  } as unknown as HTMLCanvasElement;
}

async function loadFceuxWrapperWithFakeModule() {
  let moduleOptions: Record<string, unknown> | undefined;
  const fakeFceuxModule: FakeFceuxModule = {
    _defaultConfig: {},
    init: vi.fn(() => true),
    setConfig: vi.fn(),
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
      fakeFceuxModule._audioContext = options._audioContext;
      return fakeFceuxModule;
    },
  };
  const context: Record<string, unknown> = {
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
    context,
    factory: window.createNesboxFceuxCore as FceuxFactory,
    module: fakeFceuxModule,
    processorDisconnect: fakeFceuxModule.scriptProcessorNode.disconnect,
    receivedModuleOptions: () => moduleOptions,
  };
}

async function compileRealVendorInit(context: Record<string, unknown>) {
  const source = await readFile(new URL("../../public/cores/vendor/fceux.js", import.meta.url), "utf8");
  const startMarker = "140017:";
  const start = source.indexOf(startMarker);
  const end = source.indexOf(",140450:", start);
  if (start < 0 || end < 0) throw new Error("FCEUX vendor init callback not found");
  const expression = source.slice(start + startMarker.length, end);
  return runInNewContext(
    `(function executeVendorInit(Module) { return (${expression})(); })`,
    context,
  ) as (module: FakeFceuxModule) => boolean;
}

function makeSharedContext() {
  const realResume = vi.fn(async () => undefined);
  const sharedContext = {
    state: "suspended",
    close: vi.fn(async () => undefined),
  } as Record<string, unknown>;
  Object.defineProperty(sharedContext, "resume", {
    configurable: true,
    enumerable: false,
    value: realResume,
    writable: false,
  });
  return { realResume, sharedContext };
}

function makeSharedContextWithInheritedResume() {
  const realResume = vi.fn(async () => undefined);
  const prototype = {};
  Object.defineProperty(prototype, "resume", {
    configurable: true,
    enumerable: false,
    value: realResume,
    writable: true,
  });
  const sharedContext = Object.assign(Object.create(prototype) as Record<string, unknown>, {
    state: "suspended",
    close: vi.fn(async () => undefined),
  });
  return { prototype, realResume, sharedContext };
}

function installUnexpectedAudioConstructors(context: Record<string, unknown>) {
  let constructionCount = 0;
  const unexpectedResume = vi.fn();
  function UnexpectedAudioContext(this: { resume?: () => void }) {
    constructionCount += 1;
    this.resume = unexpectedResume;
  }
  function UnexpectedWebkitAudioContext(this: { resume?: () => void }) {
    constructionCount += 1;
    this.resume = unexpectedResume;
  }
  Object.defineProperty(context, "AudioContext", {
    configurable: true,
    enumerable: false,
    value: UnexpectedAudioContext,
    writable: true,
  });
  Object.defineProperty(context, "webkitAudioContext", {
    configurable: true,
    enumerable: true,
    value: UnexpectedWebkitAudioContext,
    writable: false,
  });
  return {
    constructionCount: () => constructionCount,
    unexpectedResume,
  };
}

describe("FCEUX core wrapper", () => {
  it("reuses the supplied context without resuming on start or closing on dispose", async () => {
    const { realResume, sharedContext } = makeSharedContext();
    const { factory, processorDisconnect, receivedModuleOptions } = await loadFceuxWrapperWithFakeModule();
    const core = await factory({
      canvas: fakeCanvas(),
      wasmUrl: "/cores/vendor/fceux.wasm",
      audioContext: sharedContext as unknown as AudioContext,
    });

    expect(receivedModuleOptions()?._audioContext).toBe(sharedContext);
    core.start();
    expect(realResume).not.toHaveBeenCalled();
    core.dispose();
    expect(processorDisconnect).toHaveBeenCalledTimes(1);
    expect(sharedContext.close).not.toHaveBeenCalled();
  });

  it("executes real vendor init with the supplied context and no implicit resume", async () => {
    const { context, factory, module } = await loadFceuxWrapperWithFakeModule();
    const vendorInit = await compileRealVendorInit(context);
    module.init.mockImplementation(() => vendorInit(module));
    const constructors = installUnexpectedAudioConstructors(context);
    const audioContextDescriptor = Object.getOwnPropertyDescriptor(context, "AudioContext");
    const webkitDescriptor = Object.getOwnPropertyDescriptor(context, "webkitAudioContext");
    const { realResume, sharedContext } = makeSharedContext();
    const resumeDescriptor = Object.getOwnPropertyDescriptor(sharedContext, "resume");

    await factory({
      canvas: fakeCanvas(),
      wasmUrl: "/cores/vendor/fceux.wasm",
      audioContext: sharedContext as unknown as AudioContext,
    });

    expect(module._audioContext).toBe(sharedContext);
    expect(constructors.constructionCount()).toBe(0);
    expect(constructors.unexpectedResume).not.toHaveBeenCalled();
    expect(realResume).not.toHaveBeenCalled();
    expect(Object.getOwnPropertyDescriptor(context, "AudioContext")).toEqual(audioContextDescriptor);
    expect(Object.getOwnPropertyDescriptor(context, "webkitAudioContext")).toEqual(webkitDescriptor);
    expect(Object.getOwnPropertyDescriptor(sharedContext, "resume")).toEqual(resumeDescriptor);

    await (sharedContext.resume as () => Promise<void>)();
    expect(realResume).toHaveBeenCalledTimes(1);
  });

  it("restores constructors and the real resume method when vendor init throws", async () => {
    const { context, factory, module } = await loadFceuxWrapperWithFakeModule();
    const vendorInit = await compileRealVendorInit(context);
    const initError = new Error("vendor init exploded");
    module.init.mockImplementation(() => {
      vendorInit(module);
      throw initError;
    });
    const constructors = installUnexpectedAudioConstructors(context);
    const audioContextDescriptor = Object.getOwnPropertyDescriptor(context, "AudioContext");
    const webkitDescriptor = Object.getOwnPropertyDescriptor(context, "webkitAudioContext");
    const { realResume, sharedContext } = makeSharedContext();
    const resumeDescriptor = Object.getOwnPropertyDescriptor(sharedContext, "resume");

    await expect(factory({
      canvas: fakeCanvas(),
      wasmUrl: "/cores/vendor/fceux.wasm",
      audioContext: sharedContext as unknown as AudioContext,
    })).rejects.toBe(initError);

    expect(module._audioContext).toBe(sharedContext);
    expect(constructors.constructionCount()).toBe(0);
    expect(realResume).not.toHaveBeenCalled();
    expect(Object.getOwnPropertyDescriptor(context, "AudioContext")).toEqual(audioContextDescriptor);
    expect(Object.getOwnPropertyDescriptor(context, "webkitAudioContext")).toEqual(webkitDescriptor);
    expect(Object.getOwnPropertyDescriptor(sharedContext, "resume")).toEqual(resumeDescriptor);

    await (sharedContext.resume as () => Promise<void>)();
    expect(realResume).toHaveBeenCalledTimes(1);
  });

  it("restores an inherited resume method after executing real vendor init", async () => {
    const { context, factory, module } = await loadFceuxWrapperWithFakeModule();
    const vendorInit = await compileRealVendorInit(context);
    module.init.mockImplementation(() => vendorInit(module));
    const constructors = installUnexpectedAudioConstructors(context);
    const { prototype, realResume, sharedContext } = makeSharedContextWithInheritedResume();
    const prototypeDescriptor = Object.getOwnPropertyDescriptor(prototype, "resume");

    await factory({
      canvas: fakeCanvas(),
      wasmUrl: "/cores/vendor/fceux.wasm",
      audioContext: sharedContext as unknown as AudioContext,
    });

    expect(module._audioContext).toBe(sharedContext);
    expect(constructors.constructionCount()).toBe(0);
    expect(realResume).not.toHaveBeenCalled();
    expect(Object.getOwnPropertyDescriptor(sharedContext, "resume")).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(prototype, "resume")).toEqual(prototypeDescriptor);

    await (sharedContext.resume as () => Promise<void>)();
    expect(realResume).toHaveBeenCalledTimes(1);
  });

  it("fails before init when a global audio constructor cannot be safely overridden", async () => {
    const { context, factory, module } = await loadFceuxWrapperWithFakeModule();
    let constructionCount = 0;
    function LockedAudioContext() {
      constructionCount += 1;
    }
    Object.defineProperty(context, "AudioContext", {
      configurable: false,
      enumerable: true,
      value: LockedAudioContext,
      writable: false,
    });
    const descriptor = Object.getOwnPropertyDescriptor(context, "AudioContext");
    const { realResume, sharedContext } = makeSharedContext();
    const resumeDescriptor = Object.getOwnPropertyDescriptor(sharedContext, "resume");

    await expect(factory({
      canvas: fakeCanvas(),
      wasmUrl: "/cores/vendor/fceux.wasm",
      audioContext: sharedContext as unknown as AudioContext,
    })).rejects.toThrow(/AudioContext/);

    expect(module.init).not.toHaveBeenCalled();
    expect(constructionCount).toBe(0);
    expect(realResume).not.toHaveBeenCalled();
    expect(Object.getOwnPropertyDescriptor(context, "AudioContext")).toEqual(descriptor);
    expect(Object.getOwnPropertyDescriptor(sharedContext, "resume")).toEqual(resumeDescriptor);
  });

  it("rolls back the first constructor when the second constructor is locked", async () => {
    const { context, factory, module } = await loadFceuxWrapperWithFakeModule();
    let constructionCount = 0;
    function OriginalAudioContext() {
      constructionCount += 1;
    }
    function LockedWebkitAudioContext() {
      constructionCount += 1;
    }
    Object.defineProperty(context, "AudioContext", {
      configurable: true,
      enumerable: false,
      value: OriginalAudioContext,
      writable: false,
    });
    Object.defineProperty(context, "webkitAudioContext", {
      configurable: false,
      enumerable: true,
      value: LockedWebkitAudioContext,
      writable: false,
    });
    const audioContextDescriptor = Object.getOwnPropertyDescriptor(context, "AudioContext");
    const webkitDescriptor = Object.getOwnPropertyDescriptor(context, "webkitAudioContext");
    const { realResume, sharedContext } = makeSharedContext();
    const resumeDescriptor = Object.getOwnPropertyDescriptor(sharedContext, "resume");

    await expect(factory({
      canvas: fakeCanvas(),
      wasmUrl: "/cores/vendor/fceux.wasm",
      audioContext: sharedContext as unknown as AudioContext,
    })).rejects.toThrow(/webkitAudioContext/);

    expect(module.init).not.toHaveBeenCalled();
    expect(constructionCount).toBe(0);
    expect(realResume).not.toHaveBeenCalled();
    expect(Object.getOwnPropertyDescriptor(context, "AudioContext")).toEqual(audioContextDescriptor);
    expect(Object.getOwnPropertyDescriptor(context, "webkitAudioContext")).toEqual(webkitDescriptor);
    expect(Object.getOwnPropertyDescriptor(sharedContext, "resume")).toEqual(resumeDescriptor);
  });
});
