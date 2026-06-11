// Sequence health (success-criterion §3.3): after loading legacy rows with their
// original ids, each table's identity sequence must be resynced PAST the highest
// loaded id — otherwise the next insert collides with an existing pk. We prove the
// resync advanced the sequence by inserting a fresh row and asserting its
// generated id is strictly greater than max(id) measured before the insert.
//
// The probe runs inside a transaction we ROLLBACK, so it never pollutes the
// operational row counts that fkIntegrity/rowCounts assert. (The identity sequence
// itself does advance — sequences are non-transactional — which is precisely the
// behavior under test and harmless to the seeded dataset.)
//
// Integration suite: skips cleanly without DATABASE_URL (passWithNoTests:true).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type pg from "pg";
import { makePool } from "../src/db.ts";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

d("sequence health", () => {
  let pool: pg.Pool;
  beforeAll(() => {
    pool = makePool(url);
  });
  afterAll(() => pool.end());

  it("unit.id sequence was resynced past the max loaded id", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Reuse an existing row's NOT NULL FK values so the probe insert is valid
      // regardless of which ids the seed produced.
      const max = await client.query(
        `SELECT id, studio_id, accounting_period_id
         FROM unit ORDER BY id DESC LIMIT 1`,
      );
      const before = max.rows[0];
      const ins = await client.query(
        `INSERT INTO unit (studio_id, accounting_period_id, name)
         VALUES ($1, $2, 'seq-probe') RETURNING id`,
        [before.studio_id, before.accounting_period_id],
      );
      expect(ins.rows[0].id).toBeGreaterThan(before.id);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});
