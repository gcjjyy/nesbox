# 도스박물관 NESBOX

Personal browser emulator library for NES and arcade cores.

## Features

- React Router v7 app shell
- SQLite-backed game library and save states
- Browser-local save states via IndexedDB
- Custom TypeScript core interface
- FCEUX NES WASM bridge
- EmulatorJS MAME 2003-Plus and FBNeo arcade bridge
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

`npm run dev` and `npm run build` prepare the pinned EmulatorJS 4.2.3 runtime
and core assets under the ignored `public/emulatorjs/data/` directory. Runtime
code is served locally and is not fetched from a CDN.

Runtime data is stored in `data/` by default and is intentionally not committed.
ROM files, SQLite databases, and save-state data must stay outside git.
The server SQLite database stores the shared game library. Per-user save states
are stored in each browser's IndexedDB so public users do not overwrite one
another's saves.

## License

도스박물관 NESBOX application code is licensed under the GNU General Public
License version 3 only (`GPL-3.0-only`). See `LICENSE` for the full text.

EmulatorJS and the arcade cores retain their own licenses. MAME 2003-Plus and
FBNeo include noncommercial restrictions, so this deployment must not be used
for advertising, sales, paid access, donation solicitation, or other monetary
gain. See `THIRD_PARTY_NOTICES.md` and `third_party/licenses/`.
