# NESBOX Explicit Audio Session Design

## Context

NESBOX currently decides whether to show its audio prompt with a delayed timer
and a desktop-Chrome user-agent exception. The prompt is not derived from the
FCEUX `AudioContext` state. The unlock function also catches resume failures and
returns no result, so the UI can claim success without knowing whether audio is
running. Route teardown closes the FCEUX context, which loses the audio state
during same-document React Router navigation.

## Required Behavior

- A fresh document starts with audio locked.
- Only the **탭하여 음소거 해제** button may perform the initial unlock.
- Canvas presses, controller presses, touch controls, keyboard input, and game
  startup must not perform the initial unlock.
- The prompt disappears only after the shared audio context reaches `running`.
- A failed or suspended context keeps, or restores, the prompt.
- React Router navigation and game changes reuse the unlocked session.
- A full reload creates a new locked session.

## Design

Add a browser-only audio-session module whose singleton lifetime matches the
loaded JavaScript document. It owns one shared `AudioContext`, exposes its
observable state, and provides an explicit `unlock()` operation. Creating or
retrieving the context does not resume it. Only `unlock()`, called by the prompt
button, may transition a never-unlocked session to running.

The FCEUX factory will receive the shared context through its runtime options.
The generated runtime already skips context construction when `_audioContext`
is supplied, so the wrapper can reuse the session context without modifying the
vendor-generated file. Core disposal will disconnect the core's processor but
will not close the session-owned context. A subsequently loaded game will
attach to the same context.

`EmulatorStage` will subscribe to the session's real state. Once a game is
running, it renders the prompt whenever the context is not running. The current
1.2-second timer and browser user-agent exception will be removed. The prompt
button will call the explicit session unlock and report success only after the
context reports `running`.

Implicit resume calls will be removed from game startup, stage pointer events,
keyboard input, and touch controls. Automatic recovery is allowed only after a
successful explicit unlock; it must never convert a fresh locked session into
an unlocked session.

## Error Handling

Unsupported Web Audio environments and rejected resumes leave the prompt
visible and surface a concise status message. Context `statechange` events are
the authority for UI state. Stale core loads and route teardown must unsubscribe
listeners and disconnect core-owned nodes without closing the shared context.

## Testing and Verification

Focused tests will cover the initial locked state, explicit-only unlock,
successful and rejected resumes, state subscriptions, and reuse of the same
context across simulated route/core changes. Existing tests, TypeScript checks,
and a production build must pass before deployment. After deployment, the
production site will be checked for fresh-load prompting, successful dismissal,
SPA persistence, and reload reset.
