# Nesbox

Personal browser emulator library for NES and future console cores.

## Features

- React Router v7 app shell
- SQLite-backed game library and save states
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
