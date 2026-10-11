// Enum-domain enforcement (success-criterion §3.2): the schema's enum types must
// actually reject out-of-domain values at write time — a Postgres enum, not a
// free-text column with a comment. Probe with a value outside the domain and
// assert the INSERT is rejected with the enum domain error.
//
// Integration suite: skips cleanly without DATABASE_URL (passWithNoTests:true).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type pg from "pg";
import { makePool } from "../src/db.ts";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

d("enum domains", () => {
  let pool: pg.Pool;
  beforeAll(() => {
    pool = makePool(url);
  });
  afterAll(() => {return pool.end()});

  it("rejects an out-of-domain ledger_account.type", async () => {
    await expect(pool.query(`INSERT INTO ledger_account (type) VALUES ('bogus')`))
      .rejects.toThrow(/invalid input value for enum/i);
  });
});
