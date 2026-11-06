import { describe, expect, it } from "vitest";
import { action } from "./api.games";

describe("games collection API", () => {
  it("rejects removed upload and OpenEmu import mutations", async () => {
    const request = new Request("http://nesbox.test/api/games", { method: "POST" });
    const response = await action({ request } as Parameters<typeof action>[0]);

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
  });
});
