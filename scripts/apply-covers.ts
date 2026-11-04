// 수동으로 확인한 박스아트 매핑(cover-map.json)을 라이브러리에 적용한다.
// 사용법: NESBOX_DATA_DIR=... npx vite-node scripts/apply-covers.ts [--force]
import { readFileSync } from "node:fs";
import path from "node:path";
import { attachBoxart } from "../app/lib/covers.server";
import { getGame } from "../app/lib/library.server";

const force = process.argv.includes("--force");
const map = JSON.parse(readFileSync(path.join(import.meta.dirname, "cover-map.json"), "utf8")) as Record<string, string>;

let applied = 0;
let skipped = 0;
const failures: string[] = [];

for (const [gameId, boxartName] of Object.entries(map)) {
  const game = getGame(gameId);
  if (!game) {
    failures.push(`${gameId}: not in library`);
    continue;
  }
  if (game.coverPath && !force) {
    skipped += 1;
    continue;
  }
  try {
    await attachBoxart(game, boxartName);
    applied += 1;
    console.log(`ok  ${game.title} -> ${boxartName}`);
  } catch (err) {
    failures.push(`${game.title}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log(`applied ${applied}, skipped ${skipped}, failed ${failures.length}`);
for (const failure of failures) console.log(`ERR ${failure}`);
if (failures.length > 0) process.exitCode = 1;
