import type { EmulatorId } from "./rom";

const DB_NAME = "nesbox-save-states";
const DB_VERSION = 1;
const STORE_NAME = "states";

interface StateRecord {
  key: string;
  gameId: string;
  emulatorId: EmulatorId;
  slot: number;
  bytes: Uint8Array;
  updatedAt: number;
}

export async function loadLocalStateBytes(gameId: string, emulatorId: EmulatorId, slot: number): Promise<Uint8Array | null> {
  const db = await openSaveDb();
  const record = await request<StateRecord | undefined>(db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(stateKey(gameId, emulatorId, slot)));
  db.close();
  return record?.bytes ?? null;
}

export async function saveLocalStateBytes(gameId: string, emulatorId: EmulatorId, slot: number, bytes: Uint8Array): Promise<void> {
  const db = await openSaveDb();
  const record: StateRecord = {
    key: stateKey(gameId, emulatorId, slot),
    gameId,
    emulatorId,
    slot,
    bytes,
    updatedAt: Date.now(),
  };
  await request(db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(record));
  db.close();
}

function stateKey(gameId: string, emulatorId: EmulatorId, slot: number): string {
  return `${gameId}|${emulatorId}|${slot}`;
}

async function openSaveDb(): Promise<IDBDatabase> {
  if (!("indexedDB" in globalThis)) {
    throw new Error("이 브라우저는 IndexedDB를 지원하지 않습니다.");
  }
  return new Promise((resolve, reject) => {
    const source = indexedDB.open(DB_NAME, DB_VERSION);
    source.onerror = () => reject(source.error ?? new Error("IndexedDB 열기 실패"));
    source.onsuccess = () => resolve(source.result);
    source.onupgradeneeded = () => {
      const db = source.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("gameId", "gameId");
        store.createIndex("updatedAt", "updatedAt");
      }
    };
  });
}

function request<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    source.onerror = () => reject(source.error ?? new Error("IndexedDB 요청 실패"));
    source.onsuccess = () => resolve(source.result);
  });
}
