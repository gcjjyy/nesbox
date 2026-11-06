import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRomBytes } from "./library-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchRomBytes", () => {
  it("streams one response and reports monotonic progress with a known length", async () => {
    const progress: Array<[number, number | null]> = [];
    const fetch = vi.fn(async () => new Response(stream([[1, 2], [3], [4, 5]]), {
      status: 200,
      headers: { "Content-Length": "5" },
    }));
    vi.stubGlobal("fetch", fetch);

    await expect(fetchRomBytes("large game", (loaded, total) => progress.push([loaded, total])))
      .resolves.toEqual(new Uint8Array([1, 2, 3, 4, 5]));

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/games/large%20game/rom", { credentials: "same-origin" });
    expect(progress).toEqual([[0, 5], [2, 5], [3, 5], [5, 5]]);
  });

  it("streams without Content-Length and keeps total unknown", async () => {
    const progress: Array<[number, number | null]> = [];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(stream([[9], [8, 7]]), { status: 200 })));

    await expect(fetchRomBytes("x", (loaded, total) => progress.push([loaded, total])))
      .resolves.toEqual(new Uint8Array([9, 8, 7]));
    expect(progress).toEqual([[0, null], [1, null], [3, null]]);
  });

  it("surfaces a non-OK response without reading a second response", async () => {
    const fetch = vi.fn(async () => new Response("ROM missing", { status: 404 }));
    vi.stubGlobal("fetch", fetch);

    await expect(fetchRomBytes("gone")).rejects.toThrow("ROM missing");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

function stream(chunks: number[][]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk));
      controller.close();
    },
  });
}
