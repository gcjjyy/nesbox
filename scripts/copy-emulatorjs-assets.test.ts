import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { copyEmulatorJsAssets } from "./copy-emulatorjs-assets";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("copyEmulatorJsAssets", () => {
  it("atomically replaces the destination with runtime and both complete core sets", async () => {
    const root = fixtureProject();
    const destination = path.join(root, "public", "emulatorjs", "data");
    mkdirSync(destination, { recursive: true });
    writeFileSync(path.join(destination, "stale.txt"), "stale");

    await copyEmulatorJsAssets({ projectRoot: root, destination });

    expect(existsSync(path.join(destination, "stale.txt"))).toBe(false);
    const loader = readFileSync(path.join(destination, "loader.js"), "utf8");
    expect(loader).toContain("window.__nesboxEmulatorJsSourcesLoaded");
    expect(loader).toContain("if (!window.__nesboxEmulatorJsSourcesLoaded)");
    expect(loader).toContain("window.__nesboxEmulatorJsSourcesLoaded = true");
    expect(readFileSync(path.join(destination, "emulator.css"), "utf8")).toBe("css");
    expect(existsSync(path.join(destination, "localization", "ko-KO.json"))).toBe(true);
    expect(existsSync(path.join(destination, "compression", "extractzip.js"))).toBe(true);
    expect(existsSync(path.join(destination, "src", "emulator.js"))).toBe(true);
    for (const core of ["mame2003_plus", "fbneo"]) {
      for (const variant of ["wasm", "legacy-wasm", "thread-wasm", "thread-legacy-wasm"]) {
        expect(existsSync(path.join(destination, "cores", `${core}-${variant}.data`))).toBe(true);
      }
      expect(readFileSync(path.join(destination, "cores", "reports", `${core}.json`), "utf8"))
        .toBe(`{"core":"${core}"}`);
    }
  });

  it("leaves the previous destination untouched when a pinned source is missing", async () => {
    const root = fixtureProject();
    const destination = path.join(root, "public", "emulatorjs", "data");
    mkdirSync(destination, { recursive: true });
    writeFileSync(path.join(destination, "known-good.txt"), "keep");
    rmSync(path.join(root, "node_modules", "@emulatorjs", "core-fbneo", "fbneo-wasm.data"));

    await expect(copyEmulatorJsAssets({ projectRoot: root, destination })).rejects.toThrow("fbneo-wasm.data");

    expect(readFileSync(path.join(destination, "known-good.txt"), "utf8")).toBe("keep");
    expect(existsSync(path.join(destination, "loader.js"))).toBe(false);
  });
});

function fixtureProject(): string {
  const root = mkdtempSync(path.join(tmpdir(), "nesbox-ejs-assets-"));
  roots.push(root);
  const runtime = path.join(root, "node_modules", "@emulatorjs", "emulatorjs", "data");
  write(runtime, "loader.js", `
    if (("undefined" != typeof EJS_DEBUG_XX && true === EJS_DEBUG_XX)) {
        for (let i = 0; i < scripts.length; i++) {
            await loadScript(scripts[i]);
        }
        await loadStyle("emulator.css");
    } else {
        await loadScript("emulator.min.js");
        await loadStyle("emulator.min.css");
    }
`);
  write(runtime, "emulator.css", "css");
  write(runtime, "localization/ko-KO.json", "{}");
  write(runtime, "compression/extractzip.js", "zip");
  write(runtime, "src/emulator.js", readFileSync("node_modules/@emulatorjs/emulatorjs/data/src/emulator.js", "utf8"));
  for (const [packageName, core] of [["core-mame2003_plus", "mame2003_plus"], ["core-fbneo", "fbneo"]]) {
    const packageRoot = path.join(root, "node_modules", "@emulatorjs", packageName);
    for (const variant of ["wasm", "legacy-wasm", "thread-wasm", "thread-legacy-wasm"]) {
      write(packageRoot, `${core}-${variant}.data`, `${core}-${variant}`);
    }
    write(packageRoot, `reports/${core}.json`, `{"core":"${core}"}`);
  }
  return root;
}

function write(root: string, relativePath: string, contents: string): void {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}
