import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTables } from "./loadRows.ts";
import { buildDb } from "./db.ts";
import { assemble } from "./assemble.ts";
import { recomputePeriod, type ResidentBalance } from "@cl/domain";

const SQL = readFileSync(resolve(process.cwd(), "../../old/db/it-jtime-condominium.all.sql"), "utf8");

function loadSeed() {
  const db = buildDb(parseTables(SQL));
  return assemble(db);
}

function balancesById(bs: ResidentBalance[]): Map<string, ResidentBalance> {
  return new Map(bs.map((b) => [b.residentId, b]));
}

describe("assemble: periodStateByPeriod / individualByPeriod", () => {
  const seed = loadSeed();

  it("emits a PeriodState for every period (matching the distribution gate)", () => {
    const dist = seed.distributionByPeriod;
    const ps = seed.periodStateByPeriod;
    expect(Object.keys(ps).sort()).toEqual(Object.keys(seed.unitsByPeriod).sort());
    const withBooks = Object.keys(dist).filter((pid) => seed.distributionByPeriod[pid]!.estimate.rows.length > 0);
    expect(withBooks.length).toBeGreaterThan(0);
    for (const pid of withBooks) {
      expect(ps[pid]!.riparto.unitLegacyIds.length).toBeGreaterThan(0);
    }
  });

  it("survives a JSON round-trip and reproduces recomputePeriod balances byte-for-byte", () => {
    const withBooks = Object.keys(seed.periodStateByPeriod).filter(
      (pid) => seed.periodStateByPeriod[pid]!.riparto.unitLegacyIds.length > 0,
    );
    for (const pid of withBooks) {
      const original = seed.periodStateByPeriod[pid]!;
      const roundTripped = JSON.parse(JSON.stringify(original)) as typeof original;
      expect(roundTripped).toEqual(original);
      const a = balancesById(recomputePeriod(original).balances);
      const b = balancesById(recomputePeriod(roundTripped).balances);
      expect(b.size).toBe(a.size);
      for (const [rid, bal] of a) expect(b.get(rid)).toEqual(bal);
    }
  });

  it("individualByPeriod is keyed by residentIds present in the period roster", () => {
    const withBooks = Object.keys(seed.periodStateByPeriod).filter(
      (pid) => seed.periodStateByPeriod[pid]!.riparto.unitLegacyIds.length > 0,
    );
    for (const pid of withBooks) {
      const roster = new Set(seed.periodStateByPeriod[pid]!.riparto.residents.map((r) => r.residentId));
      for (const rid of Object.keys(seed.individualByPeriod[pid] ?? {})) {
        expect(roster.has(rid)).toBe(true);
      }
    }
  });
});
