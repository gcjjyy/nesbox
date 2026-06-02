# Nesbox Emulator Architecture

Nesbox is organized around a SQLite-backed game library, not a one-off file picker.

## Data Model

- `EmulatorProfile`: exact runtime target such as `nestopia`, `fceux`, or `snes9x`.
- `GameEntry`: registered game metadata plus a fixed `emulatorId`.
- SQLite table `games`: metadata plus the local ROM path.
- SQLite table `save_states`: binary state blobs keyed by `gameId + emulatorId + slot`.
- Save states include the emulator id, so states from different cores cannot collide.

## Runtime Boundary

React talks only to `NesboxCore` from `app/lib/core-contract.ts`.

Each WASM bridge must register a global factory:

- `window.createNesboxNestopiaCore`
- `window.createNesboxFceuxCore`
- `window.createNesboxSnes9xCore`

The factory receives `{ canvas, wasmUrl, onLog }` and returns:

- `loadRom(rom, name)`
- `start`, `pause`, `resume`, `reset`, `stop`
- `setButton(player, button, pressed)`
- `setVolume(volume)`
- `saveState()`
- `loadState(bytes)`
- `dispose()`

## Current Cores

- NES active: FCEUX Emscripten (`/cores/nesbox_fceux.js`, `/cores/vendor/fceux.wasm`)
- NES planned: Nestopia UE libretro (`/cores/nesbox_nes.js`, `/cores/nesbox_nes.wasm`)
- SNES default: Snes9x (`/cores/nesbox_snes.js`, `/cores/nesbox_snes.wasm`)

OpenEmu is intentionally not used as the core base. It is a large macOS frontend/orchestration project, while Nesbox needs small browser-facing cores with a stable JS/WASM ABI.

EmulatorJS is also intentionally not embedded. It is useful as a reference for browser input/audio/video concerns, but this app owns the TypeScript interface and DOM integration.
