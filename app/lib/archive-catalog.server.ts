import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { unzipSync } from "fflate";
import variantRows from "../../scripts/archive-nes-variants.json";
import type { StoredGame } from "./game-types";
import type { EmulatorId, SystemId } from "./rom";

export type ArchiveImportKind = "nes" | "arcade";
export type ArchiveCandidateClassification = "new" | "edition";

export interface ArchiveImportCandidate {
  id: string;
  kind: ArchiveImportKind;
  sourceKey: string;
  sourceRomPath: string;
  sourceCoverPath: string;
  archiveMember: string | null;
  title: string;
  originalTitle: string;
  fileName: string;
  system: SystemId;
  emulatorId: EmulatorId;
  size: number;
  romSha1: string;
  classification: ArchiveCandidateClassification;
}

export interface ArchiveSkippedItem {
  sourceKey: string;
  title: string;
  reason: "duplicate-rom";
  existingGameId?: string;
}

export interface ArchivePlanCounts {
  candidate: number;
  new: number;
  edition: number;
  duplicate: number;
  error: number;
}

export interface ArchiveImportPlan {
  kind: ArchiveImportKind;
  archiveRoot: string;
  candidates: ArchiveImportCandidate[];
  skipped: ArchiveSkippedItem[];
  counts: ArchivePlanCounts;
}

interface GameDetailRow {
  no: string;
  name: string;
  zip: string;
  core: string;
  download?: {
    file?: string;
    image_files?: string[];
  };
}

interface ImageMappingRow {
  no: string;
  name: string;
  zip: string;
  images?: string[];
}

const NES_VARIANTS = new Map(variantRows.map((row) => [row.sourceKey, row.title]));

export async function planNesArchiveImport(options: {
  archiveRoot: string;
  existingGames: StoredGame[];
}): Promise<ArchiveImportPlan> {
  const archiveRoot = path.resolve(options.archiveRoot);
  const details = await readJsonArray<GameDetailRow>(path.join(archiveRoot, "assets", "game_details.json"));
  const mappings = await readJsonArray<ImageMappingRow>(path.join(archiveRoot, "assets", "game_image_mapping.json"));
  const imageMappings = new Map(mappings.map((row) => [row.zip, row]));
  const existingByHash = await hashExistingGames(options.existingGames);
  const plannedHashes = new Map<string, string>();
  const candidates: ArchiveImportCandidate[] = [];
  const skipped: ArchiveSkippedItem[] = [];

  for (const row of details.filter((item) => item.core === "nes")) {
    validateCatalogRow(row);
    const sourceKey = row.zip;
    const mapping = imageMappings.get(sourceKey);
    if (!mapping || mapping.no !== row.no) {
      throw new Error(`${sourceKey}: missing matching image manifest row`);
    }
    const sourceCoverPath = await resolveCoverPath(archiveRoot, sourceKey, row, mapping);
    const sourceRomPath = path.join(archiveRoot, "games", "nes", row.download!.file!);
    const zipBytes = await readRequiredFile(sourceRomPath, `${sourceKey}: missing ROM zip`);
    const entries = unzipSync(zipBytes);
    const romEntries = Object.entries(entries).filter(([name]) => name.toLowerCase().endsWith(".nes"));
    if (romEntries.length !== 1) {
      throw new Error(`${sourceKey}: expected exactly one .nes entry, found ${romEntries.length}`);
    }
    const [archiveMember, romBytes] = romEntries[0];
    validateInes(sourceKey, romBytes);
    const romSha1 = sha1Bytes(romBytes);
    const existing = existingByHash.get(romSha1);
    const earlierCandidate = plannedHashes.get(romSha1);
    if (existing || earlierCandidate) {
      skipped.push({
        sourceKey,
        title: row.name,
        reason: "duplicate-rom",
        existingGameId: existing?.id ?? earlierCandidate,
      });
      continue;
    }

    const classification: ArchiveCandidateClassification = NES_VARIANTS.has(sourceKey) ? "edition" : "new";
    const baseTitle = NES_VARIANTS.get(sourceKey) ?? row.name;
    const title = classification === "edition"
      ? `${baseTitle} ${editionSuffixFromRomName(archiveMember)}`
      : row.name;
    const fileName = path.basename(archiveMember);
    const id = `nes:fceux:${romSha1}`;
    candidates.push({
      id,
      kind: "nes",
      sourceKey,
      sourceRomPath,
      sourceCoverPath,
      archiveMember,
      title,
      originalTitle: path.basename(fileName, path.extname(fileName)),
      fileName,
      system: "nes",
      emulatorId: "fceux",
      size: romBytes.byteLength,
      romSha1,
      classification,
    });
    plannedHashes.set(romSha1, id);
  }

  const edition = candidates.filter((candidate) => candidate.classification === "edition").length;
  return {
    kind: "nes",
    archiveRoot,
    candidates,
    skipped,
    counts: {
      candidate: candidates.length,
      new: candidates.length - edition,
      edition,
      duplicate: skipped.length,
      error: 0,
    },
  };
}

export async function sha1File(filePath: string): Promise<string> {
  return sha1Bytes(await readFile(filePath));
}

export function editionSuffixFromRomName(name: string): string {
  if (/\[(?:K|KOR)\]|\((?:K|KOR|KOREA|KOREAN)\)/i.test(name)) return "[한글판]";
  if (/\((?:J|JAPAN)\)/i.test(name)) return "[일본판]";
  if (/\((?:U|USA)\)/i.test(name)) return "[미국판]";
  return "[별도판]";
}

async function hashExistingGames(games: StoredGame[]): Promise<Map<string, StoredGame>> {
  const entries = await Promise.all(games.map(async (game) => [await sha1File(game.romPath), game] as const));
  return new Map(entries);
}

function validateCatalogRow(row: GameDetailRow): void {
  if (!row.no || !row.name || !row.zip || !row.download?.file) {
    throw new Error(`invalid NES catalog row: ${JSON.stringify(row)}`);
  }
}

async function resolveCoverPath(
  archiveRoot: string,
  sourceKey: string,
  detail: GameDetailRow,
  mapping: ImageMappingRow,
): Promise<string> {
  const detailImages = detail.download?.image_files ?? [];
  const mappedImages = mapping.images ?? [];
  const candidates = [...new Set([...detailImages, ...mappedImages])];
  for (const relativePath of candidates) {
    const resolved = safeArchivePath(archiveRoot, relativePath);
    try {
      await readFile(resolved);
      return resolved;
    } catch {
      // Try every manifest-provided candidate before failing preflight.
    }
  }
  throw new Error(`${sourceKey}: missing image`);
}

function safeArchivePath(archiveRoot: string, relativePath: string): string {
  const resolved = path.resolve(archiveRoot, relativePath);
  const prefix = `${archiveRoot}${path.sep}`;
  if (!resolved.startsWith(prefix)) throw new Error(`archive path escapes root: ${relativePath}`);
  return resolved;
}

async function readRequiredFile(filePath: string, message: string): Promise<Uint8Array> {
  try {
    return await readFile(filePath);
  } catch (error) {
    throw new Error(message, { cause: error });
  }
}

function validateInes(sourceKey: string, bytes: Uint8Array): void {
  if (bytes.byteLength < 16 || bytes[0] !== 0x4e || bytes[1] !== 0x45 || bytes[2] !== 0x53 || bytes[3] !== 0x1a) {
    throw new Error(`${sourceKey}: invalid iNES header`);
  }
}

function sha1Bytes(bytes: Uint8Array): string {
  return createHash("sha1").update(bytes).digest("hex");
}

async function readJsonArray<T>(filePath: string): Promise<T[]> {
  const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
  if (!Array.isArray(parsed)) throw new Error(`${filePath}: expected a JSON array`);
  return parsed as T[];
}
