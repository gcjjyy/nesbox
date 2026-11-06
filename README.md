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
- `ALL / NES / MAME` category filtering with category-scoped search
- Per-core keyboard guides and persistent key customization

The deployed catalog is expected to contain 460 games: 138 NES, 239 MAME
2003-Plus, and 83 FBNeo. Both arcade cores appear under the `MAME` UI
category.

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

Set `NESBOX_DATA_DIR` when the shared library lives elsewhere. The current
deployment uses `/home/gcjjyy/lab/nesbox-data`.

## Archive Import

The archive importer is dry-run by default and requires absolute paths:

```sh
npm run import:archive -- --kind nes --archive /home/gcjjyy/dosgamebox_archive --data-dir /home/gcjjyy/lab/nesbox-data --json
npm run import:archive -- --kind arcade --archive /home/gcjjyy/dosgamebox_archive --data-dir /home/gcjjyy/lab/nesbox-data --json
```

After reviewing the plan, add `--apply` to the same command. An apply creates a
timestamped SQLite backup under `<data-dir>/backups/`, stages every ROM and
WebP cover, verifies hashes, and inserts the batch atomically. The archive is
read-only; imported ROMs and covers are copied into the data directory.

To roll back, stop the service, preserve the current database, and restore the
reported backup before restarting:

```sh
pm2 stop nesbox
cp /home/gcjjyy/lab/nesbox-data/nesbox.sqlite /home/gcjjyy/lab/nesbox-data/backups/nesbox-before-rollback.sqlite
cp /home/gcjjyy/lab/nesbox-data/backups/<reported-backup>.sqlite /home/gcjjyy/lab/nesbox-data/nesbox.sqlite
pm2 start nesbox
```

Hash-named ROM/cover files created after that backup can remain as harmless
orphans or be removed only from the exact `romPaths`/`coverPaths` recorded by
the apply report.

## Default Controls

- NES: arrows, `Shift` Select, `Enter` Start, `Z` B, `X` A.
- MAME/FBNeo: arrows, `Shift` Coin, `Enter` Start, buttons 1–6 on
  `Z X C / A S D`.
- Standard gamepads use the d-pad/left stick, Back/View, Start/Menu, and MAME
  face/shoulder button indices 0–5.

Keyboard assignments are edited per profile in Settings and stored in browser
local storage. Save states remain in IndexedDB.

## License

도스박물관 NESBOX application code is licensed under the GNU General Public
License version 3 only (`GPL-3.0-only`). See `LICENSE` for the full text.

EmulatorJS and the arcade cores retain their own licenses. MAME 2003-Plus and
FBNeo include noncommercial restrictions, so this deployment must not be used
for advertising, sales, paid access, donation solicitation, or other monetary
gain. See `THIRD_PARTY_NOTICES.md` and `third_party/licenses/`.
