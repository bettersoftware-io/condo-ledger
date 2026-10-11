import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("exportMapping (the program)", () => {
  it("refuses to write the mapping inside the repository", () => {
    const inside = resolve(import.meta.dirname, "mapping.refused.txt");
    const run = spawnSync(process.execPath, [PROGRAM, inside], {
      encoding: "utf8",
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/refusing to write .* inside the repository/);
    expect(existsSync(inside)).toBe(false);
  });

  it("says how to call it when the output file is missing", () => {
    const run = spawnSync(process.execPath, [PROGRAM], { encoding: "utf8" });

    expect(run.status).toBe(2);
    expect(run.stderr).toMatch(
      /usage: node src\/pseudonymise\/exportMapping\.ts <out-file>/,
    );
  });
});

// The program is run as Node runs it; these cases stop before the dump is read.
const PROGRAM = resolve(import.meta.dirname, "exportMapping.ts");
