import { cp, mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

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

  await requirePath(path.join(runtimeSource, "loader.js"));
  await requirePath(path.join(runtimeSource, "emulator.css"));
  for (const item of coreSources) await requirePath(item.source);

  await mkdir(path.dirname(destination), { recursive: true });
  const nonce = `${process.pid}-${Date.now()}`;
  const staging = path.join(path.dirname(destination), `.${path.basename(destination)}.staging-${nonce}`);
  const previous = path.join(path.dirname(destination), `.${path.basename(destination)}.previous-${nonce}`);
  let previousMoved = false;
  try {
    await rm(staging, { recursive: true, force: true });
    await cp(runtimeSource, staging, { recursive: true });
    const coresDirectory = path.join(staging, "cores");
    await mkdir(coresDirectory, { recursive: true });
    for (const item of coreSources) await cp(item.source, path.join(coresDirectory, item.fileName));

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
