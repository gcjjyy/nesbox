# NES Title and Arcade Cabinet Preview Design

## Intent

NES library cards should lead with the meaningful game title instead of the
ROM filename-derived label. MAME library entries should read as arcade hardware
in the same way NES entries read as cartridges. This change stops at a
reviewable grid-card page so the visual direction can be approved first.

## Goals

- For NES cards, use a non-empty `originalTitle` as the primary line.
- When `originalTitle` is missing, use the ROM filename without its extension.
- Keep the filename-derived label as the secondary line only when a distinct
  original title exists.
- Keep the settings popup in a readable overview state by default, showing the
  current NES/MAME mappings with the existing keycap graphics.
- Enter a dedicated key-mapping state only after the user presses
  `키 매핑 변경`.
- Add a review-only page at `/design/arcade-cabinet`.
- Replace `Game Library` directly with a simple gamepad icon and `NESBOX` text.
- Remove the rejected typography preview and its route.
- Remove Add, OpenEmu, and ROM-open controls together with their mutation APIs.
- Match the NES cartridge image footprint exactly at `1060:704`.
- Keep only a black 4:3 CRT bezel and a shallow control deck with a red
  ball-top joystick and six action buttons.
- Show the proposed MAME card beside NES cartridge samples in an actual grid.
- Make the preview responsive enough to review on desktop and mobile.

## Non-goals

- Do not migrate or rewrite SQLite game metadata.
- Do not change catalog search or sort behavior in this preview round.
- Do not change key-binding persistence, collision rules, reserved keys, or
  default mappings.
- Do not connect EmulatorJS, keyboard input, touch input, or live ROM data to
  the card preview.
- Do not include a marquee, speaker band, coin door, vents, or lower cabinet.
- Do not replace the existing live MAME grid card until the preview is approved.

## Constraints

- Preserve the current NESBOX dark, cream, and red visual identity.
- Build the compact card from semantic React markup and CSS; do not add a new
  image or UI dependency.
- Clearly label the page as a design preview so it cannot be mistaken for the
  live player.
- Reuse the existing gamepad icon vocabulary and keep the live brand intentionally
  plain; this change does not need another logo review round.
- The key-mapping state uses NES/MAME tabs, retains the existing per-action
  capture buttons and reset action, and offers an explicit return to the main
  settings state.

## Approaches

### Selected: view-layer title helper and compact HTML/CSS arcade grid card

Derive the two NES card lines in a small display helper and leave stored data
unchanged. Build the proposed MAME tile at the exact NES cartridge shape ratio,
then place both in the same review grid. The tile keeps only the CRT and control
deck from the cabinet reference, which makes it reusable in the live catalog.

For settings, keep one modal and switch its content between two explicit
states. The overview reuses the existing keycap preview, while the mapping
state contains the editable bindings. This avoids a nested modal and keeps the
current bindings visible without exposing all editing controls all the time.

### Rejected: normalize titles in SQLite

This could make every consumer see the same title, but it would mutate existing
metadata and could alter sorting, searching, and future re-import behavior.

### Rejected: full cabinet, player background, static image, or canvas mockup

A full upright cabinet spends too much vertical space on the marquee and lower
body and solves the wrong surface: the request is for the library grid. A static
image would also provide little reusable structure for live catalog cards.

### Rejected: always-expanded or nested key editor

The current always-expanded editor makes the main settings popup too dense. A
second nested modal would add focus and dismissal complexity, so the same popup
changes state instead.

## Review contract

The user reviews only the visual preview in this round. Approval of the page is
required before replacing the live MAME card shell.
