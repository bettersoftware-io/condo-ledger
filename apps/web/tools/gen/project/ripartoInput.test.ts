// apps/web/tools/gen/project/ripartoInput.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTables } from "../loadRows.ts";
import { buildDb } from "../db.ts";
import { dbToRipartoInput } from "./ripartoInput.ts";
import { buildRiparto } from "@cl/domain";

// cwd = apps/web under Vitest; the dump is read cwd-relative (a known Vitest quirk).
const db = buildDb(parseTables(readFileSync(resolve(process.cwd(), "../../old/db/it-jtime-condominium.all.sql"), "utf8")));

describe("dbToRipartoInput", () => {
  it("produces a non-empty, well-formed input for Pozzetto 2013 (period 36)", () => {
    const input = dbToRipartoInput(db, "36");
    expect(input.accounts.length).toBeGreaterThan(0);
    expect(input.unitLegacyIds.length).toBeGreaterThan(0);
    expect(input.tableItems.length).toBeGreaterThan(0);
  });

  it("feeds the pure engine: matrix ties out to the linked-expense subtree (conservation)", () => {
    const eng = buildRiparto(dbToRipartoInput(db, "36"));
    const matrix = eng.columns.reduce(
      (s, c) => s + eng.unitLegacyIds.reduce((u, id) => u + eng.perUnitAmount(c.legacyAccountId, "estimate", id), 0),
      0,
    );
    const src = eng.columns.reduce((s, c) => s + eng.subtree(c.legacyAccountId).estimateCents, 0);
    // per-cell rounding tolerance (Math.round per column×unit)
    expect(Math.abs(matrix - src)).toBeLessThanOrEqual(eng.columns.length * eng.unitLegacyIds.length);
  });
});
