# NES Title and Arcade Cabinet Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct NES card title priority, simplify keyboard settings into overview/edit states, apply a simple NESBOX library brand, and publish a review-only upright arcade cabinet page.

**Architecture:** A pure display helper owns NES primary and secondary card labels without touching stored data. The existing settings modal becomes a two-state overview/editor while retaining the current binding engine. A new React Router route renders an isolated semantic HTML/CSS cabinet preview; the live player remains unchanged.

**Tech Stack:** TypeScript, React 19, React Router 7, CSS, Vitest, Playwright smoke verification

**Spec:** `docs/superpowers/specs/2026-11-06-nes-title-arcade-cabinet-preview-design.md`

## Global Constraints

- Do not mutate SQLite game metadata.
- Do not change catalog search or sort behavior.
- Do not change key-binding persistence, collision handling, reserved keys, or defaults.
- Do not connect the preview to EmulatorJS, ROM loading, or input handlers.
- Do not add image or UI dependencies.
- Keep the live MAME player unchanged until the user approves the preview.

## Review Focus

- A missing/blank `originalTitle` must fall back to the filename stem, removing only the final extension.
- Non-NES cards must retain their current title presentation.
- Settings must reopen in overview while keeping edits already saved before returning from mapping mode.
- Long cabinet marquee and screen copy must not overflow the housing.
- Narrow screens must keep the joystick and all six buttons visible.

---

### Task 1: NES card title priority

**Files:**
- Create: `app/lib/game-display.ts`
- Create: `app/lib/game-display.test.ts`
- Modify: `app/components/GameLibrary.tsx`

**Interfaces:**
- Produces: `libraryCardLabels(game: Pick<GameEntry, "system" | "title" | "fileName" | "originalTitle">): { primary: string; secondary: string | null }`
- Consumes: `GameEntry` fields already returned by the library API.

- [ ] **Step 1: Write failing title-label tests**

  Cover a NES game with `originalTitle`, a missing/blank `originalTitle`, a
  multi-dot filename, and a non-NES game. Literal expectations must prove that
  original title wins and that fallback removes only the final extension.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `npm test -- app/lib/game-display.test.ts`

  Expected: FAIL because `libraryCardLabels` does not exist.

- [ ] **Step 3: Implement the helper and use it in `GameCard`**

  Use `labels.primary` for the primary text, accessible launch label, and
  generated cover label. Render `labels.secondary` only when it is distinct.

- [ ] **Step 4: Run focused and full tests**

  Run: `npm test -- app/lib/game-display.test.ts && npm test`

  Expected: all tests pass.

- [ ] **Step 5: Commit**

  Commit message: `fix(library): prefer NES metadata titles`

### Task 2: Two-state keyboard settings

**Files:**
- Create: `app/components/SettingsSheet.test.tsx`
- Modify: `app/components/SettingsSheet.tsx`
- Modify: `app/app.css`

**Interfaces:**
- Consumes: `KeyboardLayoutPreview`, `settings.keyBindings`, and the existing `assignKey` / `resetKeyProfile` functions.
- Produces: overview state with current keycap graphics and a dedicated NES/MAME mapping state.

- [ ] **Step 1: Write the overview and editor component assertions before changing behavior**

  Extract view-only keyboard sections that can be server-rendered with real
  bindings. Assert the overview contains the keycap graphic and `키 매핑 변경`,
  while the editor contains profile selection, action bindings, reset, and a
  return action.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `npm test -- app/components/SettingsSheet.test.tsx`

  Expected: FAIL because the two view states do not exist.

- [ ] **Step 3: Implement modal state transitions**

  Default to `overview`; switch to `mapping` from the overview button. In
  mapping mode show one active NES/MAME profile at a time, preserve existing
  key capture/collision behavior, and return without discarding saved edits.
  Closing the popup resets local view/capture state to overview.

- [ ] **Step 4: Run focused and full tests**

  Run: `npm test -- app/components/SettingsSheet.test.tsx && npm test`

  Expected: all tests pass.

- [ ] **Step 5: Browser-smoke the transition**

  Verify the settings popup opens on key graphics, the mapping button replaces
  its content with the editor, a changed key appears in the overview after
  returning, and reopening starts in overview.

- [ ] **Step 6: Commit**

  Commit message: `feat(settings): separate key mapping mode`

### Task 3: Arcade cabinet design preview

**Files:**
- Create: `app/routes/design.arcade-cabinet.tsx`
- Modify: `app/routes.ts`
- Modify: `app/app.css`

**Interfaces:**
- Produces: review route `/design/arcade-cabinet` with no loader or emulator dependencies.
- Consumes: existing NESBOX color variables and root typography.

- [ ] **Step 1: Add the preview route and semantic cabinet markup**

  Include the preview notice, marquee, CRT scene, speaker grille, instruction
  strip, joystick, Coin/Start controls, and six-button 2×3 layout.

- [ ] **Step 2: Add isolated responsive styles**

  Scope all rules under `.arcade-design-page`; preserve 4:3 screen proportions,
  use scanlines and glass reflections, and keep controls visible at 360px width.

- [ ] **Step 3: Run typecheck and production build**

  Run: `npm run typecheck && npm run build`

  Expected: both commands pass and the route is included in the build.

- [ ] **Step 4: Browser-review desktop and mobile layouts**

  Use Playwright at 1440×1000 and 390×844. Verify the preview notice, `NESBOX
  ARCADE` marquee, CRT, one joystick, six action buttons, and no EmulatorJS
  canvas or ROM request.

- [ ] **Step 5: Commit**

  Commit message: `feat(design): add arcade cabinet preview`

### Task 4: Simple live NESBOX brand and read-only library

**Files:**
- Create: `app/components/GameLibrary.test.tsx`
- Create: `app/routes/api.games.test.ts`
- Modify: `app/components/GameLibrary.tsx`
- Modify: `app/components/Toolbar.tsx`
- Modify: `app/routes/_index.tsx`
- Modify: `app/routes/play.$gameId.tsx`
- Modify: `app/routes/api.games.tsx`
- Modify: `app/lib/library-client.ts`
- Modify: `app/lib/library.server.ts`
- Modify: `app/app.css`
- Delete: `app/components/NesboxWordmark.tsx`
- Delete: `app/components/NesboxWordmark.test.tsx`
- Delete: `app/routes/design.nesbox-logo.tsx`

**Interfaces:**
- Produces: a live gamepad + NESBOX heading and a read-only game collection API.
- Removes: rejected wordmark preview, Add/OpenEmu controls, ROM picker, and POST mutations.

- [ ] **Step 1: Write and run the brand and read-only API contract tests**

  Assert that the library exposes the NESBOX brand without legacy import
  controls, and that POST `/api/games` returns 405 with `Allow: GET`.

- [ ] **Step 2: Apply the simple brand and remove mutation paths**

  Use the existing gamepad icon with plain NESBOX text. Remove rejected preview
  sources, file inputs, client calls, toolbar ROM-open control, and server mutations.

- [ ] **Step 3: Verify the live library**

  Run focused tests and typecheck, then verify the live heading and absence of
  OpenEmu, Add, and ROM-open controls in a browser.

- [ ] **Step 4: Commit**

  Commit message: `refactor(library): simplify brand and remove imports`

### Task 5: Publish the cabinet review page

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: the production build from Tasks 3 and 4.
- Produces: the live simple brand and PM2-served `/design/arcade-cabinet` review URL.

- [ ] **Step 1: Run final verification**

  Run: `npm test && npm run typecheck && npm run build`

  Expected: all tests, typecheck, and build pass.

- [ ] **Step 2: Restart the existing `nesbox` PM2 process**

  Run: `pm2 restart nesbox --update-env`

  Expected: process is `online` and points at the final commit.

- [ ] **Step 3: Smoke-test the deployed route**

  Verify `/design/arcade-cabinet` returns 200 and repeat the desktop browser
  assertions against port 3757.

- [ ] **Step 4: Hand off for visual review**

  Report the review URL and summarize what is intentionally not wired yet.
