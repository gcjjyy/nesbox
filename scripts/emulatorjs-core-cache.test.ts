import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { patchEmulatorJsCoreCache } from './emulatorjs-core-cache';

const source = readFileSync('node_modules/@emulatorjs/emulatorjs/data/src/emulator.js', 'utf8');
const files = {
  'core.js': new Uint8Array([1]),
  'core.wasm': new Uint8Array([0, 97, 115, 109]),
  'build.json': new TextEncoder().encode('{}'),
};
function runtime(store: Map<string, unknown>, version = 1, denied = false) {
  const proto = vm.runInNewContext(patchEmulatorJsCoreCache(source) + '\nEmulatorJS.prototype;', { window: {}, Uint8Array, TextDecoder, console });
  let resolve!: () => void;
  const ready = new Promise<void>(r => { resolve = r; });
  const raw = Object.assign(Object.create(proto), {
    debug: true, config: {}, supportsWebgl2: true, webgl2Enabled: null,
    textElem: { innerText: '' }, elements: {},
    getCore: () => 'mame2003_plus', preGetSetting: () => null,
    localization: (s: string) => s, checkCoreCompatibility: vi.fn(),
    storage: { core: {
      get: vi.fn(async (key: string) => { if (denied) throw new Error('blocked'); return store.get(key); }),
      put: vi.fn(async (key: string, value: unknown) => { if (denied) throw new Error('quota'); store.set(key, value); }),
    } },
    downloadFile: vi.fn(async (path: string) => ({ data: path.endsWith('.json') ? { buildStart: version } : new ArrayBuffer(2) })),
    checkCompression: vi.fn(async () => files),
    initGameCore: vi.fn(() => resolve()),
  });
  return { raw, run: async () => { raw.downloadGameCore(); await ready; } };
}

describe('expanded EmulatorJS core cache', () => {
  it('reuses extracted files across fresh runtimes, even with source/debug assets', async () => {
    const store = new Map<string, unknown>();
    const first = runtime(store); await first.run();
    expect(first.raw.checkCompression).toHaveBeenCalledTimes(1);
    const second = runtime(store); await second.run();
    expect(second.raw.downloadFile).toHaveBeenCalledTimes(1); // only the small version report
    expect(second.raw.checkCompression).not.toHaveBeenCalled();
    expect(second.raw.initGameCore).toHaveBeenCalledWith(files['core.js'], files['core.wasm'], undefined);
    expect(second.raw.textElem.innerText).toBe('Load Cached Game Core');
  });
  it('downloads again when the core build changes or the stored record is incomplete', async () => {
    const store = new Map<string, unknown>();
    await runtime(store).run();
    const next = runtime(store, 2); await next.run();
    expect(next.raw.checkCompression).toHaveBeenCalledTimes(1);
    for (const key of store.keys()) store.set(key, { version: 2, files: {} });
    const corrupt = runtime(store, 2); await corrupt.run();
    expect(corrupt.raw.checkCompression).toHaveBeenCalledTimes(1);
  });
  it('still starts when browser storage is blocked or full', async () => {
    const game = runtime(new Map(), 1, true); await game.run();
    expect(game.raw.initGameCore).toHaveBeenCalledTimes(1);
  });
});
