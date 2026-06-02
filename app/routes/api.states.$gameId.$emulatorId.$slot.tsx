import type { Route } from "./+types/api.states.$gameId.$emulatorId.$slot";
import { loadState, saveState } from "../lib/library.server";
import type { EmulatorId } from "../lib/rom";

export function loader({ params }: Route.LoaderArgs) {
  const bytes = loadState(params.gameId, params.emulatorId as EmulatorId, Number(params.slot));
  if (!bytes) return new Response(null, { status: 204 });
  return new Response(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
    },
  });
}

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  saveState(params.gameId, params.emulatorId as EmulatorId, Number(params.slot), bytes);
  return Response.json({ ok: true });
}
