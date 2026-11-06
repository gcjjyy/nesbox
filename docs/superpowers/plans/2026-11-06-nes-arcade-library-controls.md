# NESBOX NES·Arcade Library and Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the approved NES and arcade archive into NESBOX, run MAME 2003-Plus and FBNeo locally through EmulatorJS, and add category-scoped discovery plus core-specific guides and editable keyboard controls.

**Architecture:** A tested server-side archive planner and atomic applier own all catalog migration; ROMs and covers stay outside Git. The existing FCEUX path remains intact, while a version-pinned EmulatorJS adapter implements the same `NesboxCore` boundary from its own DOM host. A shared `nes | mame` control-profile model drives runtime input, help UI, and persisted settings.

**Tech Stack:** TypeScript 5.9, React 19, React Router 7, Vitest 2, better-sqlite3 12, sharp 0.34, fflate 0.8.3, EmulatorJS 4.2.3, MAME 2003-Plus core 4.2.3, FBNeo core 4.2.3

**Spec:** `docs/superpowers/specs/2026-11-06-nes-arcade-library-controls-design.md`

## Global Constraints

- Execute in this order: NES import, arcade import/runtime, ALL/NES/MAME filtering, guide tabs, keyboard customization.
- Keep existing 110 NES rows, covers, pin state, recent-play data, and browser save states intact.
- Skip five byte-identical NES ROMs; add 21 new works and seven distinct-ROM editions for 138 NES total.
- Register 239 `mame2003-plus` and 83 `fbneo` games as `system: "arcade"`; expose both as the `MAME` UI category.
- Keep ROMs, screenshots, database backups, and generated EmulatorJS assets outside Git.
- Pin `@emulatorjs/emulatorjs`, `@emulatorjs/core-mame2003_plus`, and `@emulatorjs/core-fbneo` to exactly `4.2.3`; never fetch runtime code from a CDN.
- Relicense NESBOX application code as `GPL-3.0-only`, while retaining and displaying each core's separate noncommercial terms.
- Treat `/home/gcjjyy/dosgamebox_archive` as read-only and default every import command to dry-run.
- Store keyboard bindings as `KeyboardEvent.code`; MAME exposes Coin, Start, directions, and six action buttons for player 1.
- Preserve the existing FCEUX shared-audio behavior; EmulatorJS owns and disposes its separate audio context.

## Review Focus

- Malformed manifest rows, missing source files, and invalid images must fail preflight before any database or final-file write; Tasks 1 and 2 pin this with fixture and rollback tests.
- A renamed ROM with identical bytes and a second invocation after success must add zero rows and preserve existing metadata; Tasks 1 and 2 test SHA-1 deduplication and idempotency.
- Disposing or switching games while EmulatorJS is preparing must leave no stale player, Blob URL, DOM, or input state; Task 4 tests delayed-mount cancellation.
- Search must never escape the selected category, including the recent-play view where order must remain recent-first; Task 7 tests both compositions.
- Key capture, window blur, visibility loss, and profile changes must not type into the game or leave a held button stuck; Tasks 6 and 9 test routing and release behavior.

## File Map

- Create `app/lib/archive-catalog.server.ts`: read and validate archive manifests, hash ROMs, and produce dry-run plans.
- Create `app/lib/archive-catalog.server.test.ts`: fixture coverage for NES/arcade planning, malformed sources, variants, and duplicates.
- Create `app/lib/archive-import.server.ts`: stage covers/ROMs, back up SQLite, commit rows atomically, and roll back files.
- Create `app/lib/archive-import.server.test.ts`: temporary-database tests for preservation, rollback, and idempotency.
- Create `scripts/import-archive.ts`: dry-run-by-default CLI for `nes` and `arcade` plans.
- Create `scripts/archive-nes-variants.json`: curated seven-work edition mapping.
- Create `scripts/copy-emulatorjs-assets.ts` and test: copy pinned local runtime/core assets into ignored `public/emulatorjs/data`.
- Create `THIRD_PARTY_NOTICES.md` and `third_party/licenses/*`: license/source notices shipped with the app.
- Create `app/lib/emulatorjs-core.ts` and test: version-dependent EmulatorJS bridge and stable `NesboxCore` adapter.
- Create `app/lib/library-client.test.ts`: protect streamed ROM progress and single-buffer delivery.
- Create `app/lib/emulator-registry.test.ts`: protect explicit arcade-core selection and reject ambiguous ZIP upload inference.
- Create `app/lib/control-profiles.ts` and test: profile selection, defaults, labels, keyboard/gamepad maps, and assignment validation.
- Create `app/components/ControlGuideTabs.tsx`: accessible NES/MAME keyboard guide shared by welcome and help dialogs.
- Modify `app/lib/library.server.ts`: expose reusable schema/import primitives without changing existing upload behavior.
- Modify `app/lib/core-contract.ts`, `core-loader.ts`, and `emulator-registry.ts`: add arcade profiles and a DOM-hosted runtime path.
- Modify `app/lib/rom.ts`: display the arcade system without changing NES/SNES detection.
- Modify `app/components/EmulatorStage.tsx` and `TouchControls.tsx`: host EmulatorJS and route NES/MAME keyboard, gamepad, and touch input.
- Modify `app/lib/catalog.ts` and `app/components/GameLibrary.tsx`: category filtering, counts, search composition, and arcade cards.
- Modify `app/lib/storage.ts`, `SettingsSheet.tsx`, `KeyboardLayoutPreview.tsx`, `WelcomeDialog.tsx`, and `HelpDialog.tsx`: persisted bindings, capture UI, and live guides.
- Modify `app/routes/_index.tsx`, `app/routes/play.$gameId.tsx`, and `app/app.css`: pass settings and style all new states.
- Modify `package.json`, `package-lock.json`, `.gitignore`, `LICENSE`, `README.md`, and `docs/emulator-architecture.md`: dependencies, generated assets, license, and architecture.

---

### Task 1: NES archive planner and dry-run

**Files:**
- Create: `app/lib/archive-catalog.server.ts`
- Create: `app/lib/archive-catalog.server.test.ts`
- Create: `scripts/archive-nes-variants.json`
- Create: `scripts/import-archive.ts`
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Produces: `ArchiveImportCandidate`, `ArchiveImportPlan`, and `ArchivePlanCounts`.
- Produces: `planNesArchiveImport(options: { archiveRoot: string; existingGames: StoredGame[] }): Promise<ArchiveImportPlan>`.
- Produces CLI: `npm run import:archive -- --kind nes --archive <path> --data-dir <path> [--json]`; absence of `--apply` must never write.

- [ ] **Step 1: Write failing planner tests**

Add fixture tests named `plans one candidate from a valid single-entry iNES zip`, `rejects NES zips with zero or multiple ROM entries`, `fails the whole plan when a manifest image is missing`, `skips renamed ROMs by SHA-1`, and `classifies the seven curated works as editions`. Assert edition suffix rules: `[K]`/`(K)` → `[한글판]`, `(J)`/`(Japan)` → `[일본판]`, `(U)`/`(USA)` → `[미국판]`, otherwise `[별도판]`.

- [ ] **Step 2: Run the planner test and verify RED**

Run: `npm test -- app/lib/archive-catalog.server.test.ts`

Expected: FAIL because `archive-catalog.server.ts` does not exist.

- [ ] **Step 3: Install the import tooling**

Install exact `fflate@0.8.3` as a dependency and exact `tsx@4.23.15` as a dev dependency; add `import:archive: "tsx scripts/import-archive.ts"`.

- [ ] **Step 4: Add the archive planning types and NES implementation**

Implement `planNesArchiveImport(...)`, `sha1File(path: string): Promise<string>`, and `editionSuffixFromRomName(name: string): string`. Read catalog identity from `assets/game_details.json`, cross-check `assets/game_image_mapping.json`, use `fflate@0.8.3` for the single `.nes` entry, validate iNES/NES2 magic, and derive IDs as `nes:fceux:<sha1>`. The curated file must contain exactly 닌자거북이3, 드래곤볼Z2, 드래곤볼Z3, 마이티 파이널 파이트, 열혈 격투전설, 열혈 신기록, and 칩 앤 데일2.

- [ ] **Step 5: Add the dry-run CLI**

Load existing `StoredGame` rows from the selected data directory and print candidate/duplicate/edition/error counts plus itemized reasons. Reject unknown flags and require absolute archive/data paths.

- [ ] **Step 6: Verify unit tests and the real dry-run**

Run: `npm test -- app/lib/archive-catalog.server.test.ts`

Expected: PASS.

Run: `npm run import:archive -- --kind nes --archive /home/gcjjyy/dosgamebox_archive --data-dir /home/gcjjyy/lab/nesbox-data --json`

Expected: `duplicate: 5`, `edition: 7`, `new: 21`, `candidate: 28`, `error: 0`, with no filesystem or DB change.

- [ ] **Step 7: Commit the planner**

```bash
git add app/lib/archive-catalog.server.ts app/lib/archive-catalog.server.test.ts scripts/archive-nes-variants.json scripts/import-archive.ts package.json package-lock.json
git commit -m "feat(import): plan NES archive migration"
```

### Task 2: Atomic NES import and live data migration

**Files:**
- Create: `app/lib/archive-import.server.ts`
- Create: `app/lib/archive-import.server.test.ts`
- Modify: `app/lib/library.server.ts`
- Modify: `app/lib/game-types.ts`
- Modify: `scripts/import-archive.ts`

**Interfaces:**
- Consumes: `ArchiveImportPlan` from Task 1.
- Produces: `initializeLibraryDb(database: Database.Database): void`, `listStoredGames(): StoredGame[]`, and `importGamesAtomic(records: ImportGameRecord[], database?: Database.Database): void`.
- Produces: `applyArchiveImport(plan: ArchiveImportPlan, options: { dataDir: string; database: Database.Database; dbPath: string }): Promise<ArchiveApplyReport>`.

- [ ] **Step 1: Write failing atomic-import tests**

Using temporary archive/data directories and SQLite, assert that `applyArchiveImport` preserves an existing row's `pinned`, `lastPlayedAt`, cover, and title; converts a valid cover to WebP; removes staging/final files and inserts zero rows when the second candidate has an invalid image; and reports zero additions on an identical second application.

- [ ] **Step 2: Run the import tests and verify RED**

Run: `npm test -- app/lib/archive-import.server.test.ts`

Expected: FAIL because the applier does not exist.

- [ ] **Step 3: Refactor database initialization and batch insertion**

Move schema setup behind `initializeLibraryDb`, add `listStoredGames`, and add `ImportGameRecord` with exact fields `id`, `title`, `fileName`, `system`, `emulatorId`, `size`, `romPath`, `coverPath`, and `originalTitle`. Batch insertion must use `INSERT ... ON CONFLICT(id) DO NOTHING`; it must not rewrite existing rows.

- [ ] **Step 4: Implement staged application and rollback**

Create a timestamped SQLite backup after a WAL checkpoint, stage every ROM and Sharp-produced WebP under a new temporary directory inside `dataDir`, verify source/destination hashes, then move and insert inside one guarded operation. On error, roll back SQLite, delete only files created by that invocation, retain the backup, and return its path in the report.

- [ ] **Step 5: Verify the atomic import tests**

Run: `npm test -- app/lib/archive-catalog.server.test.ts app/lib/archive-import.server.test.ts`

Expected: PASS.

- [ ] **Step 6: Apply NES to the live data directory**

Run: `npm run import:archive -- --kind nes --archive /home/gcjjyy/dosgamebox_archive --data-dir /home/gcjjyy/lab/nesbox-data --apply --json`

Expected: backup path exists, 28 rows/covers added, and NES count is 138.

- [ ] **Step 7: Verify the NES import is idempotent**

Run the same command without `--apply`.

Expected: zero candidates and 33 duplicates/previously imported items; no changes.

- [ ] **Step 8: Smoke-test imported NES games**

Run the existing FCEUX player for one standard imported ROM and `nes_DodgeDanpei2.zip` or `nes_Jump2Saikyouno7Nin.zip` (NES2 header), then verify cover responses are `image/webp`.

- [ ] **Step 9: Commit the NES import implementation**

```bash
git add app/lib/archive-import.server.ts app/lib/archive-import.server.test.ts app/lib/library.server.ts app/lib/game-types.ts scripts/import-archive.ts
git commit -m "feat(import): add NES archive games atomically"
```

### Task 3: Pinned EmulatorJS assets, arcade profiles, and licensing

**Files:**
- Create: `scripts/copy-emulatorjs-assets.ts`
- Create: `scripts/copy-emulatorjs-assets.test.ts`
- Create: `THIRD_PARTY_NOTICES.md`
- Create: `third_party/licenses/EmulatorJS-GPL-3.0.txt`
- Create: `third_party/licenses/MAME-2003-Plus.txt`
- Create: `third_party/licenses/FBNeo.txt`
- Create: `app/lib/emulator-registry.test.ts`
- Modify: `app/lib/emulator-registry.ts`
- Modify: `package.json`, `package-lock.json`, `.gitignore`, `LICENSE`, `README.md`

**Interfaces:**
- Produces profiles `mame2003-plus` (`coreName: "mame2003_plus"`) and `fbneo` (`coreName: "fbneo"`), both `system: "arcade"`, `runtime: "emulatorjs"`, and `status: "active"`.
- Produces: `copyEmulatorJsAssets(options: { projectRoot: string; destination: string }): Promise<void>`.
- Produces static base URL `/emulatorjs/data/` containing EmulatorJS data plus all four packaged `.data` variants for both cores.

- [ ] **Step 1: Write failing asset-copy and registry tests**

Build fake package trees and assert the copier recreates the destination, copies `loader.js`, `emulator.css`, localization/compression/src assets, and both core `.data` sets into `cores/`; assert a missing pinned source fails without leaving a partial destination. Assert both arcade profiles accept ZIPs only when their emulator ID is explicit and `defaultEmulatorForFile("game.zip")` returns `null` rather than guessing between MAME and FBNeo.

- [ ] **Step 2: Run the asset test and verify RED**

Run: `npm test -- scripts/copy-emulatorjs-assets.test.ts app/lib/emulator-registry.test.ts`

Expected: FAIL because the copier does not exist.

- [ ] **Step 3: Install the pinned EmulatorJS packages**

Install exactly `@emulatorjs/emulatorjs@4.2.3`, `@emulatorjs/core-mame2003_plus@4.2.3`, and `@emulatorjs/core-fbneo@4.2.3`.

- [ ] **Step 4: Implement local asset preparation**

Add `prepare:emulatorjs`, `predev`, and `prebuild` scripts; ignore `public/emulatorjs/data/`; use temporary-directory replacement so an interrupted copy never serves mixed versions.

- [ ] **Step 5: Add explicit arcade profiles**

Extend `EmulatorProfile` with `runtime` and `coreName`; keep current script profiles unchanged and reject ambiguous automatic `.zip` selection.

- [ ] **Step 6: Add application and third-party license material**

Replace root GPL v2 text and package metadata with `GPL-3.0-only`, add upstream license texts and source/version notices, and explicitly state the noncommercial deployment assumption for both arcade cores.

- [ ] **Step 7: Verify assets, profiles, and build**

Run: `npm test -- scripts/copy-emulatorjs-assets.test.ts app/lib/emulator-registry.test.ts app/lib/core-loader.test.ts && npm run prepare:emulatorjs && npm run typecheck && npm run build`

Expected: PASS; generated assets exist locally but `git status` does not list them.

- [ ] **Step 8: Commit the arcade runtime assets and notices**

```bash
git add scripts/copy-emulatorjs-assets.ts scripts/copy-emulatorjs-assets.test.ts THIRD_PARTY_NOTICES.md third_party app/lib/emulator-registry.ts app/lib/emulator-registry.test.ts package.json package-lock.json .gitignore LICENSE README.md
git commit -m "feat(arcade): vendor pinned EmulatorJS cores"
```

### Task 4: EmulatorJS `NesboxCore` adapter and player lifecycle

**Files:**
- Create: `app/lib/emulatorjs-core.ts`
- Create: `app/lib/emulatorjs-core.test.ts`
- Modify: `app/lib/core-contract.ts`
- Modify: `app/lib/core-loader.ts`, `app/lib/core-loader.test.ts`
- Modify: `app/lib/core-load-finalizer.ts`, `app/lib/core-load-finalizer.test.ts`
- Modify: `app/lib/library-client.ts`
- Create: `app/lib/library-client.test.ts`
- Modify: `app/lib/rom.ts`
- Modify: `app/components/EmulatorStage.tsx`
- Modify: `app/app.css`

**Interfaces:**
- Produces: `CoreMountTargets { canvas: HTMLCanvasElement; hostElement: HTMLElement }` and `createCore(emulatorId: EmulatorId, targets: CoreMountTargets): Promise<NesboxCore>`.
- Produces: `EmulatorJsBridge.mount(config: EmulatorJsMountConfig): Promise<EmulatorJsInstance>`; the bridge is the only code allowed to touch EJS globals/internal methods.
- Produces: `createEmulatorJsCore(profile: EmulatorProfile, hostElement: HTMLElement, bridge?: EmulatorJsBridge): Promise<NesboxCore>`.
- Produces: `fetchRomBytes(gameId: string, onProgress?: (loaded: number, total: number | null) => void): Promise<Uint8Array>`.

- [ ] **Step 1: Write failing adapter contract tests**

With a fake bridge, assert `loadRom` retains the original `shortname.zip`, `start` mounts once with `/emulatorjs/data/` and the profile's exact core name, pause/resume/reset/volume/state calls delegate, and `setButton` maps RetroPad `b/y/select/start/up/down/left/right/a/x/l/r` to indices `0..11`. Assert dispose during delayed mount destroys the late instance, removes host children, releases all pressed inputs, and revokes the Blob URL exactly once.

- [ ] **Step 2: Write failing streamed-ROM and deferred-start tests**

Mock a chunked `fetch` response with and without `Content-Length`; assert progress is monotonic, final bytes equal the concatenated chunks, a non-OK response throws, and the response is fetched exactly once. Extend `core-load-finalizer.test.ts` to assert `autoStart: false` returns a ready result without calling `start`, stale ready cores are disposed, and a later rejected user start is surfaced.

- [ ] **Step 3: Run adapter and client tests and verify RED**

Run: `npm test -- app/lib/emulatorjs-core.test.ts app/lib/library-client.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 4: Implement the stable adapter and browser bridge**

Set `EJS_core`, `EJS_gameName`, `EJS_gameUrl`, `EJS_pathtodata`, Korean locale, and disabled built-in keyboard/gamepad/touch/toolbars before loading local `loader.js`. Normalize EJS instance operations behind `EmulatorJsInstance`; throw explicit Korean errors for missing core assets, invalid ROM sets, memory failure, and unsupported state serialization.

- [ ] **Step 5: Add DOM-host routing and deferred arcade start**

Keep shared-audio preparation only in the script/FCEUX branch. Add `hostElement` beside the current canvas; for arcade, fetch/load the ROM, enter `ready`, and show a `게임 시작` overlay instead of auto-starting. The button calls `core.start()` from the user gesture. Use a 4:3 placeholder until the EJS canvas reports its dimensions, and make `displaySystem("arcade")` return `MAME / Arcade`. Switching routes or games must cancel pending fetch/mount work before creating the next core.

- [ ] **Step 6: Implement streamed progress and deferred-start finalization**

Read the ROM response body with `Content-Length`, emit monotonically increasing progress, and pass one resulting `Uint8Array` to the adapter without base64 or a second fetch. Implement the tested `autoStart: false` finalizer result and user-start error path.

- [ ] **Step 7: Verify focused tests and build**

Run: `npm test -- app/lib/emulatorjs-core.test.ts app/lib/library-client.test.ts app/lib/core-loader.test.ts app/lib/core-load-finalizer.test.ts && npm run typecheck && npm run build`

Expected: PASS.

- [ ] **Step 8: Verify the user-start lifecycle in a browser**

Opening a fixture arcade entry must show `게임 시작`; clicking creates one local EJS runtime, and leaving the route removes it.

- [ ] **Step 9: Commit the EmulatorJS integration**

```bash
git add app/lib/emulatorjs-core.ts app/lib/emulatorjs-core.test.ts app/lib/core-contract.ts app/lib/core-loader.ts app/lib/core-loader.test.ts app/lib/core-load-finalizer.ts app/lib/core-load-finalizer.test.ts app/lib/library-client.ts app/lib/library-client.test.ts app/lib/rom.ts app/components/EmulatorStage.tsx app/app.css
git commit -m "feat(arcade): integrate EmulatorJS runtime"
```

### Task 5: Arcade archive import and live catalog migration

**Files:**
- Modify: `app/lib/archive-catalog.server.ts`, `app/lib/archive-catalog.server.test.ts`
- Modify: `app/lib/archive-import.server.ts`, `app/lib/archive-import.server.test.ts`
- Modify: `scripts/import-archive.ts`
- Modify: `app/lib/game-types.ts`
- Modify: `app/routes/play.$gameId.tsx`

**Interfaces:**
- Produces: `planArcadeArchiveImport(options: { archiveRoot: string; existingGames: StoredGame[] }): Promise<ArchiveImportPlan>`.
- Preserves original ZIP shortname in `fileName` while storing hash-named `.zip` files.
- Generalizes `originalTitle` to “search/display source title”; arcade values are shortnames.

- [ ] **Step 1: Write failing arcade planner tests**

Assert `core: "mame"` maps to `mame2003-plus`, `core: "fbn"` maps to `fbneo`, both map to `system: "arcade"`, image aliases such as `cabalbl` can resolve through `game_image_mapping.json`, unknown cores fail preflight, and all candidates keep `<shortname>.zip` as `fileName`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- app/lib/archive-catalog.server.test.ts app/lib/archive-import.server.test.ts`

Expected: FAIL on unimplemented arcade planning.

- [ ] **Step 3: Implement arcade planning and reuse the atomic applier**

Read the original ZIP without extraction, SHA-1 it as a stream, require one valid mapped screenshot, convert the cover to WebP, and keep MAME/FBNeo as distinct emulator IDs. Update API type comments without changing existing NES `original_title` values.

- [ ] **Step 4: Verify the real arcade dry-run**

Run: `npm run import:archive -- --kind arcade --archive /home/gcjjyy/dosgamebox_archive --data-dir /home/gcjjyy/lab/nesbox-data --json`

Expected: 239 MAME 2003-Plus + 83 FBNeo candidates, 322 covers, zero errors.

- [ ] **Step 5: Apply arcade games to live data**

Run the same command with `--apply --json`.

Expected: a new backup, 322 additions, arcade count 322, total count 460.

- [ ] **Step 6: Verify idempotency and API assets**

Run a subsequent dry-run and expect zero additions. Check all 322 ROM and cover paths exist; API responses retain shortname filenames, ZIP byte sizes, and WebP content types. Strip both `romPath` and `coverPath` from play-route loader data and assert no server path appears in serialized responses.

- [ ] **Step 7: Commit the arcade catalog implementation**

```bash
git add app/lib/archive-catalog.server.ts app/lib/archive-catalog.server.test.ts app/lib/archive-import.server.ts app/lib/archive-import.server.test.ts app/lib/game-types.ts app/routes/play.\$gameId.tsx scripts/import-archive.ts
git commit -m "feat(import): add MAME and FBNeo catalog"
```

### Task 6: Shared NES/MAME input profiles and six-button runtime controls

**Files:**
- Create: `app/lib/control-profiles.ts`
- Create: `app/lib/control-profiles.test.ts`
- Create: `app/lib/storage.test.ts`
- Modify: `app/lib/storage.ts`
- Modify: `app/components/EmulatorStage.tsx`
- Modify: `app/components/TouchControls.tsx`
- Modify: `app/app.css`

**Interfaces:**
- Produces: `ControlProfileId = "nes" | "mame"`, `ControlBindings`, `KeyboardBindings`, `DEFAULT_KEY_BINDINGS`, `controlProfileForGame(game)`, `keyboardMapForProfile(bindings, profile)`, `gamepadMapForProfile(profile)`, and `keyCodeLabel(code)`.
- Produces: `createPressedInputTracker(send: (button: NesboxButton, pressed: boolean) => void)` with `set(button, pressed)` and `releaseAll()`.
- Produces: `createKeyboardInputRouter(options: { resolveButton(code: string): NesboxButton | undefined; send(button: NesboxButton, pressed: boolean): void; isSuspended(): boolean }): KeyboardInputRouter` with `keyDown`, `keyUp`, and `releaseAll`.
- Produces `UserSettings.keyBindingsVersion: 1` and `UserSettings.keyBindings` with safe migration.
- Maps MAME buttons 1–6 to `b`, `y`, `a`, `x`, `l`, `r`; keyboard defaults are `Z X C / A S D`, gamepad indices are `0..5`.

- [ ] **Step 1: Write failing profile and migration tests**

Assert exact NES/MAME default codes, MAME six-button gamepad mapping, MAME/FBNeo selecting the same `mame` profile, invalid or partial stored JSON filling only missing defaults while preserving volume/scale/touch, and duplicate codes within a profile being rejected. For the trackers, assert repeated down events do not resend presses, form/contenteditable or suspended input does not reach the core, and `releaseAll()` sends `false` once for every held button.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- app/lib/control-profiles.test.ts app/lib/storage.test.ts`

Expected: FAIL because profile bindings do not exist.

- [ ] **Step 3: Implement profiles and settings migration**

Use arrays of alternative codes per logical button so default Select/Coin accepts both `ShiftLeft` and `ShiftRight`; a captured custom key replaces that array with one code.

- [ ] **Step 4: Route keyboard and gamepad input through the trackers**

Route only assigned keys, ignore form/contenteditable targets, and call `releaseAll()` on blur, hidden visibility, profile change, and core disposal.

- [ ] **Step 5: Add MAME touch and gamepad layouts**

Keep the NES A/B/A+B face. For MAME render a 3×2 face labeled 1–6 plus Coin/Start, with pointer reference counting unchanged. Drive both layouts from `ControlProfileId` and keep the current stick behavior.

- [ ] **Step 6: Verify runtime inputs**

Run: `npm test -- app/lib/control-profiles.test.ts app/lib/storage.test.ts app/lib/touch-stick.test.ts && npm run typecheck && npm run build`

Expected: PASS. Manually verify NES Z/X and MAME Z/X/C/A/S/D plus standard gamepad buttons 0–5.

- [ ] **Step 7: Commit the shared control profiles**

```bash
git add app/lib/control-profiles.ts app/lib/control-profiles.test.ts app/lib/storage.ts app/lib/storage.test.ts app/components/EmulatorStage.tsx app/components/TouchControls.tsx app/app.css
git commit -m "feat(controls): add NES and MAME input profiles"
```

### Task 7: ALL/NES/MAME categories and scoped search

**Files:**
- Modify: `app/lib/catalog.ts`, `app/lib/catalog.test.ts`
- Modify: `app/components/GameLibrary.tsx`
- Modify: `app/app.css`

**Interfaces:**
- Produces: `CatalogCategory = "all" | "nes" | "mame"`, `catalogCategoryForGame(game)`, `catalogCounts(games)`, `arrangeGames(games, sort, query, category)`, and `filterRecentGames(recent, query, category)`.
- Category selection is independent of existing `all | recent` view selection.

- [ ] **Step 1: Write failing catalog-composition tests**

Use NES, MAME 2003-Plus, FBNeo, and unrelated SNES fixtures. Assert counts `all/nes/mame`, both arcade cores in MAME, query evaluated after category, pinned/sort behavior preserved, and recent input order preserved after category+query filtering.

- [ ] **Step 2: Run catalog tests and verify RED**

Run: `npm test -- app/lib/catalog.test.ts`

Expected: FAIL because category functions/signature do not exist.

- [ ] **Step 3: Implement the category and recent-list functions**

Filter category before query, then apply sort only to the all-games path. `filterRecentGames` must filter in place-of-order without sorting its input.

- [ ] **Step 4: Add the category controls to the library UI**

Add a separate default-ALL segmented control with search-independent counts, retain the query when categories change, and show the current result count. Empty states must distinguish no games, no recent games, and no matches in the selected category.

- [ ] **Step 5: Add arcade card treatment**

Render `NES` or `MAME` as the primary category label, `FBNeo` only as secondary core text, and use a landscape arcade-screen card class while leaving NES cartridge cards unchanged.

- [ ] **Step 6: Verify catalog behavior and build**

Run: `npm test -- app/lib/catalog.test.ts && npm run typecheck && npm run build`

Expected: PASS; live UI counts are ALL 460, NES 138, MAME 322.

- [ ] **Step 7: Commit the category UI**

```bash
git add app/lib/catalog.ts app/lib/catalog.test.ts app/components/GameLibrary.tsx app/app.css
git commit -m "feat(library): filter NES and MAME categories"
```

### Task 8: Core-specific welcome and help tabs

**Files:**
- Create: `app/components/ControlGuideTabs.tsx`
- Modify: `app/components/KeyboardLayoutPreview.tsx`
- Modify: `app/components/WelcomeDialog.tsx`
- Modify: `app/components/HelpDialog.tsx`
- Modify: `app/routes/_index.tsx`, `app/routes/play.$gameId.tsx`
- Modify: `app/app.css`

**Interfaces:**
- Produces: `ControlGuideTabs({ bindings, defaultProfile? }: { bindings: KeyboardBindings; defaultProfile?: ControlProfileId })`.
- `KeyboardLayoutPreview` consumes a profile and bindings; it contains no fixed keys.

- [ ] **Step 1: Add a failing guide-model test to `control-profiles.test.ts`**

Assert `controlGuideRows("nes", bindings)` emits directions, Select, Start, B, A and `controlGuideRows("mame", bindings)` emits directions, Coin, Start, and buttons 1–6 using current binding labels rather than defaults.

- [ ] **Step 2: Run the guide-model test and verify RED**

Run: `npm test -- app/lib/control-profiles.test.ts`

Expected: FAIL because guide rows do not exist.

- [ ] **Step 3: Implement the guide-row model**

Implement `controlGuideRows(profile, bindings)` in `control-profiles.ts` using `keyCodeLabel`; do not duplicate default key constants in components.

- [ ] **Step 4: Implement shared accessible guide tabs**

Use `tablist`, `tab`, and `tabpanel`, NES as the first/default tab, arrow-key tab navigation, and current settings bindings. Reuse the component in desktop welcome and help; keep mobile welcome concise and add the MAME six-button note.

- [ ] **Step 5: Pass bindings from both routes and verify**

Run: `npm test -- app/lib/control-profiles.test.ts && npm run typecheck && npm run build`

Expected: PASS. Keyboard-only navigation reaches both tabs and screen-reader names identify NES/MAME panels.

- [ ] **Step 6: Commit the guide UI**

```bash
git add app/components/ControlGuideTabs.tsx app/components/KeyboardLayoutPreview.tsx app/components/WelcomeDialog.tsx app/components/HelpDialog.tsx app/routes/_index.tsx app/routes/play.\$gameId.tsx app/lib/control-profiles.ts app/lib/control-profiles.test.ts app/app.css
git commit -m "feat(help): show core-specific control tabs"
```

### Task 9: Keyboard customization settings and live application

**Files:**
- Modify: `app/lib/control-profiles.ts`, `app/lib/control-profiles.test.ts`
- Modify: `app/components/SettingsSheet.tsx`
- Modify: `app/routes/_index.tsx`, `app/routes/play.$gameId.tsx`
- Modify: `app/components/EmulatorStage.tsx`
- Modify: `app/app.css`

**Interfaces:**
- Produces: `assignKey(bindings, profile, button, code): KeyAssignmentResult` and `resetKeyProfile(bindings, profile): KeyboardBindings`.
- Settings edits continue through existing `onChange(settings)` and become active from the next input event without core reload.
- `EmulatorStage` consumes `inputSuspended: boolean`; both routes pass `settingsOpen` so opening settings releases and suppresses game input.

- [ ] **Step 1: Write failing key-assignment tests**

Assert successful replacement, same-profile collision rejection without mutation, cross-profile reuse acceptance, `assignKey(..., "Escape")` returning `cancelled`, Control/Alt/Meta rejection, per-profile reset, unknown code normalization, and immutable results.

- [ ] **Step 2: Run profile tests and verify RED**

Run: `npm test -- app/lib/control-profiles.test.ts app/lib/storage.test.ts`

Expected: FAIL on missing assignment APIs.

- [ ] **Step 3: Implement key assignment and profile reset**

Return immutable `assigned`, `cancelled`, or `rejected` results. Reject collisions and reserved modifier codes without modifying the input; reset only the requested profile.

- [ ] **Step 4: Implement the settings capture UI**

Add Keyboard/NES/MAME sections after existing settings. Each required action button enters capture mode, Escape cancels, collision/reserved errors are announced with `role="alert"`, and `기본값 복원` resets only the active profile after confirmation. Do not expose removal of required bindings.

- [ ] **Step 5: Make live input read the latest settings**

Keep bindings in a ref updated on every render; keyboard listeners resolve the active profile against that ref per event. While a settings sheet or capture target is active, suppress game input and release held keys before capture begins.

- [ ] **Step 6: Verify persistence and live behavior**

Run: `npm test -- app/lib/control-profiles.test.ts app/lib/storage.test.ts && npm run typecheck && npm run build`

Expected: PASS. In-browser verification covers change, conflict, cancel, profile reset, refresh persistence, guide refresh, and an in-progress game using the new key without reload.

- [ ] **Step 7: Commit keyboard customization**

```bash
git add app/lib/control-profiles.ts app/lib/control-profiles.test.ts app/components/SettingsSheet.tsx app/components/EmulatorStage.tsx app/routes/_index.tsx app/routes/play.\$gameId.tsx app/app.css
git commit -m "feat(settings): customize core keyboard bindings"
```

### Task 10: Whole-system verification, documentation, and deployment

**Files:**
- Modify: `docs/emulator-architecture.md`
- Modify: `README.md`
- Modify: any prior-task file only when verification exposes a defect, with a regression test in its owning test file

**Interfaces:**
- Consumes every prior task; produces the deployed PM2 service and recorded verification evidence.

- [ ] **Step 1: Update architecture and operator documentation**

Document FCEUX vs EmulatorJS ownership, local asset preparation, noncommercial core terms, archive dry-run/apply/rollback commands, expected counts, control defaults, and the fact that ROM assets are not part of the repository.

- [ ] **Step 2: Run the complete automated gate**

Run: `npm test && npm run typecheck && npm run build && git diff --check`

Expected: every command exits 0.

- [ ] **Step 3: Audit live catalog and files before restart**

Query `/home/gcjjyy/lab/nesbox-data/nesbox.sqlite` and assert NES 138, arcade 322, total 460, MAME 2003-Plus 239, FBNeo 83, zero missing ROM paths, and zero missing cover paths. Retain the newest pre-import backup path in the handoff.

- [ ] **Step 4: Restart and probe the deployed service**

Run: `pm2 restart nesbox --update-env`, wait for online status, then probe `/api/games`, representative ROM endpoints, cover endpoints, and generated EmulatorJS assets on port 3757. No API response may expose a server filesystem path.

- [ ] **Step 5: Run representative browser smoke tests**

Verify imported NES standard + NES2, MAME `1942` (vertical), MAME `kof98` (Neo Geo), FBNeo `sf2ce` (six buttons), and FBNeo `mslug3` (80 MB). For arcade verify start gesture, progress, video/audio, Coin, Start, six buttons where applicable, pause/resume, reset, state support/error truthfulness, route disposal, and reload.

- [ ] **Step 6: Commit documentation or regression fixes**

```bash
git add README.md docs/emulator-architecture.md
git commit -m "docs: describe NES and arcade operation"
```

Record final commit IDs, test output, counts, backup path, PM2 status, and any per-game core limitations in the completion handoff.
