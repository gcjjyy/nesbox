import { cp, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { patchEmulatorJsCoreCache } from "./emulatorjs-core-cache";

const CORE_PACKAGES = [
  { packageName: "core-mame2003_plus", coreName: "mame2003_plus" },
  { packageName: "core-fbneo", coreName: "fbneo" },
] as const;
const CORE_VARIANTS = ["wasm", "legacy-wasm", "thread-wasm", "thread-legacy-wasm"] as const;

export async function copyEmulatorJsAssets(options: {
  projectRoot: string;
  destination: string;
}): Promise<void> {
  const projectRoot = path.resolve(options.projectRoot);
  const destination = path.resolve(options.destination);
  const runtimeSource = path.join(projectRoot, "node_modules", "@emulatorjs", "emulatorjs", "data");
  const coreSources = CORE_PACKAGES.flatMap(({ packageName, coreName }) =>
    CORE_VARIANTS.map((variant) => ({
      source: path.join(projectRoot, "node_modules", "@emulatorjs", packageName, `${coreName}-${variant}.data`),
      fileName: `${coreName}-${variant}.data`,
    })),
  );
  const reportSources = CORE_PACKAGES.map(({ packageName, coreName }) => ({
    source: path.join(
      projectRoot,
      "node_modules",
      "@emulatorjs",
      packageName,
      "reports",
      `${coreName}.json`,
    ),
    fileName: `${coreName}.json`,
  }));

  await requirePath(path.join(runtimeSource, "loader.js"));
  await requirePath(path.join(runtimeSource, "emulator.css"));
  for (const item of coreSources) await requirePath(item.source);
  for (const item of reportSources) await requirePath(item.source);

  await mkdir(path.dirname(destination), { recursive: true });
  const nonce = `${process.pid}-${Date.now()}`;
  const staging = path.join(path.dirname(destination), `.${path.basename(destination)}.staging-${nonce}`);
  const previous = path.join(path.dirname(destination), `.${path.basename(destination)}.previous-${nonce}`);
  let previousMoved = false;
  try {
    await rm(staging, { recursive: true, force: true });
    await cp(runtimeSource, staging, { recursive: true });
    await patchLoaderForRepeatMount(path.join(staging, "loader.js"));
    const emulatorPath = path.join(staging, "src", "emulator.js");
    await writeFile(emulatorPath, patchEmulatorJsCoreCache(await readFile(emulatorPath, "utf8")));
    const coresDirectory = path.join(staging, "cores");
    await mkdir(coresDirectory, { recursive: true });
    for (const item of coreSources) await cp(item.source, path.join(coresDirectory, item.fileName));
    const reportsDirectory = path.join(coresDirectory, "reports");
    await mkdir(reportsDirectory, { recursive: true });
    for (const item of reportSources) await cp(item.source, path.join(reportsDirectory, item.fileName));

    if (await pathExists(destination)) {
      await rename(destination, previous);
      previousMoved = true;
    }
    await rename(staging, destination);
    if (previousMoved) await rm(previous, { recursive: true, force: true });
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    if (previousMoved && !await pathExists(destination) && await pathExists(previous)) {
      await rename(previous, destination);
    }
    throw error;
  }
}

const DEBUG_LOADER_BRANCH = `    if (("undefined" != typeof EJS_DEBUG_XX && true === EJS_DEBUG_XX)) {
        for (let i = 0; i < scripts.length; i++) {
            await loadScript(scripts[i]);
        }
        await loadStyle("emulator.css");
    } else {`;

const REPEAT_SAFE_DEBUG_LOADER_BRANCH = `    if (("undefined" != typeof EJS_DEBUG_XX && true === EJS_DEBUG_XX)) {
        // The readable runtime declares global classes. Loading it twice in one SPA
        // document raises duplicate-declaration errors, so retain it across mounts.
        if (!window.__nesboxEmulatorJsSourcesLoaded) {
            for (let i = 0; i < scripts.length; i++) {
                await loadScript(scripts[i]);
            }
            await loadStyle("emulator.css");
            window.__nesboxEmulatorJsSourcesLoaded = true;
        }
    } else {`;

async function patchLoaderForRepeatMount(loaderPath: string): Promise<void> {
  const source = await readFile(loaderPath, "utf8");
  if (!source.includes(DEBUG_LOADER_BRANCH)) {
    throw new Error(`unsupported pinned EmulatorJS loader layout: ${loaderPath}`);
  }
  await writeFile(loaderPath, source.replace(DEBUG_LOADER_BRANCH, REPEAT_SAFE_DEBUG_LOADER_BRANCH));
}

async function requirePath(filePath: string): Promise<void> {
  try {
    await stat(filePath);
  } catch (error) {
    throw new Error(`missing pinned EmulatorJS asset: ${filePath}`, { cause: error });
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const destination = path.join(projectRoot, "public", "emulatorjs", "data");
  await copyEmulatorJsAssets({ projectRoot, destination });
  console.log(`Prepared EmulatorJS 4.2.3 assets at ${destination}`);
}

const entryUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entryUrl) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
