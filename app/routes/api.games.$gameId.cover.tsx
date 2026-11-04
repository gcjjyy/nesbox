import { readFile } from "node:fs/promises";
import type { Route } from "./+types/api.games.$gameId.cover";
import { getGame } from "../lib/library.server";

export async function loader({ params }: Route.LoaderArgs) {
  const game = getGame(params.gameId);
  if (!game?.coverPath) return new Response("not found", { status: 404 });
  try {
    const bytes = await readFile(game.coverPath);
    return new Response(bytes, {
      headers: {
        "Content-Type": game.coverPath.endsWith(".webp") ? "image/webp" : "image/png",
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
