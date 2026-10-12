import { readFileSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import { assemble, type Seed } from "./assemble.ts";
import { buildDb } from "./db.ts";
import {
  dumpSuiteName,
  legacyDumpAvailable,
  legacyDumpPath,
} from "./legacyDump.ts";
import { parseTables } from "./loadRows.ts";

describe.skipIf(!legacyDumpAvailable())(
  dumpSuiteName("assemble (real dump)"),
  () => {
    beforeAll(() => {
      seed = assemble(
        buildDb(parseTables(readFileSync(legacyDumpPath(), "utf8"))),
      );
    });

    it("emits multiple real condominiums and a large anagrafiche registry", () => {
      expect(seed.tree.length).toBeGreaterThanOrEqual(6);
      expect(seed.anagrafiche.length).toBeGreaterThan(80);
      expect(seed.anagraficaCategories.length).toBeGreaterThan(5);
    });
    it("Saturno 2011 and Pozzetto 2013 have populated, balanced books", () => {
      const periods = seed.tree.flatMap((c) => {
        return c.periods.map((p) => {
          return p.id;
        });
      });

      const withAccounts = periods.filter((pid) => {
        return (seed.ledgerAccountsByPeriod[pid] ?? []).length > 0;
      });
      expect(withAccounts.length).toBeGreaterThanOrEqual(2);

      for (const pid of withAccounts) {
        const txns = seed.ledgerTxnsByPeriod[pid] ?? [];

        if (txns.length === 0) {
          continue;
        }

        const dare = txns.reduce((s, t) => {
          return s + t.dare.cents;
        }, 0);

        const avere = txns.reduce((s, t) => {
          return s + t.avere.cents;
        }, 0);
        expect(dare).toBe(avere);
      }
    });
    it("every anagrafica has a known category", () => {
      const cats = new Set(seed.anagraficaCategories);
      expect(
        seed.anagrafiche.every((a) => {
          return cats.has(a.categoria);
        }),
      ).toBe(true);
    });

    let seed: Seed;
  },
);
