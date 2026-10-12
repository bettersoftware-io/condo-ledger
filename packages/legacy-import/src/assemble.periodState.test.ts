import { readFileSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import { type ResidentBalance, recomputePeriod } from "@cl/domain";

import { assemble, type Seed } from "./assemble.ts";
import { buildDb } from "./db.ts";
import {
  dumpSuiteName,
  legacyDumpAvailable,
  legacyDumpPath,
} from "./legacyDump.ts";
import { parseTables } from "./loadRows.ts";

describe.skipIf(!legacyDumpAvailable())(
  dumpSuiteName("assemble: periodStateByPeriod / individualByPeriod"),
  () => {
    beforeAll(() => {
      seed = loadSeed();
    });

    it("emits a PeriodState for every period (matching the distribution gate)", () => {
      const dist = seed.distributionByPeriod;
      const ps = seed.periodStateByPeriod;
      expect(Object.keys(ps).sort()).toEqual(
        Object.keys(seed.unitsByPeriod).sort(),
      );
      const withBooks = Object.keys(dist).filter((pid) => {
        return seed.distributionByPeriod[pid]!.estimate.rows.length > 0;
      });
      expect(withBooks.length).toBeGreaterThan(0);

      for (const pid of withBooks) {
        expect(ps[pid]!.riparto.unitLegacyIds.length).toBeGreaterThan(0);
      }
    });

    it("survives a JSON round-trip and reproduces recomputePeriod balances byte-for-byte", () => {
      const withBooks = Object.keys(seed.periodStateByPeriod).filter((pid) => {
        return seed.periodStateByPeriod[pid]!.riparto.unitLegacyIds.length > 0;
      });

      for (const pid of withBooks) {
        const original = seed.periodStateByPeriod[pid]!;
        const roundTripped = JSON.parse(
          JSON.stringify(original),
        ) as typeof original;
        expect(roundTripped).toEqual(original);
        const a = balancesById(recomputePeriod(original).balances);
        const b = balancesById(recomputePeriod(roundTripped).balances);
        expect(b.size).toBe(a.size);

        for (const [rid, bal] of a) {
          expect(b.get(rid)).toEqual(bal);
        }
      }
    });

    it("individualByPeriod is keyed by residentIds present in the period roster", () => {
      const withBooks = Object.keys(seed.periodStateByPeriod).filter((pid) => {
        return seed.periodStateByPeriod[pid]!.riparto.unitLegacyIds.length > 0;
      });

      for (const pid of withBooks) {
        const roster = new Set(
          seed.periodStateByPeriod[pid]!.riparto.residents.map((r) => {
            return r.residentId;
          }),
        );

        for (const rid of Object.keys(seed.individualByPeriod[pid] ?? {})) {
          expect(roster.has(rid)).toBe(true);
        }
      }
    });

    let seed: Seed;
  },
);

function loadSeed() {
  const db = buildDb(parseTables(readFileSync(legacyDumpPath(), "utf8")));
  return assemble(db);
}

function balancesById(bs: ResidentBalance[]): Map<string, ResidentBalance> {
  return new Map(
    bs.map((b) => {
      return [b.residentId, b];
    }),
  );
}
