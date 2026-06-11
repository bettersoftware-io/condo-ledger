// Referential integrity (success-criterion §3.2): the seed loads under
// session_replication_role='replica' (FK triggers OFF), so a faithful load is not
// automatically a referentially-sound one. This suite re-enables the check after
// the fact: for every FK in the schema, count child rows whose non-null FK value
// has no matching parent. The offenders list must be empty.
//
// Integration suite: skips cleanly without DATABASE_URL (passWithNoTests:true).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type pg from "pg";
import { makePool } from "../src/db.ts";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

d("foreign-key integrity", () => {
  let pool: pg.Pool;
  beforeAll(() => {
    pool = makePool(url);
  });
  afterAll(() => pool.end());

  it("has zero orphan rows across all foreign keys", async () => {
    const fks = await pool.query(`
      SELECT tc.table_name AS child, kcu.column_name AS col,
             ccu.table_name AS parent, ccu.column_name AS pcol
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name
      WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'`);
    const offenders: string[] = [];
    for (const fk of fks.rows) {
      const q = `SELECT count(*)::int c FROM "${fk.child}" ch
        WHERE ch."${fk.col}" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "${fk.parent}" p WHERE p."${fk.pcol}" = ch."${fk.col}")`;
      const r = await pool.query(q);
      if (r.rows[0].c > 0) offenders.push(`${fk.child}.${fk.col} -> ${fk.parent} (${r.rows[0].c})`);
    }
    expect(offenders).toEqual([]);
  });
});
