// Row-count parity (success-criterion §3.1): every operational table must hold
// exactly the rows the two per-condominium dumps contain — no drops, no dupes.
// expectedOperationalCounts() is the single source of truth (it tallies the same
// dumps the orchestrator loads Tier C from), so this proves the load is faithful.
//
// Integration suite: skips cleanly without DATABASE_URL (passWithNoTests:true).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type pg from "pg";
import { makePool } from "../src/db.ts";
import { expectedOperationalCounts } from "../etl/expectedCounts.ts";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

d("operational row-count parity", () => {
  let pool: pg.Pool;
  beforeAll(() => {
    pool = makePool(url);
  });
  afterAll(() => pool.end());

  const expected = expectedOperationalCounts();
  for (const [table, n] of Object.entries(expected)) {
    it(`${table} has ${n} rows`, async () => {
      const r = await pool.query(`SELECT count(*)::int n FROM "${table}"`);
      expect(r.rows[0].n).toBe(n);
    });
  }
});
