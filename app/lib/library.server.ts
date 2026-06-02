import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defaultEmulatorForFile } from "./emulator-registry";
import { extensionOf, type EmulatorId } from "./rom";
import type { GameEntry, StoredGame } from "./game-types";

const DATA_DIR = process.env.NESBOX_DATA_DIR ?? path.join(process.cwd(), "data");
const ROM_DIR = path.join(DATA_DIR, "roms");
const DB_PATH = process.env.NESBOX_DB_PATH ?? path.join(DATA_DIR, "nesbox.sqlite");
const OPENEMU_ROMS_DIR =
  process.env.NESBOX_OPENEMU_ROMS_DIR ??
  path.join(process.env.HOME ?? "", "Library/Application Support/OpenEmu/Game Library/roms");

let db: Database.Database | null = null;

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
}

export function getLibraryDb(): Database.Database {
  if (db) return db;
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(ROM_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      system TEXT NOT NULL,
      emulator_id TEXT NOT NULL,
      size INTEGER NOT NULL,
      rom_path TEXT NOT NULL UNIQUE,
      added_at INTEGER NOT NULL,
      last_played_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS save_states (
      game_id TEXT NOT NULL,
      emulator_id TEXT NOT NULL,
      slot INTEGER NOT NULL,
      bytes BLOB NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (game_id, emulator_id, slot),
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );
  `);
  return db;
}

export function listGames(): GameEntry[] {
  const rows = getLibraryDb()
    .prepare("SELECT * FROM games ORDER BY COALESCE(last_played_at, added_at) DESC, title COLLATE NOCASE ASC")
    .all() as GameRow[];
  return rows.map(rowToGame);
}

export function getGame(gameId: string): StoredGame | null {
  const row = getLibraryDb().prepare("SELECT * FROM games WHERE id = ?").get(gameId) as GameRow | undefined;
  return row ? rowToStoredGame(row) : null;
}

export function touchGame(gameId: string): void {
  getLibraryDb().prepare("UPDATE games SET last_played_at = ? WHERE id = ?").run(Date.now(), gameId);
}

export function deleteGame(gameId: string): void {
  const database = getLibraryDb();
  const tx = database.transaction(() => {
    database.prepare("DELETE FROM save_states WHERE game_id = ?").run(gameId);
    database.prepare("DELETE FROM games WHERE id = ?").run(gameId);
  });
  tx();
}

export function saveState(gameId: string, emulatorId: EmulatorId, slot: number, bytes: Uint8Array): void {
  getLibraryDb()
    .prepare(`
      INSERT INTO save_states (game_id, emulator_id, slot, bytes, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(game_id, emulator_id, slot)
      DO UPDATE SET bytes = excluded.bytes, updated_at = excluded.updated_at
    `)
    .run(gameId, emulatorId, slot, Buffer.from(bytes), Date.now());
}

export function loadState(gameId: string, emulatorId: EmulatorId, slot: number): Buffer | null {
  const row = getLibraryDb()
    .prepare("SELECT bytes FROM save_states WHERE game_id = ? AND emulator_id = ? AND slot = ?")
    .get(gameId, emulatorId, slot) as { bytes: Buffer } | undefined;
  return row?.bytes ?? null;
}

export function importOpenEmuGames(): { imported: number; games: GameEntry[] } {
  const files = existsSync(OPENEMU_ROMS_DIR) ? walkRomFiles(OPENEMU_ROMS_DIR) : [];
  let imported = 0;
  for (const filePath of files) {
    if (upsertGameFromPath(filePath)) imported += 1;
  }
  return { imported, games: listGames() };
}

export function saveUploadedGame(fileName: string, bytes: Uint8Array): GameEntry {
  const profile = defaultEmulatorForFile(fileName);
  if (!profile) throw new Error(`unsupported ROM: ${fileName}`);
  const hash = sha1(bytes);
  const ext = extensionOf(fileName);
  const safeName = `${hash}.${ext}`;
  const romPath = path.join(ROM_DIR, safeName);
  writeFileSync(romPath, bytes);
  return upsertGame({
    id: `${profile.system}:${profile.id}:${hash}`,
    title: titleFromFileName(fileName),
    fileName,
    system: profile.system,
    emulatorId: profile.id,
    size: bytes.byteLength,
    romPath,
  });
}

function upsertGameFromPath(romPath: string): boolean {
  const profile = defaultEmulatorForFile(romPath);
  if (!profile) return false;
  const bytes = readFileSync(romPath);
  upsertGame({
    id: `${profile.system}:${profile.id}:${sha1(bytes)}`,
    title: titleFromFileName(path.basename(romPath)),
    fileName: path.basename(romPath),
    system: profile.system,
    emulatorId: profile.id,
    size: bytes.byteLength,
    romPath,
  });
  return true;
}

function upsertGame(input: Omit<StoredGame, "addedAt" | "lastPlayedAt">): GameEntry {
  const now = Date.now();
  getLibraryDb()
    .prepare(`
      INSERT INTO games (id, title, file_name, system, emulator_id, size, rom_path, added_at, last_played_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(id)
      DO UPDATE SET
        title = excluded.title,
        file_name = excluded.file_name,
        system = excluded.system,
        emulator_id = excluded.emulator_id,
        size = excluded.size,
        rom_path = excluded.rom_path
    `)
    .run(
      input.id,
      input.title,
      input.fileName,
      input.system,
      input.emulatorId,
      input.size,
      input.romPath,
      now,
    );
  const game = getGame(input.id);
  if (!game) throw new Error("failed to save game");
  return game;
}

function walkRomFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) continue;
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        stack.push(full);
      } else if (st.isFile() && defaultEmulatorForFile(full)) {
        out.push(full);
      }
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function rowToGame(row: GameRow): GameEntry {
  return {
    id: row.id,
    title: row.title,
    fileName: row.file_name,
    system: row.system,
    emulatorId: row.emulator_id,
    size: row.size,
    addedAt: row.added_at,
    lastPlayedAt: row.last_played_at,
  };
}

function rowToStoredGame(row: GameRow): StoredGame {
  return {
    ...rowToGame(row),
    romPath: row.rom_path,
  };
}

function titleFromFileName(fileName: string): string {
  return path.basename(fileName).replace(/\.[^.]+$/, "");
}

function sha1(bytes: Uint8Array): string {
  return createHash("sha1").update(bytes).digest("hex");
}
