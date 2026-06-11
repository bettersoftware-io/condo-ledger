import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type pg from "pg";
import { makePool } from "../src/db.ts";
import { loadTable, resyncSequence } from "../etl/load.ts";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

d("loader", () => {
  // Lazily created in beforeAll: constructing the pool at collection time would
  // throw "DATABASE_URL is not set" and crash the file even on the skipped path,
  // since describe.skip skips test execution but still runs the callback body.
  let pool: pg.Pool;
  beforeAll(async () => {
    pool = makePool(url);
    await pool.query(`CREATE TABLE IF NOT EXISTS _l_demo (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name text, created timestamptz)`);
    await pool.query(`TRUNCATE _l_demo RESTART IDENTITY`);
  });
  afterAll(async () => { await pool.query(`DROP TABLE IF EXISTS _l_demo`); await pool.end(); });

  it("loads explicit ids under replica mode, then resync allows fresh insert", async () => {
    const client = await pool.connect();
    try {
      await client.query(`SET session_replication_role = 'replica'`);
      await loadTable(client, "_l_demo",
        [{ id: 5, name: "five", created: "2001-01-01T00:00:00.000Z" },
         { id: 9, name: "nine", created: null }]);
      await client.query(`SET session_replication_role = 'origin'`);
      await resyncSequence(client, "_l_demo", "id");
    } finally { client.release(); }

    const after = await pool.query(`INSERT INTO _l_demo (name) VALUES ('ten') RETURNING id`);
    expect(after.rows[0].id).toBe(10); // max(9)+1
    const five = await pool.query(`SELECT created FROM _l_demo WHERE id=5`);
    expect(new Date(five.rows[0].created).toISOString()).toBe("2001-01-01T00:00:00.000Z");
  });
});
