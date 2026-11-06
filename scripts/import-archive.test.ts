import { describe, expect, it } from "vitest";
import { parseArchiveImportArgs } from "./import-archive";

describe("parseArchiveImportArgs", () => {
  it("defaults a valid NES invocation to dry-run", () => {
    expect(parseArchiveImportArgs([
      "--kind", "nes",
      "--archive", "/archives/dosgamebox",
      "--data-dir", "/srv/nesbox-data",
      "--json",
    ])).toEqual({
      kind: "nes",
      archiveRoot: "/archives/dosgamebox",
      dataDir: "/srv/nesbox-data",
      json: true,
      apply: false,
    });
  });

  it("rejects relative archive and data paths", () => {
    expect(() => parseArchiveImportArgs([
      "--kind", "nes",
      "--archive", "../archive",
      "--data-dir", "/srv/nesbox-data",
    ])).toThrow("--archive must be an absolute path");
    expect(() => parseArchiveImportArgs([
      "--kind", "nes",
      "--archive", "/archives/dosgamebox",
      "--data-dir", "data",
    ])).toThrow("--data-dir must be an absolute path");
  });

  it("rejects unknown flags instead of silently ignoring them", () => {
    expect(() => parseArchiveImportArgs([
      "--kind", "nes",
      "--archive", "/archives/dosgamebox",
      "--data-dir", "/srv/nesbox-data",
      "--force",
    ])).toThrow("unknown argument: --force");
  });
});
