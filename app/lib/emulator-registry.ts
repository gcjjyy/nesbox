import { extensionOf, type EmulatorId, type SystemId } from "./rom";

export interface EmulatorProfile {
  id: EmulatorId;
  system: SystemId;
  name: string;
  shortName: string;
  scriptUrl: string;
  wasmUrl: string;
  factoryName: "createNesboxNestopiaCore" | "createNesboxFceuxCore" | "createNesboxSnes9xCore" | (string & {});
  sourceUrl: string;
  license: string;
  extensions: string[];
  defaultForExtensions: string[];
  status: "planned" | "active";
}

export const EMULATOR_PROFILES: EmulatorProfile[] = [
  {
    id: "nestopia",
    system: "nes",
    name: "Nestopia UE libretro",
    shortName: "Nestopia",
    scriptUrl: "/cores/nesbox_nes.js",
    wasmUrl: "/cores/nesbox_nes.wasm",
    factoryName: "createNesboxNestopiaCore",
    sourceUrl: "https://github.com/libretro/nestopia",
    license: "GPLv2",
    extensions: ["nes", "fds", "unf", "unif"],
    defaultForExtensions: [],
    status: "planned",
  },
  {
    id: "fceux",
    system: "nes",
    name: "FCEUX Emscripten",
    shortName: "FCEUX",
    scriptUrl: "/cores/nesbox_fceux.js",
    wasmUrl: "/cores/vendor/fceux.wasm",
    factoryName: "createNesboxFceuxCore",
    sourceUrl: "https://github.com/TASEmulators/fceux",
    license: "GPL-2.0",
    extensions: ["nes", "fds"],
    defaultForExtensions: ["nes", "fds"],
    status: "active",
  },
  {
    id: "snes9x",
    system: "snes",
    name: "Snes9x libretro",
    shortName: "Snes9x",
    scriptUrl: "/cores/nesbox_snes.js",
    wasmUrl: "/cores/nesbox_snes.wasm",
    factoryName: "createNesboxSnes9xCore",
    sourceUrl: "https://github.com/snes9xgit/snes9x",
    license: "Snes9x custom non-commercial license",
    extensions: ["sfc", "smc", "fig", "swc"],
    defaultForExtensions: ["sfc", "smc", "fig", "swc"],
    status: "planned",
  },
];

export function emulatorById(id: EmulatorId): EmulatorProfile | null {
  return EMULATOR_PROFILES.find((profile) => profile.id === id) ?? null;
}

export function emulatorsForExtension(fileName: string): EmulatorProfile[] {
  const ext = extensionOf(fileName);
  return EMULATOR_PROFILES.filter((profile) => profile.extensions.includes(ext));
}

export function defaultEmulatorForFile(fileName: string): EmulatorProfile | null {
  const ext = extensionOf(fileName);
  return (
    EMULATOR_PROFILES.find((profile) => profile.defaultForExtensions.includes(ext)) ??
    emulatorsForExtension(fileName)[0] ??
    null
  );
}

export function systemForEmulator(id: EmulatorId): SystemId | null {
  return emulatorById(id)?.system ?? null;
}
