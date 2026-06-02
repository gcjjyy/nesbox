# Nesbox

Personal browser emulator library for NES and future console cores.

## Features

- React Router v7 app shell
- SQLite-backed game library and save states
- Browser-local save states via IndexedDB
- Custom TypeScript core interface
- FCEUX NES WASM bridge
- Responsive game library and dedicated play route
- Keyboard, touch, and standard gamepad input

## Local Development

```sh
npm install
npm run dev
```

## Production

```sh
npm install
npm run build
npm run start
```

Runtime data is stored in `data/` by default and is intentionally not committed.
ROM files, SQLite databases, and save-state data must stay outside git.
The server SQLite database stores the shared game library. Per-user save states
are stored in each browser's IndexedDB so public users do not overwrite one
another's saves.
