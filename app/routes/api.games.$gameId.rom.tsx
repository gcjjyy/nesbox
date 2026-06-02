import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import type { Route } from "./+types/api.games.$gameId.rom";
import { getGame } from "../lib/library.server";

export async function loader({ params }: Route.LoaderArgs) {
  const game = getGame(params.gameId);
  if (!game) return new Response("not found", { status: 404 });
  const info = await stat(game.romPath);
  return new Response(Readable.toWeb(createReadStream(game.romPath)) as ReadableStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(info.size),
      "Content-Disposition": `inline; filename="${encodeURIComponent(game.fileName)}"`,
    },
  });
}
