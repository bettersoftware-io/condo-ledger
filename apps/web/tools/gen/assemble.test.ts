import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTables } from "./loadRows.ts";
import { buildDb } from "./db.ts";
import { assemble } from "./assemble.ts";

const SQL = readFileSync(resolve(process.cwd(), "../../old/db/it-jtime-condominium.all.sql"), "utf8");

describe("assemble (real dump)", () => {
  const seed = assemble(buildDb(parseTables(SQL)));
  it("emits multiple real condominiums and a large anagrafiche registry", () => {
    expect(seed.tree.length).toBeGreaterThanOrEqual(6);
    expect(seed.anagrafiche.length).toBeGreaterThan(80);
    expect(seed.anagraficaCategories.length).toBeGreaterThan(5);
  });
  it("Saturno 2011 and Pozzetto 2013 have populated, balanced books", () => {
    const periods = seed.tree.flatMap((c) => c.periods.map((p) => p.id));
    const withAccounts = periods.filter((pid) => (seed.ledgerAccountsByPeriod[pid] ?? []).length > 0);
    expect(withAccounts.length).toBeGreaterThanOrEqual(2);
    for (const pid of withAccounts) {
      const txns = seed.ledgerTxnsByPeriod[pid] ?? [];
      if (txns.length === 0) continue;
      const dare = txns.reduce((s, t) => s + t.dare.cents, 0);
      const avere = txns.reduce((s, t) => s + t.avere.cents, 0);
      expect(dare).toBe(avere);
    }
  });
  it("every anagrafica has a known category", () => {
    const cats = new Set(seed.anagraficaCategories);
    expect(seed.anagrafiche.every((a) => cats.has(a.categoria))).toBe(true);
  });
});
