import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadExtraEntries } from "./leftovers.ts";

describe("loadExtraEntries", () => {
  it("reads the local list beside the dump as name entries", () => {
    const dir = folderWith({
      entries: [
        {
          original: "Lumenix Assicura",
          replacement: "Assicurazioni del Varmo S.p.A.",
          anyCase: true,
        },
        { original: "Fintobanca", replacement: "Credito Carnico" },
      ],
    });

    expect(loadExtraEntries(dir)).toEqual([
      {
        original: "Lumenix Assicura",
        pseudonym: "Assicurazioni del Varmo S.p.A.",
        anyCase: true,
      },
      { original: "Fintobanca", pseudonym: "Credito Carnico", anyCase: false },
    ]);
  });

  it("returns no entries when the file is not there", () => {
    expect(loadExtraEntries(mkdtempSync(join(tmpdir(), "leftovers-")))).toEqual(
      [],
    );
  });

  it("refuses a file that does not have the expected shape", () => {
    expect(() => {
      return loadExtraEntries(folderWith({ entries: [{ original: "x" }] }));
    }).toThrow(/leftovers\.json/);
    expect(() => {
      return loadExtraEntries(folderWith({ list: [] }));
    }).toThrow(/leftovers\.json/);
  });

  it("reads the folder named by LEGACY_DUMP_DIR by default", () => {
    const dir = folderWith({
      entries: [{ original: "Fintobanca", replacement: "Credito Carnico" }],
    });
    const before = process.env.LEGACY_DUMP_DIR;
    process.env.LEGACY_DUMP_DIR = dir;

    try {
      expect(loadExtraEntries()).toHaveLength(1);
    } finally {
      if (before === undefined) {
        delete process.env.LEGACY_DUMP_DIR;
      } else {
        process.env.LEGACY_DUMP_DIR = before;
      }
    }
  });
});

function folderWith(content: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "leftovers-"));
  writeFileSync(join(dir, "leftovers.json"), JSON.stringify(content));
  return dir;
}
