import { readFileSync } from "node:fs";

import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { makePool } from "../src/db.ts";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip; // skip when no DB configured

d("set_timestamps trigger", () => {
  // Lazily created in beforeAll: constructing the pool at collection time would
  // throw "DATABASE_URL is not set" and crash the file even on the skipped path,
  // since describe.skip skips test execution but still runs the callback body.
  let pool: pg.Pool;
  beforeAll(async () => {
    pool = makePool(url);
    await pool.query(
      readFileSync(new URL("../src/sql/triggers.sql", import.meta.url), "utf8"),
    );
    await pool.query(`CREATE TABLE IF NOT EXISTS _t_demo (
      id serial primary key, created timestamptz, updated timestamptz)`);
    await pool.query(`DROP TRIGGER IF EXISTS set_timestamps ON _t_demo`);
    await pool.query(`CREATE TRIGGER set_timestamps BEFORE INSERT OR UPDATE ON _t_demo
      FOR EACH ROW EXECUTE FUNCTION set_timestamps()`);
  });
  afterAll(async () => {
    await pool.query(`DROP TABLE IF EXISTS _t_demo`);
    await pool.end();
  });

  it("sets created on insert when null, leaves it on update", async () => {
    const ins = await pool.query(
      `INSERT INTO _t_demo DEFAULT VALUES RETURNING id, created, updated`,
    );
    const { id, created, updated } = ins.rows[0];
    expect(created).not.toBeNull();
    await pool.query(`UPDATE _t_demo SET id = id WHERE id = $1`, [id]);
    const after = await pool.query(
      `SELECT created, updated FROM _t_demo WHERE id = $1`,
      [id],
    );
    expect(new Date(after.rows[0].created).getTime()).toBe(
      new Date(created).getTime(),
    );
    expect(new Date(after.rows[0].updated).getTime()).toBeGreaterThan(
      new Date(updated).getTime(),
    );
  });

  it("preserves an explicitly provided created (COALESCE semantics)", async () => {
    const ts = "2001-02-03T04:05:06Z";
    const ins = await pool.query(
      `INSERT INTO _t_demo (created) VALUES ($1) RETURNING created`,
      [ts],
    );
    expect(new Date(ins.rows[0].created).toISOString()).toBe(
      "2001-02-03T04:05:06.000Z",
    );
  });
});
