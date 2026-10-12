// Row-count parity (success-criterion §3.1): every operational table must hold
// exactly the rows the two per-condominium dumps contain — no drops, no dupes.
// expectedOperationalCounts() is the single source of truth (it tallies the same
// dumps the orchestrator loads Tier C from), so this proves the load is faithful.
//
// Integration suite: skips cleanly without DATABASE_URL (passWithNoTests:true),
// and skips visibly when the legacy dumps are not on this machine (CI).

import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { expectedOperationalCounts } from "../etl/expectedCounts.ts";
import { makePool } from "../src/db.ts";
import { dumpSuiteName, legacyDumpAvailable } from "./legacyDump.ts";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

// The files expectedOperationalCounts() reads.
const STRUCTURE = "it-jtime-condominium.structure.sql";
const DUMPS = [
  STRUCTURE,
  "it-jtime-condominium-saturno-only.data.sql",
  "it-jtime-condominium-pozzetto-only.data.sql",
];

const missing = DUMPS.find((name) => {
  return !legacyDumpAvailable(name);
});

describe.skipIf(missing !== undefined)(
  dumpSuiteName("operational row-count parity", missing ?? STRUCTURE),
  () => {
    // One test per table, so the counts are needed to name the tests. A skipped
    // describe still runs this callback, hence the guard: without the dumps
    // nothing is read, and the one placeholder below carries the skip reason
    // into the report (a suite with no test is not listed).
    if (missing !== undefined) {
      it("compares every operational table with the dumps", () => {});

      return;
    }

    const expected = expectedOperationalCounts();

    d("against the database", () => {
      let pool: pg.Pool;
      beforeAll(() => {
        pool = makePool(url);
      });
      afterAll(() => {
        return pool.end();
      });

      for (const [table, n] of Object.entries(expected)) {
        it(`${table} has ${n} rows`, async () => {
          const r = await pool.query(`SELECT count(*)::int n FROM "${table}"`);
          expect(r.rows[0].n).toBe(n);
        });
      }
    });
  },
);
