import type { Route } from "./+types/api.games";
import { listGames } from "../lib/library.server";

export function loader() {
  return Response.json({ games: listGames() });
}

export async function action(_: Route.ActionArgs) {
  return new Response("game library is read-only", {
    status: 405,
    headers: { Allow: "GET" },
  });
}
