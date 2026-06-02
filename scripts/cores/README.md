# Core Build Notes

The app already expects bridge files under `public/cores`.

Recommended build order:

1. Build a NES core first, preferably Nestopia UE libretro or FCEUX with Emscripten.
2. Wrap the generated module in `window.createNesboxNestopiaCore(options)`.
3. Implement the `NesboxCore` contract from `app/lib/core-contract.ts`.
4. Repeat for Snes9x under `window.createNesboxSnes9xCore(options)`.

Do not bind emulator UI directly inside the generated Emscripten shell. Keep video, audio, input, and save-state control behind the TypeScript contract so game cards can choose an exact emulator by `emulatorId`.
