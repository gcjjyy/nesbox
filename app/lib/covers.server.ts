import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { boxartUrl, findBoxart, originalTitleOf } from "./boxart-match";
import { COVER_DIR, DATA_DIR, setGameCover } from "./library.server";
import type { StoredGame } from "./game-types";

const INDEX_PATH = path.join(DATA_DIR, "libretro-nes-boxarts.json");
const TREE_URL =
  "https://api.github.com/repos/libretro-thumbnails/Nintendo_-_Nintendo_Entertainment_System/git/trees/master?recursive=1";
const BOXART_PREFIX = "Named_Boxarts/";
// 카탈로그 카드(최대 약 180px)의 2배 해상도
const COVER_MAX_SIZE = 360;

let cachedIndex: string[] | null = null;

/** libretro 박스아트 파일 목록. 처음 한 번 GitHub에서 받아 데이터 폴더에 캐시한다. */
export async function loadBoxartIndex(): Promise<string[]> {
  if (cachedIndex) return cachedIndex;
  if (existsSync(INDEX_PATH)) {
    cachedIndex = JSON.parse(readFileSync(INDEX_PATH, "utf8")) as string[];
    return cachedIndex;
  }
  const response = await fetch(TREE_URL, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) throw new Error(`boxart index ${response.status}`);
  const tree = (await response.json()) as { tree: { path: string }[] };
  cachedIndex = tree.tree
    .map((entry) => entry.path)
    .filter((entryPath) => entryPath.startsWith(BOXART_PREFIX) && entryPath.endsWith(".png"))
    .map((entryPath) => entryPath.slice(BOXART_PREFIX.length, -".png".length));
  writeFileSync(INDEX_PATH, JSON.stringify(cachedIndex));
  return cachedIndex;
}

export async function attachBoxart(game: Pick<StoredGame, "id">, boxartName: string): Promise<void> {
  const response = await fetch(boxartUrl(boxartName));
  if (!response.ok) throw new Error(`boxart ${response.status}: ${boxartName}`);
  const cover = await sharp(Buffer.from(await response.arrayBuffer()))
    .resize(COVER_MAX_SIZE, COVER_MAX_SIZE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84 })
    .toBuffer();
  mkdirSync(COVER_DIR, { recursive: true });
  const coverPath = path.join(COVER_DIR, `${game.id.split(":").pop()}.webp`);
  writeFileSync(coverPath, cover);
  setGameCover(game.id, coverPath, originalTitleOf(boxartName));
}

/** 새로 등록한 게임에 이름이 정확히 맞는 박스아트가 있으면 붙인다. 실패해도 등록은 유지된다. */
export async function autoAttachBoxart(game: StoredGame): Promise<boolean> {
  if (game.coverPath) return true;
  try {
    const name = findBoxart(game.fileName, await loadBoxartIndex());
    if (!name) return false;
    await attachBoxart(game, name);
    return true;
  } catch (err) {
    console.warn("boxart lookup failed", game.fileName, err);
    return false;
  }
}
