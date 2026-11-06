import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Database from "better-sqlite3";
import {
  planArcadeArchiveImport,
  planNesArchiveImport,
  type ArchiveImportKind,
  type ArchiveImportPlan,
} from "../app/lib/archive-catalog.server";
import { applyArchiveImport, type ArchiveApplyReport } from "../app/lib/archive-import.server";
import type { StoredGame } from "../app/lib/game-types";
import { initializeLibraryDb, listStoredGames } from "../app/lib/library.server";

export interface ArchiveImportArgs {
  kind: ArchiveImportKind;
  archiveRoot: string;
  dataDir: string;
  json: boolean;
  apply: boolean;
}

export function parseArchiveImportArgs(argv: string[]): ArchiveImportArgs {
  let kind: ArchiveImportKind | undefined;
  let archiveRoot: string | undefined;
  let dataDir: string | undefined;
  let json = false;
  let apply = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      json = true;
      continue;
    }
    if (argument === "--apply") {
      apply = true;
      continue;
    }
    const value = argv[index + 1];
    if (argument === "--kind") {
      if (value !== "nes" && value !== "arcade") throw new Error("--kind must be nes or arcade");
      kind = value;
      index += 1;
      continue;
    }
    if (argument === "--archive") {
      if (!value) throw new Error("--archive requires a path");
      archiveRoot = value;
      index += 1;
      continue;
    }
    if (argument === "--data-dir") {
      if (!value) throw new Error("--data-dir requires a path");
      dataDir = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${argument}`);
  }

  if (!kind) throw new Error("--kind is required");
  if (!archiveRoot) throw new Error("--archive is required");
  if (!dataDir) throw new Error("--data-dir is required");
  if (!path.isAbsolute(archiveRoot)) throw new Error("--archive must be an absolute path");
  if (!path.isAbsolute(dataDir)) throw new Error("--data-dir must be an absolute path");
  return { kind, archiveRoot: path.resolve(archiveRoot), dataDir: path.resolve(dataDir), json, apply };
}

export async function runArchiveImport(args: ArchiveImportArgs): Promise<ArchiveImportPlan> {
  const dbPath = path.join(args.dataDir, "nesbox.sqlite");
  const planImport = args.kind === "nes" ? planNesArchiveImport : planArcadeArchiveImport;
  if (!args.apply) {
    return planImport({
      archiveRoot: args.archiveRoot,
      existingGames: readStoredGamesReadonly(dbPath),
    });
  }

  const database = new Database(dbPath);
  try {
    initializeLibraryDb(database);
    const plan = await planImport({ archiveRoot: args.archiveRoot, existingGames: listStoredGames(database) });
    const applyReport = await applyArchiveImport(plan, { dataDir: args.dataDir, database, dbPath });
    return Object.assign(plan, { applyReport });
  } finally {
    database.close();
  }
}

function readStoredGamesReadonly(dbPath: string): StoredGame[] {
  if (!existsSync(dbPath)) return [];
  const database = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const rows = database.prepare("SELECT * FROM games").all() as GameRow[];
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      fileName: row.file_name,
      system: row.system,
      emulatorId: row.emulator_id,
      size: row.size,
      addedAt: row.added_at,
      lastPlayedAt: row.last_played_at,
      originalTitle: row.original_title ?? null,
      hasCover: Boolean(row.cover_path),
      pinned: row.pinned === 1,
      romPath: row.rom_path,
      coverPath: row.cover_path ?? null,
    }));
  } finally {
    database.close();
  }
}

interface GameRow {
  id: string;
  title: string;
  file_name: string;
  system: string;
  emulator_id: string;
  size: number;
  rom_path: string;
  added_at: number;
  last_played_at: number | null;
  original_title?: string | null;
  cover_path?: string | null;
  pinned?: number;
}

function printHuman(plan: ArchiveImportPlan): void {
  const { counts } = plan;
  console.log(`kind: ${plan.kind}`);
  console.log(`candidate: ${counts.candidate}`);
  console.log(`new: ${counts.new}`);
  console.log(`edition: ${counts.edition}`);
  console.log(`duplicate: ${counts.duplicate}`);
  console.log(`error: ${counts.error}`);
  for (const candidate of plan.candidates) {
    console.log(`ADD\t${candidate.classification}\t${candidate.sourceKey}\t${candidate.title}`);
  }
  for (const skipped of plan.skipped) {
    console.log(`SKIP\t${skipped.reason}\t${skipped.sourceKey}\t${skipped.title}`);
  }
  const applyReport = (plan as ArchiveImportPlan & { applyReport?: ArchiveApplyReport }).applyReport;
  if (applyReport) {
    console.log(`applied: ${applyReport.added}`);
    console.log(`backup: ${applyReport.backupPath ?? "none"}`);
  }
}

async function main(): Promise<void> {
  const args = parseArchiveImportArgs(process.argv.slice(2));
  const plan = await runArchiveImport(args);
  if (args.json) console.log(JSON.stringify(plan, null, 2));
  else printHuman(plan);
}

const entryUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entryUrl) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
