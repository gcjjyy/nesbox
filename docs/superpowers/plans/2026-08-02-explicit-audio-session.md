# NESBOX Explicit Audio Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the NESBOX audio prompt the sole initial audio activator, keep the successful activation across React Router navigation, and render the prompt from the real shared `AudioContext` state.

**Architecture:** A document-scoped `AudioSession` owns one Web Audio context and exposes a subscribable state plus an explicit `unlock()` method. FCEUX receives that context instead of creating and closing its own; `EmulatorStage` observes the session and contains no timer, browser sniff, or implicit input unlock.

**Tech Stack:** TypeScript 5.9, React 19, React Router 7, Vitest 2, FCEUX Emscripten wrapper, Web Audio API

## Global Constraints

- Only the **탭하여 음소거 해제** button may perform the initial unlock.
- Canvas, controller, touch-control, keyboard, startup, and other page events must not perform the initial unlock.
- Same-document route and game changes reuse the successful audio session; full reload resets it.
- UI visibility follows actual audio state, without user-agent exceptions or arbitrary timers.
- Do not modify `public/cores/vendor/fceux.js`.

## File Map

- Create `app/lib/audio-session.ts`: document-scoped audio state machine and shared context owner.
- Create `app/lib/audio-session.test.ts`: real state-machine behavior with a controllable Web Audio boundary fake.
- Create `app/lib/use-audio-session-state.ts`: React `useSyncExternalStore` adapter.
- Create `app/lib/fceux-core.test.ts`: execute the actual browser wrapper and protect context reuse/ownership.
- Modify `app/lib/core-contract.ts`: add the shared context to runtime factory options.
- Modify `app/lib/core-loader.ts`: pass the singleton context to every core factory.
- Modify `public/cores/nesbox_fceux.js`: consume but never close the shared context and remove startup resume.
- Modify `app/components/EmulatorStage.tsx`: derive prompt state and make the prompt button the only unlock caller.

---

### Task 1: Document-scoped audio session

**Files:**
- Create: `app/lib/audio-session.test.ts`
- Create: `app/lib/audio-session.ts`
- Create: `app/lib/use-audio-session-state.ts`

**Interfaces:**
- Produces: `AudioSession`, `AudioSessionState`, `audioSession`, and `audioPromptRequired(engineReady, state)`.
- Produces: `useAudioSessionState(): AudioSessionState`.
- Consumes: a factory with signature `() => AudioContext` so tests can control the browser boundary.

- [ ] **Step 1: Write failing state-machine tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { AudioSession, audioPromptRequired } from "./audio-session";

class FakeAudioContext extends EventTarget {
  state: AudioContextState = "suspended";
  resumeError: Error | null = null;
  resume = vi.fn(async () => {
    if (this.resumeError) throw this.resumeError;
    this.state = "running";
    this.dispatchEvent(new Event("statechange"));
  });
  suspend = vi.fn(async () => {
    this.state = "suspended";
    this.dispatchEvent(new Event("statechange"));
  });
}

function makeSession() {
  const context = new FakeAudioContext();
  const session = new AudioSession(() => context as unknown as AudioContext);
  return { context, session };
}

describe("AudioSession", () => {
  it("stays locked when code only acquires the context", () => {
    const { context, session } = makeSession();
    expect(session.getContext()).toBe(context);
    expect(context.resume).not.toHaveBeenCalled();
    expect(session.getSnapshot()).toBe("locked");
    expect(audioPromptRequired(true, session.getSnapshot())).toBe(true);
  });

  it("suspends a context that auto-runs before explicit unlock", async () => {
    const { context, session } = makeSession();
    context.state = "running";
    session.getContext();
    await Promise.resolve();
    expect(context.suspend).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot()).toBe("locked");
  });

  it("reports running only after the explicit unlock succeeds", async () => {
    const { context, session } = makeSession();
    await expect(session.unlock()).resolves.toBe(true);
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot()).toBe("running");
    expect(audioPromptRequired(true, session.getSnapshot())).toBe(false);
  });

  it("remains locked after a rejected initial unlock", async () => {
    const { context, session } = makeSession();
    context.resumeError = new Error("blocked");
    await expect(session.unlock()).resolves.toBe(false);
    expect(session.getSnapshot()).toBe("locked");
  });

  it("reuses the same context across consumers and emits later suspension", async () => {
    const { context, session } = makeSession();
    const states: string[] = [];
    session.subscribe(() => states.push(session.getSnapshot()));
    await session.unlock();
    context.state = "suspended";
    context.dispatchEvent(new Event("statechange"));
    expect(session.getContext()).toBe(context);
    expect(states.at(-1)).toBe("suspended");
    expect(audioPromptRequired(true, session.getSnapshot())).toBe(true);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- app/lib/audio-session.test.ts`

Expected: FAIL because `./audio-session` does not exist.

- [ ] **Step 3: Implement the minimal audio session**

Implement `AudioSession` with these exact public methods:

```ts
export type AudioSessionState = "locked" | "running" | "suspended" | "interrupted" | "closed" | "unavailable";

export class AudioSession {
  constructor(createContext?: () => AudioContext);
  getContext(): AudioContext;
  unlock(): Promise<boolean>;
  getSnapshot: () => AudioSessionState;
  subscribe: (listener: () => void) => () => void;
}

export const audioSession: AudioSession;
export function audioPromptRequired(engineReady: boolean, state: AudioSessionState): boolean;
```

`getContext()` must lazily create exactly one context without calling `resume()`.
If construction yields a context that is already `running`, the session must
call `suspend()` and remain `locked`; a state-change listener must enforce the
same rule for any unexpected pre-unlock transition. An in-progress explicit
unlock is exempt from that guard.
`unlock()` must set the session as explicitly unlocked only when the context is
actually `running`; a rejected initial resume returns `false` and leaves the
snapshot `locked`. Context `statechange` events notify subscribers. The default
factory uses `AudioContext` or `webkitAudioContext` and records `unavailable`
before throwing when neither exists.

Implement the React adapter as:

```ts
import { useSyncExternalStore } from "react";
import { audioSession, type AudioSessionState } from "./audio-session";

export function useAudioSessionState(): AudioSessionState {
  return useSyncExternalStore(audioSession.subscribe, audioSession.getSnapshot, () => "locked");
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- app/lib/audio-session.test.ts`

Expected: PASS with five tests.

- [ ] **Step 5: Commit the state-machine task**

```bash
git add app/lib/audio-session.ts app/lib/audio-session.test.ts app/lib/use-audio-session-state.ts
git commit -m "feat(audio): add document audio session"
```

### Task 2: Make FCEUX consume the shared context

**Files:**
- Create: `app/lib/fceux-core.test.ts`
- Modify: `app/lib/core-contract.ts:33-57`
- Modify: `app/lib/core-loader.ts:9-20`
- Modify: `public/cores/nesbox_fceux.js:55-208`

**Interfaces:**
- Consumes: `audioSession.getContext(): AudioContext` from Task 1.
- Produces: `CoreRuntimeOptions.audioContext: AudioContext`.
- Preserves: existing `NesboxCore` load, input, save-state, and disposal methods.

- [ ] **Step 1: Write a failing executable wrapper test**

The test must load `public/cores/nesbox_fceux.js` with `node:vm`, provide a
complete fake FCEUX module, call the registered factory, and assert consumer
behavior rather than source text:

```ts
it("reuses the supplied context without resuming on start or closing on dispose", async () => {
  const sharedContext = {
    state: "suspended",
    resume: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
  const { factory, receivedModuleOptions } = await loadFceuxWrapperWithFakeModule();
  const core = await factory({
    canvas: fakeCanvas(),
    wasmUrl: "/cores/vendor/fceux.wasm",
    audioContext: sharedContext as unknown as AudioContext,
  });

  expect(receivedModuleOptions()._audioContext).toBe(sharedContext);
  core.start();
  expect(sharedContext.resume).not.toHaveBeenCalled();
  core.dispose();
  expect(sharedContext.close).not.toHaveBeenCalled();
});
```

`loadFceuxWrapperWithFakeModule()` lives in the test file. It reads the wrapper,
executes it with `runInNewContext`, supplies `window.FCEUX`, `CSS.escape`,
`requestAnimationFrame`, `cancelAnimationFrame`, `TextEncoder`, `TextDecoder`,
`btoa`, and `atob`, and returns the real registered factory plus the options
captured by the fake FCEUX call.

- [ ] **Step 2: Run the wrapper test and verify RED**

Run: `npm test -- app/lib/fceux-core.test.ts`

Expected: FAIL because the wrapper neither forwards `audioContext` as
`_audioContext` nor preserves it during start/disposal.

- [ ] **Step 3: Implement shared-context ownership**

Add `audioContext: AudioContext` to `CoreRuntimeOptions`. Pass
`audioSession.getContext()` from `createCore()`. Pass that value into FCEUX as
`_audioContext: options.audioContext`. Remove the `resumeAudio()` call from
`startLoop()` and remove the context `close()` block from `dispose()`. Continue
disconnecting `scriptProcessorNode`, because that node belongs to the core.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npm test -- app/lib/audio-session.test.ts app/lib/fceux-core.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the FCEUX integration**

```bash
git add app/lib/core-contract.ts app/lib/core-loader.ts app/lib/fceux-core.test.ts public/cores/nesbox_fceux.js
git commit -m "fix(audio): reuse session context in fceux"
```

### Task 3: Drive the NES prompt from the real session

**Files:**
- Modify: `app/components/EmulatorStage.tsx:1-440`
- Modify: `app/lib/core-contract.ts:41-55` if the unused `resumeAudio` member remains after Task 2.

**Interfaces:**
- Consumes: `useAudioSessionState()`, `audioSession.unlock()`, and `audioPromptRequired()` from Task 1.
- Produces: prompt visibility equal to `audioPromptRequired(phase === "running", audioState)`.

- [ ] **Step 1: Confirm the prompt-policy coverage before UI refactoring**

Add literal assertions to `audio-session.test.ts`:

```ts
it("does not prompt before an engine is ready", () => {
  expect(audioPromptRequired(false, "locked")).toBe(false);
  expect(audioPromptRequired(false, "suspended")).toBe(false);
});
```

- [ ] **Step 2: Run the policy test as the refactoring safety net**

Run: `npm test -- app/lib/audio-session.test.ts`

Expected: PASS. The policy was introduced test-first in Task 1; this task only
replaces duplicated component state with that tested policy.

- [ ] **Step 3: Replace timer and implicit activation paths**

In `EmulatorStage`:

- remove `isDesktopChrome`, `audioPromptTimerRef`, `audioPromptVisible` state,
  `clearAudioPromptTimer`, and `scheduleAudioPrompt`;
- remove `resumeAudio` calls from physical keyboard and touch-control handlers;
- remove the stage `onPointerDown` unlock handler;
- read `audioState` with `useAudioSessionState()`;
- compute `audioPromptVisible` with
  `audioPromptRequired(phase === "running", audioState)`;
- make `unlockAudio()` call only `audioSession.unlock()` and report success only
  when it returns `true`;
- leave the prompt visible on `false` or thrown errors;
- remove `resumeAudio` from `NesboxCore` and from the FCEUX return object once no
  caller remains.

- [ ] **Step 4: Run all NESBOX verification**

Run: `npm test`

Expected: all tests PASS.

Run: `npm run typecheck`

Expected: PASS with no diagnostics.

Run: `npm run build`

Expected: production client and server bundles build successfully.

- [ ] **Step 5: Commit the UI behavior**

```bash
git add app/components/EmulatorStage.tsx app/lib/core-contract.ts app/lib/audio-session.test.ts public/cores/nesbox_fceux.js
git commit -m "fix(audio): require explicit session unlock"
```

### Task 4: Deploy and smoke-check NESBOX

**Files:**
- No source files.

**Interfaces:**
- Consumes: verified commits from Tasks 1-3.
- Produces: the production deployment at `https://nesbox.oscc.kr/`.

- [ ] **Step 1: Confirm the local and pcnhost worktrees are clean**

Run locally: `git status --short --branch`

Run on pcnhost in `/home/gcjjyy/lab/nesbox`: `git status --short --branch`

Expected: no uncommitted paths in either checkout.

- [ ] **Step 2: Push and fast-forward pcnhost**

Run locally: `git push origin main`

Run on pcnhost: `git pull --ff-only origin main`

Expected: both checkouts point at the same implementation commit.

- [ ] **Step 3: Build and restart production**

Run on pcnhost:

```bash
npm install
npm test
npm run typecheck
npm run build
pm2 restart nesbox
pm2 show nesbox
```

Expected: commands succeed and PM2 reports `nesbox` online.

- [ ] **Step 4: Verify HTTP and interactive behavior**

Run: `curl -fsS -o /dev/null -w '%{http_code}\n' https://nesbox.oscc.kr/`

Expected: `200`.

In a connected browser, verify: fresh load shows the prompt after a game starts;
canvas/keyboard/touch input does not dismiss it; the prompt button enables sound
and disappears; library-to-game SPA navigation keeps it dismissed; full reload
shows it again.
