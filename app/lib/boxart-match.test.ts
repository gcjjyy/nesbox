import { describe, expect, it } from "vitest";
import { findBoxart, originalTitleOf } from "./boxart-match";

const INDEX = [
  "Rockman 4 - Aratanaru Yabou!! (1991-06-12)(Capcom)(JP)",
  "Rockman 4 - Aratanaru Yabou!! (Japan) (Virtual Console)",
  "Rockman 4 - Aratanaru Yabou!! (Japan)",
  "Bubble Bobble (Europe)",
  "Bubble Bobble (USA)",
  "Bubble Bobble (USA) (Virtual Console)",
  "Contra (Japan)",
  "Contra (USA)",
  "Micro Mages (World) (Aftermarket) (Unl)",
];

describe("findBoxart", () => {
  it("matches exact titles regardless of tags and punctuation", () => {
    expect(findBoxart("Rockman 4 - Aratanaru Yabou!! (J).nes", INDEX)).toBe("Rockman 4 - Aratanaru Yabou!! (Japan)");
    expect(findBoxart("Micro_Mages", INDEX)).toBe("Micro Mages (World) (Aftermarket) (Unl)");
  });

  it("prefers the region named in the file", () => {
    expect(findBoxart("Bubble Bobble (U)", INDEX)).toBe("Bubble Bobble (USA)");
    expect(findBoxart("Bubble Bobble (E)", INDEX)).toBe("Bubble Bobble (Europe)");
    expect(findBoxart("Contra (J)", INDEX)).toBe("Contra (Japan)");
    expect(findBoxart("[K]Contra", INDEX)).toBe("Contra (Japan)");
  });

  it("returns null when nothing matches exactly", () => {
    expect(findBoxart("Contra Force", INDEX)).toBeNull();
    expect(findBoxart("100-in-1", INDEX)).toBeNull();
  });
});

describe("originalTitleOf", () => {
  it("drops region and release tags", () => {
    expect(originalTitleOf("Rockman 4 - Aratanaru Yabou!! (Japan)")).toBe("Rockman 4 - Aratanaru Yabou!!");
    expect(originalTitleOf("Micro Mages (World) (Aftermarket) (Unl)")).toBe("Micro Mages");
    expect(originalTitleOf("MetalMech - Man _ Machine (USA)")).toBe("MetalMech - Man & Machine");
  });
});
