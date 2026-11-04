import type { Route } from "./+types/api.games.$gameId";
import { getGame } from "../lib/library.server";

export function loader({ params }: Route.LoaderArgs) {
  const game = getGame(params.gameId);
  if (!game) return new Response("not found", { status: 404 });
  const { romPath: _romPath, coverPath: _coverPath, ...entry } = game;
  return Response.json({ game: entry });
}
