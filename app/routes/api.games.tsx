import type { Route } from "./+types/api.games";
import { autoAttachBoxart } from "../lib/covers.server";
import { getGame, importOpenEmuGames, listGames, saveUploadedGame } from "../lib/library.server";

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
  const saved = saveUploadedGame(file.name, new Uint8Array(await file.arrayBuffer()));
  await autoAttachBoxart(saved);
  const { romPath: _romPath, coverPath: _coverPath, ...game } = getGame(saved.id) ?? saved;
  return Response.json({ game });
}
