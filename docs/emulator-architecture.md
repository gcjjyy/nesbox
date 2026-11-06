# NESBOX Emulator Architecture

Nesbox is organized around a SQLite-backed game library, not a one-off file picker.

## Data Model

- `EmulatorProfile`: exact runtime target such as `fceux`, `mame2003-plus`, or `fbneo`.
- `GameEntry`: registered game metadata plus a fixed `emulatorId`.
- SQLite table `games`: metadata plus the local ROM path.
- Browser IndexedDB: per-browser state blobs keyed by `gameId + emulatorId + slot`.
- Browser local storage: versioned NES/MAME keyboard bindings and display settings.

The server does not store save-state blobs. This prevents users of the shared
deployment from overwriting one another's state.

## Runtime Boundary

React talks only to `NesboxCore` from `app/lib/core-contract.ts`.

Script-based cores register a global factory:

- `window.createNesboxNestopiaCore`
- `window.createNesboxFceuxCore`
- `window.createNesboxSnes9xCore`

The factory receives its canvas/WASM/audio options and returns:

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
- SNES planned: Snes9x (`/cores/nesbox_snes.js`, `/cores/nesbox_snes.wasm`)
- Arcade active: MAME 2003-Plus via EmulatorJS 4.2.3 (`mame2003_plus`)
- Arcade active: FinalBurn Neo via EmulatorJS 4.2.3 (`fbneo`)

OpenEmu is intentionally not used as the core base. It is a large macOS frontend/orchestration project, while Nesbox needs small browser-facing cores with a stable JS/WASM ABI.

## Runtime Ownership

FCEUX uses the application-owned canvas and shared `audioSession`. NESBOX loads
its script/WASM bridge and owns audio unlock, frame sizing, state serialization,
and disposal.

Arcade games use a DOM-hosted EmulatorJS adapter. Only
`app/lib/emulatorjs-core.ts` may touch EJS globals or version-dependent internal
methods. The adapter exposes the same `NesboxCore` boundary, preserves the ROM
shortname, and owns its Blob URL and mounted player. EmulatorJS creates and
disposes its own audio context; it does not use the FCEUX shared audio session.
Arcade loading is deferred behind the visible `게임 시작` gesture.

Changing routes or games aborts the ROM fetch and disposes the active core,
pressed input, DOM host, audio, and Blob URL.

## Local EmulatorJS Assets and Licenses

`npm run prepare:emulatorjs` copies the exactly pinned 4.2.3 loader, styles,
reports, localization/compression sources, and MAME/FBNeo core data from npm
packages into ignored `public/emulatorjs/data/`. `predev` and `prebuild` run the
copy automatically. Runtime code is served locally; CDN loading is blocked.

The application is `GPL-3.0-only`. EmulatorJS and each arcade core keep their
own terms. MAME 2003-Plus and FBNeo have noncommercial restrictions; see
`THIRD_PARTY_NOTICES.md` and `third_party/licenses/`.

## Catalog Import and Assets

`scripts/import-archive.ts` plans NES or arcade imports from a read-only archive.
Plans validate manifests, screenshots, core IDs, ROM headers/ZIP signatures,
and SHA-1 duplicates before apply. Apply checkpoints and backs up SQLite,
converts covers to WebP, stages files, verifies hashes, and inserts without
rewriting existing metadata. Repeating the import adds zero rows.

Expected live counts are:

- NES / FCEUX: 138
- Arcade / MAME 2003-Plus: 239
- Arcade / FBNeo: 83
- Total: 460

ROMs, covers, backups, SQLite, and generated EmulatorJS assets are deployment
data and are not committed to the repository.

## Input Profiles

The shared `nes | mame` control profile model drives keyboard, gamepad, touch,
welcome/help guides, and Settings. MAME buttons 1–6 map to RetroPad
`b, y, a, x, l, r`, default keyboard `Z X C / A S D`, and standard gamepad
indices 0–5. Blur, hidden visibility, profile changes, settings capture, and
core disposal release every held input.
