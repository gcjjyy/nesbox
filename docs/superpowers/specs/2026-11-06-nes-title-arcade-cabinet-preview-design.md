# NES Title and Arcade Cabinet Preview Design

## Intent

NES library cards should lead with the meaningful game title instead of the
ROM filename-derived label. MAME should eventually feel like playing at an
upright arcade cabinet, but this change stops at a reviewable design page so
the visual direction can be approved before the real player is changed.

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
- Show a 1990s black upright cabinet with a marquee, CRT screen, sloped control
  deck, red ball-top joystick, Coin/Start controls, and six action buttons.
- Make the preview responsive enough to review on desktop and mobile.

## Non-goals

- Do not migrate or rewrite SQLite game metadata.
- Do not change catalog search or sort behavior in this preview round.
- Do not change key-binding persistence, collision rules, reserved keys, or
  default mappings.
- Do not connect EmulatorJS, keyboard input, touch input, or live ROM data to
  the cabinet preview.
- Do not replace the existing MAME player until the preview is approved.

## Constraints

- Preserve the current NESBOX dark, cream, and red visual identity.
- Build the cabinet from semantic React markup, CSS, and an inline decorative
  SVG; do not add a new image or UI dependency.
- Clearly label the page as a design preview so it cannot be mistaken for the
  live player.
- Reuse the existing gamepad icon vocabulary and keep the live brand intentionally
  plain; this change does not need another logo review round.
- The key-mapping state uses NES/MAME tabs, retains the existing per-action
  capture buttons and reset action, and offers an explicit return to the main
  settings state.

## Approaches

### Selected: view-layer title helper and HTML/CSS upright cabinet

Derive the two NES card lines in a small display helper and leave stored data
unchanged. Build the cabinet as responsive markup that can later wrap the real
emulator viewport and controls. This is the safest data change and the most
useful prototype for the eventual implementation.

For settings, keep one modal and switch its content between two explicit
states. The overview reuses the existing keycap preview, while the mapping
state contains the editable bindings. This avoids a nested modal and keeps the
current bindings visible without exposing all editing controls all the time.

### Rejected: normalize titles in SQLite

This could make every consumer see the same title, but it would mutate existing
metadata and could alter sorting, searching, and future re-import behavior.

### Rejected: static cabinet image or canvas-only mockup

This would be quick to draw, but it would not exercise responsive layout and
would provide little reusable structure for the eventual player.

### Rejected: always-expanded or nested key editor

The current always-expanded editor makes the main settings popup too dense. A
second nested modal would add focus and dismissal complexity, so the same popup
changes state instead.

## Review contract

The user reviews only the visual preview in this round. Approval of the page is
required before replacing the live MAME player shell or wiring its controls.
