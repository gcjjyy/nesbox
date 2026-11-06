import { existsSync, renameSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import { unzipSync } from "fflate";
import sharp from "sharp";
import type { ArchiveImportCandidate, ArchiveImportPlan } from "./archive-catalog.server";
import { sha1File } from "./archive-catalog.server";
import { importGamesAtomic, type ImportGameRecord } from "./library.server";

export interface ArchiveApplyReport {
  backupPath: string | null;
  added: number;
  skipped: number;
  gameIds: string[];
  romPaths: string[];
  coverPaths: string[];
}

export async function applyArchiveImport(
  plan: ArchiveImportPlan,
  options: { dataDir: string; database: Database.Database; dbPath: string },
): Promise<ArchiveApplyReport> {
  const existingIds = new Set(
    (options.database.prepare("SELECT id FROM games").all() as { id: string }[]).map((row) => row.id),
  );
  const pending = plan.candidates.filter((candidate) => !existingIds.has(candidate.id));
  const skipped = plan.skipped.length + plan.candidates.length - pending.length;
  if (pending.length === 0) {
    return { backupPath: null, added: 0, skipped, gameIds: [], romPaths: [], coverPaths: [] };
  }

  const romDir = path.join(options.dataDir, "roms");
  const coverDir = path.join(options.dataDir, "covers");
  const backupDir = path.join(options.dataDir, "backups");
  await Promise.all([
    mkdir(romDir, { recursive: true }),
    mkdir(coverDir, { recursive: true }),
    mkdir(backupDir, { recursive: true }),
  ]);
  options.database.pragma("wal_checkpoint(TRUNCATE)");
  const backupPath = path.join(
    backupDir,
    `nesbox-before-archive-${Date.now()}-${process.pid}.sqlite`,
  );
  await options.database.backup(backupPath);

  const stagingRoot = await mkdtemp(path.join(options.dataDir, ".archive-import-"));
  const createdFinalPaths: string[] = [];
  try {
    const staged = [] as StagedCandidate[];
    for (const candidate of pending) staged.push(await stageCandidate(candidate, stagingRoot, romDir, coverDir));

    const records: ImportGameRecord[] = staged.map(({ candidate, finalRomPath, finalCoverPath }) => ({
      id: candidate.id,
      title: candidate.title,
      fileName: candidate.fileName,
      system: candidate.system,
      emulatorId: candidate.emulatorId,
      size: candidate.size,
      romPath: finalRomPath,
      coverPath: finalCoverPath,
      originalTitle: candidate.originalTitle,
    }));

    options.database.transaction(() => {
      for (const item of staged) {
        moveIntoPlace(item.stagedRomPath, item.finalRomPath, createdFinalPaths);
        moveIntoPlace(item.stagedCoverPath, item.finalCoverPath, createdFinalPaths);
      }
      importGamesAtomic(records, options.database);
    })();

    return {
      backupPath,
      added: pending.length,
      skipped,
      gameIds: pending.map((candidate) => candidate.id),
      romPaths: records.map((record) => record.romPath),
      coverPaths: records.map((record) => record.coverPath),
    };
  } catch (error) {
    await Promise.all(createdFinalPaths.map((filePath) => rm(filePath, { force: true })));
    throw error;
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}

interface StagedCandidate {
  candidate: ArchiveImportCandidate;
  stagedRomPath: string;
  stagedCoverPath: string;
  finalRomPath: string;
  finalCoverPath: string;
}

async function stageCandidate(
  candidate: ArchiveImportCandidate,
  stagingRoot: string,
  romDir: string,
  coverDir: string,
): Promise<StagedCandidate> {
  const extension = candidate.kind === "arcade" ? "zip" : "nes";
  const stagedRomPath = path.join(stagingRoot, `${candidate.romSha1}.${extension}`);
  const stagedCoverPath = path.join(stagingRoot, `${candidate.romSha1}.webp`);
  const finalRomPath = path.join(romDir, `${candidate.romSha1}.${extension}`);
  const finalCoverPath = path.join(coverDir, `${candidate.romSha1}.webp`);
  if (candidate.kind === "nes" && candidate.archiveMember) {
    const entries = unzipSync(await readFile(candidate.sourceRomPath));
    const romBytes = entries[candidate.archiveMember];
    if (!romBytes) throw new Error(`${candidate.sourceKey}: ROM member disappeared from archive`);
    if (romBytes.byteLength !== candidate.size) throw new Error(`${candidate.sourceKey}: ROM size changed after planning`);
    await writeFile(stagedRomPath, romBytes);
  } else if (candidate.kind === "arcade" && candidate.archiveMember === null) {
    const sourceInfo = await stat(candidate.sourceRomPath);
    if (!sourceInfo.isFile() || sourceInfo.size !== candidate.size) {
      throw new Error(`${candidate.sourceKey}: ROM size changed after planning`);
    }
    await copyFile(candidate.sourceRomPath, stagedRomPath);
  } else {
    throw new Error(`${candidate.sourceKey}: unsupported archive candidate`);
  }
  if (await sha1File(stagedRomPath) !== candidate.romSha1) {
    throw new Error(`${candidate.sourceKey}: staged ROM hash mismatch`);
  }
  if (existsSync(finalRomPath) && await sha1File(finalRomPath) !== candidate.romSha1) {
    throw new Error(`${candidate.sourceKey}: existing ROM hash mismatch`);
  }
  await sharp(candidate.sourceCoverPath).webp({ quality: 85 }).toFile(stagedCoverPath);
  const coverInfo = await stat(stagedCoverPath);
  if (!coverInfo.isFile() || coverInfo.size === 0) throw new Error(`${candidate.sourceKey}: empty converted cover`);
  return {
    candidate,
    stagedRomPath,
    stagedCoverPath,
    finalRomPath,
    finalCoverPath,
  };
}

function moveIntoPlace(source: string, destination: string, createdFinalPaths: string[]): void {
  if (existsSync(destination)) return;
  // better-sqlite3 transactions are synchronous, so final moves stay in the same rollback boundary.
  renameSync(source, destination);
  createdFinalPaths.push(destination);
}
