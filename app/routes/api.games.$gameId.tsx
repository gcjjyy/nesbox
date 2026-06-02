import type { Route } from "./+types/api.games.$gameId";
import { deleteGame, getGame, touchGame } from "../lib/library.server";

export function loader({ params }: Route.LoaderArgs) {
  const game = getGame(params.gameId);
  if (!game) return new Response("not found", { status: 404 });
  return Response.json({ game });
}

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method === "DELETE") {
    deleteGame(params.gameId);
    return Response.json({ ok: true });
  }
  if (request.method === "PATCH") {
    touchGame(params.gameId);
    return Response.json({ ok: true });
  }
  return new Response("method not allowed", { status: 405 });
}
