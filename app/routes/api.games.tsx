import type { Route } from "./+types/api.games";
import { importOpenEmuGames, listGames, saveUploadedGame } from "../lib/library.server";

export function loader() {
  return Response.json({ games: listGames() });
}

export async function action({ request }: Route.ActionArgs) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { action?: string };
    if (body.action === "import-openemu") {
      return Response.json(importOpenEmuGames());
    }
    return new Response("unknown action", { status: 400 });
  }

  const form = await request.formData();
  const file = form.get("rom");
  if (!(file instanceof File)) {
    return new Response("missing rom file", { status: 400 });
  }
  const game = saveUploadedGame(file.name, new Uint8Array(await file.arrayBuffer()));
  return Response.json({ game });
}
