import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { GameEntry, StoredGame } from "./game-types";

export const DATA_DIR = process.env.NESBOX_DATA_DIR ?? path.join(process.cwd(), "data");
const ROM_DIR = path.join(DATA_DIR, "roms");
export const COVER_DIR = path.join(DATA_DIR, "covers");
const DB_PATH = process.env.NESBOX_DB_PATH ?? path.join(DATA_DIR, "nesbox.sqlite");
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
  original_title: string | null;
  cover_path: string | null;
  pinned: number;
}

export function getLibraryDb(): Database.Database {
  if (db) return db;
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(ROM_DIR, { recursive: true });
  db = new Database(DB_PATH);
  initializeLibraryDb(db);
  return db;
}

export function initializeLibraryDb(database: Database.Database): void {
  database.pragma("journal_mode = WAL");
  database.exec(`
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

    -- 상태 저장은 브라우저(IndexedDB)에만 한다. 예전 서버 저장 테이블은 비어 있어 제거한다.
    DROP TABLE IF EXISTS save_states;
  `);
  migrateGameColumns(database);
}

function migrateGameColumns(database: Database.Database): void {
  const columns = new Set(
    (database.prepare("PRAGMA table_info(games)").all() as { name: string }[]).map((column) => column.name),
  );
  if (!columns.has("original_title")) database.exec("ALTER TABLE games ADD COLUMN original_title TEXT");
  if (!columns.has("cover_path")) database.exec("ALTER TABLE games ADD COLUMN cover_path TEXT");
  if (!columns.has("pinned")) database.exec("ALTER TABLE games ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0");
}

export function listGames(): GameEntry[] {
  return listStoredGames().map(({ romPath: _romPath, coverPath: _coverPath, ...game }) => game);
}

export function listStoredGames(database: Database.Database = getLibraryDb()): StoredGame[] {
  const rows = database
    .prepare("SELECT * FROM games ORDER BY pinned DESC, title COLLATE NOCASE ASC")
    .all() as GameRow[];
  return rows.map(rowToStoredGame);
}

export function getGame(gameId: string): StoredGame | null {
  const row = getLibraryDb().prepare("SELECT * FROM games WHERE id = ?").get(gameId) as GameRow | undefined;
  return row ? rowToStoredGame(row) : null;
}

export function setGameCover(gameId: string, coverPath: string, originalTitle: string): void {
  getLibraryDb()
    .prepare("UPDATE games SET cover_path = ?, original_title = ? WHERE id = ?")
    .run(coverPath, originalTitle, gameId);
}

export function setGamePinned(gameId: string, pinned: boolean): void {
  getLibraryDb().prepare("UPDATE games SET pinned = ? WHERE id = ?").run(pinned ? 1 : 0, gameId);
}

export interface ImportGameRecord {
  id: string;
  title: string;
  fileName: string;
  system: string;
  emulatorId: string;
  size: number;
  romPath: string;
  coverPath: string;
  originalTitle: string;
}

export function importGamesAtomic(
  records: ImportGameRecord[],
  database: Database.Database = getLibraryDb(),
): void {
  const statement = database.prepare(`
    INSERT INTO games (
      id, title, file_name, system, emulator_id, size, rom_path,
      added_at, last_played_at, original_title, cover_path, pinned
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 0)
    ON CONFLICT(id) DO NOTHING
  `);
  const insert = database.transaction((items: ImportGameRecord[]) => {
    const addedAt = Date.now();
    for (const item of items) {
      statement.run(
        item.id,
        item.title,
        item.fileName,
        item.system,
        item.emulatorId,
        item.size,
        item.romPath,
        addedAt,
        item.originalTitle,
        item.coverPath,
      );
    }
  });
  insert(records);
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
    originalTitle: row.original_title,
    hasCover: Boolean(row.cover_path),
    pinned: row.pinned === 1,
  };
}

function rowToStoredGame(row: GameRow): StoredGame {
  return {
    ...rowToGame(row),
    romPath: row.rom_path,
    coverPath: row.cover_path,
  };
}
