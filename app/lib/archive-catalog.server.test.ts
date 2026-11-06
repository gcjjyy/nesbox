import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { StoredGame } from "./game-types";
import {
  editionSuffixFromRomName,
  mapArchiveArcadeCore,
  planArcadeArchiveImport,
  planNesArchiveImport,
} from "./archive-catalog.server";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("planNesArchiveImport", () => {
  it("plans one candidate from a valid single-entry iNES zip", async () => {
    const root = archiveFixture([
      entry("1", "새 게임", "nes_NewGame", "New Game (USA).nes", ines(1)),
    ]);

    const plan = await planNesArchiveImport({ archiveRoot: root, existingGames: [] });
    const expectedBytes = ines(1);
    const expectedHash = createHash("sha1").update(expectedBytes).digest("hex");

    expect(plan.counts).toEqual({ candidate: 1, new: 1, edition: 0, duplicate: 0, error: 0 });
    expect(plan.candidates).toEqual([
      expect.objectContaining({
        id: `nes:fceux:${expectedHash}`,
        title: "새 게임",
        originalTitle: "New Game (USA)",
        fileName: "New Game (USA).nes",
        archiveMember: "New Game (USA).nes",
        romSha1: expectedHash,
        size: expectedBytes.byteLength,
        system: "nes",
        emulatorId: "fceux",
        classification: "new",
      }),
    ]);
  });

  it("rejects NES zips with zero or multiple ROM entries", async () => {
    const noRom = archiveFixture([
      entry("1", "설명서만", "nes_NoRom", "readme.txt", new TextEncoder().encode("no rom")),
    ]);
    const multiple = archiveFixture([
      {
        ...entry("2", "두 게임", "nes_TwoRoms", "First.nes", ines(2)),
        zipEntries: { "First.nes": ines(2), "Second.nes": ines(3) },
      },
    ]);

    await expect(planNesArchiveImport({ archiveRoot: noRom, existingGames: [] }))
      .rejects.toThrow("exactly one .nes");
    await expect(planNesArchiveImport({ archiveRoot: multiple, existingGames: [] }))
      .rejects.toThrow("exactly one .nes");
  });

  it("fails the whole plan when a manifest image is missing", async () => {
    const root = archiveFixture([
      { ...entry("1", "표지 없음", "nes_MissingCover", "Missing.nes", ines(4)), omitImage: true },
    ]);

    await expect(planNesArchiveImport({ archiveRoot: root, existingGames: [] }))
      .rejects.toThrow("missing image");
  });

  it("skips renamed ROMs by SHA-1", async () => {
    const bytes = ines(5);
    const root = archiveFixture([
      entry("1", "다른 파일명", "nes_Renamed", "Renamed Dump.nes", bytes),
    ]);
    const existingPath = path.join(root, "existing", "current-name.nes");
    mkdirSync(path.dirname(existingPath), { recursive: true });
    writeFileSync(existingPath, bytes);
    const existing = storedGame(existingPath, "현재 제목");

    const plan = await planNesArchiveImport({ archiveRoot: root, existingGames: [existing] });

    expect(plan.counts).toEqual({ candidate: 0, new: 0, edition: 0, duplicate: 1, error: 0 });
    expect(plan.candidates).toEqual([]);
    expect(plan.skipped).toEqual([
      expect.objectContaining({ sourceKey: "nes_Renamed", reason: "duplicate-rom", existingGameId: existing.id }),
    ]);
    expect(existing.title).toBe("현재 제목");
  });

  it("classifies the seven curated works as editions", async () => {
    const works = [
      ["닌자거북이 3", "nes_NinjaTurtlesIII", "Teenage Mutant Ninja Turtles III (USA).nes", "[미국판]"],
      ["드래곤볼Z2 격신 프리저", "nes_DragonBalZ2K", "DragonBall Z2 K.nes", "[별도판]"],
      ["드래곤볼Z3 열전 인조인간", "nes_DragonBalZ3K", "Dragon Ball Z III (Korean).nes", "[한글판]"],
      ["마이티 파이널 파이트", "nes_MightyFinalFight", "Mighty Final Fight (Korea).nes", "[한글판]"],
      ["열혈 격투전설", "nes_NekketsuKakutouDensetsu", "Nekketsu Kakutou Densetsu (Japan).nes", "[일본판]"],
      ["열혈 신기록", "nes_NekketsuShinKiroku", "NekketsuShinKiroku.nes", "[별도판]"],
      ["칩 앤 데일 2", "nes_ChipnDale2", "Chip to Dale no Daisakusen 2 (Japan).nes", "[일본판]"],
    ] as const;
    const root = archiveFixture(
      works.map(([title, sourceKey, member], index) => entry(String(index + 1), title, sourceKey, member, ines(index + 10))),
    );

    const plan = await planNesArchiveImport({ archiveRoot: root, existingGames: [] });

    expect(plan.counts).toEqual({ candidate: 7, new: 0, edition: 7, duplicate: 0, error: 0 });
    expect(plan.candidates.map((candidate) => candidate.title)).toEqual(
      works.map(([title, , , suffix]) => `${title} ${suffix}`),
    );
  });
});

describe("editionSuffixFromRomName", () => {
  it.each([
    ["Game [K].nes", "[한글판]"],
    ["Game (K).nes", "[한글판]"],
    ["Game (Korean).nes", "[한글판]"],
    ["Game (J).nes", "[일본판]"],
    ["Game (Japan).nes", "[일본판]"],
    ["Game (U).nes", "[미국판]"],
    ["Game (USA).nes", "[미국판]"],
    ["Game.nes", "[별도판]"],
  ])("maps %s to %s", (name, suffix) => {
    expect(editionSuffixFromRomName(name)).toBe(suffix);
  });
});

describe("planArcadeArchiveImport", () => {
  it("maps MAME and FBN rows to native EmulatorJS cores and preserves shortname ZIPs", async () => {
    const root = arcadeArchiveFixture([
      arcadeEntry("1", "1942", "1942", "mame"),
      arcadeEntry("2", "1944", "1944", "fbn"),
      arcadeEntry("3", "카발", "cabalbl", "mame", "cabal.jpg"),
    ]);

    const plan = await planArcadeArchiveImport({ archiveRoot: root, existingGames: [] });

    expect(plan.counts).toEqual({ candidate: 3, new: 3, edition: 0, duplicate: 0, error: 0 });
    expect(plan.candidates).toEqual([
      expect.objectContaining({
        id: expect.stringMatching(/^arcade:mame2003-plus:[0-9a-f]{40}$/),
        sourceKey: "1942",
        fileName: "1942.zip",
        archiveMember: null,
        system: "arcade",
        emulatorId: "mame2003-plus",
      }),
      expect.objectContaining({
        id: expect.stringMatching(/^arcade:fbneo:[0-9a-f]{40}$/),
        sourceKey: "1944",
        fileName: "1944.zip",
        archiveMember: null,
        system: "arcade",
        emulatorId: "fbneo",
      }),
      expect.objectContaining({
        sourceKey: "cabalbl",
        sourceCoverPath: path.join(root, "assets", "screenshots_app", "cabal.jpg"),
      }),
    ]);
  });

  it("rejects unknown arcade core identifiers", () => {
    expect(() => mapArchiveArcadeCore("mystery-core")).toThrow("unsupported arcade core: mystery-core");
  });
});

interface FixtureEntry {
  no: string;
  title: string;
  sourceKey: string;
  member: string;
  bytes: Uint8Array;
  zipEntries?: Record<string, Uint8Array>;
  omitImage?: boolean;
}

function entry(no: string, title: string, sourceKey: string, member: string, bytes: Uint8Array): FixtureEntry {
  return { no, title, sourceKey, member, bytes };
}

function archiveFixture(entries: FixtureEntry[]): string {
  const root = mkdtempSync(path.join(tmpdir(), "nesbox-archive-"));
  temporaryRoots.push(root);
  mkdirSync(path.join(root, "assets", "screenshots_app"), { recursive: true });
  mkdirSync(path.join(root, "games", "nes"), { recursive: true });

  const details = entries.map((item) => {
    const image = `assets/screenshots_app/${item.sourceKey.toLowerCase()}.jpg`;
    if (!item.omitImage) writeFileSync(path.join(root, image), "fixture image");
    writeFileSync(
      path.join(root, "games", "nes", `${item.sourceKey}.zip`),
      makeStoredZip(item.zipEntries ?? { [item.member]: item.bytes }),
    );
    return {
      no: item.no,
      name: item.title,
      name_eng: item.sourceKey,
      zip: item.sourceKey,
      core: "nes",
      download: {
        no: item.no,
        name: item.title,
        core: "nes",
        requested_zip: item.sourceKey,
        file: `${item.sourceKey}.zip`,
        image_files: [image],
      },
    };
  });
  const images = entries.map((item) => ({
    no: item.no,
    name: item.title,
    zip: item.sourceKey,
    images: [`assets/screenshots_app/${item.sourceKey.toLowerCase()}.jpg`],
  }));
  writeFileSync(path.join(root, "assets", "game_details.json"), JSON.stringify(details));
  writeFileSync(path.join(root, "assets", "game_image_mapping.json"), JSON.stringify(images));
  return root;
}

interface ArcadeFixtureEntry {
  no: string;
  title: string;
  sourceKey: string;
  core: "mame" | "fbn";
  imageName: string;
}

function arcadeEntry(
  no: string,
  title: string,
  sourceKey: string,
  core: "mame" | "fbn",
  imageName = `${sourceKey}.jpg`,
): ArcadeFixtureEntry {
  return { no, title, sourceKey, core, imageName };
}

function arcadeArchiveFixture(entries: ArcadeFixtureEntry[]): string {
  const root = mkdtempSync(path.join(tmpdir(), "nesbox-arcade-archive-"));
  temporaryRoots.push(root);
  mkdirSync(path.join(root, "assets", "screenshots_app"), { recursive: true });
  mkdirSync(path.join(root, "games", "mame"), { recursive: true });
  mkdirSync(path.join(root, "games", "fbn"), { recursive: true });

  const details = entries.map((item, index) => {
    const image = `assets/screenshots_app/${item.imageName}`;
    writeFileSync(path.join(root, image), "fixture image");
    writeFileSync(
      path.join(root, "games", item.core, `${item.sourceKey}.zip`),
      makeStoredZip({ [`${item.sourceKey}.bin`]: new Uint8Array([0x50, 0x4b, index + 1]) }),
    );
    return {
      no: item.no,
      name: item.title,
      zip: item.sourceKey,
      core: item.core,
      download: {
        file: `${item.sourceKey}.zip`,
        image_files: [image],
      },
    };
  });
  const images = entries.map((item) => ({
    no: item.no,
    name: item.title,
    zip: item.sourceKey,
    images: [`assets/screenshots_app/${item.imageName}`],
  }));
  writeFileSync(path.join(root, "assets", "game_details.json"), JSON.stringify(details));
  writeFileSync(path.join(root, "assets", "game_image_mapping.json"), JSON.stringify(images));
  return root;
}

function ines(seed: number): Uint8Array {
  const bytes = new Uint8Array(16 + 16 * 1024);
  bytes.set([0x4e, 0x45, 0x53, 0x1a, 1, 0]);
  bytes[bytes.length - 1] = seed;
  return bytes;
}

function storedGame(romPath: string, title: string): StoredGame {
  return {
    id: "nes:fceux:existing",
    title,
    fileName: path.basename(romPath),
    system: "nes",
    emulatorId: "fceux",
    size: 1,
    addedAt: 1,
    lastPlayedAt: 2,
    originalTitle: null,
    hasCover: false,
    pinned: true,
    romPath,
    coverPath: null,
  };
}

function makeStoredZip(entries: Record<string, Uint8Array>): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, data] of Object.entries(entries)) {
    const encodedName = new TextEncoder().encode(name);
    const crc = crc32(data);
    const local = new Uint8Array(30 + encodedName.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, encodedName.length, true);
    local.set(encodedName, 30);
    local.set(data, 30 + encodedName.length);
    locals.push(local);

    const central = new Uint8Array(46 + encodedName.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, encodedName.length, true);
    centralView.setUint32(42, offset, true);
    central.set(encodedName, 46);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, centrals.length, true);
  endView.setUint16(10, centrals.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return concat([...locals, ...centrals, end]);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((sum, item) => sum + item.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
