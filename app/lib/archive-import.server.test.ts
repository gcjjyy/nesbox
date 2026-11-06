import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { zipSync } from "fflate";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import type { ArchiveImportCandidate, ArchiveImportPlan } from "./archive-catalog.server";
import { applyArchiveImport } from "./archive-import.server";
import { importGamesAtomic, initializeLibraryDb, listStoredGames } from "./library.server";

const temporaryRoots: string[] = [];
const temporaryDatabases: Database.Database[] = [];

afterEach(() => {
  for (const database of temporaryDatabases.splice(0)) database.close();
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("applyArchiveImport", () => {
  it("preserves existing metadata and converts a new cover to WebP", async () => {
    const fixture = await makeFixture();
    const existingRom = path.join(fixture.dataDir, "roms", "existing.nes");
    const existingCover = path.join(fixture.dataDir, "covers", "existing.webp");
    mkdirSync(path.dirname(existingRom), { recursive: true });
    mkdirSync(path.dirname(existingCover), { recursive: true });
    writeFileSync(existingRom, ines(1));
    writeFileSync(existingCover, "existing cover");
    importGamesAtomic([{
      id: "nes:fceux:existing",
      title: "보존할 제목",
      fileName: "existing.nes",
      system: "nes",
      emulatorId: "fceux",
      size: ines(1).byteLength,
      romPath: existingRom,
      coverPath: existingCover,
      originalTitle: "Existing Original",
    }], fixture.database);
    fixture.database.prepare("UPDATE games SET pinned = 1, last_played_at = 123456 WHERE id = ?")
      .run("nes:fceux:existing");

    const conflict = await candidate(fixture, "existing-source", "nes:fceux:existing", 2);
    const added = await candidate(fixture, "new-source", undefined, 3);
    const report = await applyArchiveImport(plan([conflict, added]), fixture.options);
    const rows = listStoredGames(fixture.database);
    const preserved = rows.find((game) => game.id === "nes:fceux:existing");
    const imported = rows.find((game) => game.id === added.id);

    expect(report).toEqual(expect.objectContaining({ added: 1, skipped: 1 }));
    expect(report.backupPath).toMatch(/backups\/nesbox-before-archive-.*\.sqlite$/);
    expect(existsSync(report.backupPath!)).toBe(true);
    expect(preserved).toEqual(expect.objectContaining({
      title: "보존할 제목",
      originalTitle: "Existing Original",
      pinned: true,
      lastPlayedAt: 123456,
      romPath: existingRom,
      coverPath: existingCover,
    }));
    expect(imported?.romPath).toBe(path.join(fixture.dataDir, "roms", `${added.romSha1}.nes`));
    expect(imported?.coverPath).toBe(path.join(fixture.dataDir, "covers", `${added.romSha1}.webp`));
    await expect(sharp(imported!.coverPath!).metadata()).resolves.toEqual(expect.objectContaining({ format: "webp" }));
  });

  it("removes staged and final files and inserts zero rows when a later image is invalid", async () => {
    const fixture = await makeFixture();
    const first = await candidate(fixture, "valid", undefined, 4);
    const second = await candidate(fixture, "invalid", undefined, 5, false);

    await expect(applyArchiveImport(plan([first, second]), fixture.options)).rejects.toThrow();

    expect(listStoredGames(fixture.database)).toEqual([]);
    expect(filesUnder(path.join(fixture.dataDir, "roms"))).toEqual([]);
    expect(filesUnder(path.join(fixture.dataDir, "covers"))).toEqual([]);
    expect(readdirSync(fixture.dataDir).filter((name) => name.startsWith(".archive-import-"))).toEqual([]);
    expect(filesUnder(path.join(fixture.dataDir, "backups")).filter((name) => name.endsWith(".sqlite"))).toHaveLength(1);
  });

  it("reports zero additions when the same plan is applied twice", async () => {
    const fixture = await makeFixture();
    const item = await candidate(fixture, "idempotent", undefined, 6);
    const migration = plan([item]);

    const first = await applyArchiveImport(migration, fixture.options);
    const second = await applyArchiveImport(migration, fixture.options);

    expect(first).toEqual(expect.objectContaining({ added: 1, skipped: 0 }));
    expect(second).toEqual(expect.objectContaining({ added: 0, skipped: 1, backupPath: null }));
    expect(listStoredGames(fixture.database).map((game) => game.id)).toEqual([item.id]);
    expect(filesUnder(path.join(fixture.dataDir, "roms"))).toHaveLength(1);
    expect(filesUnder(path.join(fixture.dataDir, "covers"))).toHaveLength(1);
  });

  it("rejects a corrupt hash-named destination without committing its row", async () => {
    const fixture = await makeFixture();
    const item = await candidate(fixture, "conflicting-file", undefined, 7);
    const conflictingPath = path.join(fixture.dataDir, "roms", `${item.romSha1}.nes`);
    mkdirSync(path.dirname(conflictingPath), { recursive: true });
    writeFileSync(conflictingPath, "corrupt existing bytes");

    await expect(applyArchiveImport(plan([item]), fixture.options)).rejects.toThrow("hash mismatch");

    expect(listStoredGames(fixture.database)).toEqual([]);
    expect(existsSync(conflictingPath)).toBe(true);
  });
});

async function makeFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "nesbox-import-"));
  temporaryRoots.push(root);
  const dataDir = path.join(root, "data");
  const sourceDir = path.join(root, "source");
  const dbPath = path.join(dataDir, "nesbox.sqlite");
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(sourceDir, { recursive: true });
  const database = new Database(dbPath);
  temporaryDatabases.push(database);
  initializeLibraryDb(database);
  return {
    root,
    dataDir,
    sourceDir,
    database,
    options: { dataDir, database, dbPath },
  };
}

async function candidate(
  fixture: Awaited<ReturnType<typeof makeFixture>>,
  sourceKey: string,
  forcedId: string | undefined,
  seed: number,
  validCover = true,
): Promise<ArchiveImportCandidate> {
  const bytes = ines(seed);
  const romSha1 = createHash("sha1").update(bytes).digest("hex");
  const archiveMember = `${sourceKey}.nes`;
  const sourceRomPath = path.join(fixture.sourceDir, `${sourceKey}.zip`);
  const sourceCoverPath = path.join(fixture.sourceDir, `${sourceKey}.jpg`);
  writeFileSync(sourceRomPath, zipSync({ [archiveMember]: bytes }));
  writeFileSync(
    sourceCoverPath,
    validCover
      ? await sharp({ create: { width: 8, height: 8, channels: 3, background: "#c33" } }).jpeg().toBuffer()
      : "not an image",
  );
  return {
    id: forcedId ?? `nes:fceux:${romSha1}`,
    kind: "nes",
    sourceKey,
    sourceRomPath,
    sourceCoverPath,
    archiveMember,
    title: `${sourceKey} title`,
    originalTitle: sourceKey,
    fileName: archiveMember,
    system: "nes",
    emulatorId: "fceux",
    size: bytes.byteLength,
    romSha1,
    classification: "new",
  };
}

function plan(candidates: ArchiveImportCandidate[]): ArchiveImportPlan {
  return {
    kind: "nes",
    archiveRoot: "/fixture",
    candidates,
    skipped: [],
    counts: {
      candidate: candidates.length,
      new: candidates.length,
      edition: 0,
      duplicate: 0,
      error: 0,
    },
  };
}

function ines(seed: number): Uint8Array {
  const bytes = new Uint8Array(16 + 16 * 1024);
  bytes.set([0x4e, 0x45, 0x53, 0x1a, 1, 0]);
  bytes[bytes.length - 1] = seed;
  return bytes;
}

function filesUnder(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).sort();
}
