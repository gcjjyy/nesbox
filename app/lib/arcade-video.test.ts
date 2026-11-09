import { expect, it } from "vitest";
import { arcadeDisplaySize } from "./arcade-video";

it("uses the core display aspect rather than non-square framebuffer pixels", () => {
  expect(arcadeDisplaySize(224, 256, 0.75)).toEqual({ width: 192, height: 256 });
  expect(arcadeDisplaySize(384, 224, 4 / 3)?.width).toBeCloseTo(224 * 4 / 3);
});
it("falls back to valid framebuffer dimensions when no display aspect is available", () => {
  expect(arcadeDisplaySize(224, 288, 0)).toEqual({ width: 224, height: 288 });
  expect(arcadeDisplaySize(224, 288, NaN)).toEqual({ width: 224, height: 288 });
  expect(arcadeDisplaySize(0, 0, 0.75)).toBeNull();
  expect(arcadeDisplaySize(Infinity, 256, 0.75)).toBeNull();
});
