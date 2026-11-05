import { describe, expect, it } from "vitest";
import { markWelcomed, needsWelcome, WELCOME_KEY } from "./first-visit";

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

describe("first visit", () => {
  it("asks for welcome until marked", () => {
    const storage = memoryStorage();
    expect(needsWelcome(storage)).toBe(true);
    markWelcomed(storage);
    expect(storage.data.get(WELCOME_KEY)).toBe("1");
    expect(needsWelcome(storage)).toBe(false);
  });

  it("never shows without storage or when storage throws", () => {
    expect(needsWelcome(undefined)).toBe(false);
    expect(needsWelcome({ getItem: () => { throw new Error("blocked"); } })).toBe(false);
  });
});
