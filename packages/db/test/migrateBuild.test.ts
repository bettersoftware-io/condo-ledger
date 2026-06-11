import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type pg from "pg";
import { makePool } from "../src/db.ts";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

d("migrated schema", () => {
  // Lazily created in beforeAll: constructing the pool at collection time would
  // throw "DATABASE_URL is not set" and crash the file even on the skipped path,
  // since describe.skip skips test execution but still runs the callback body.
  let pool: pg.Pool;
  beforeAll(() => {
    pool = makePool(url);
  });
  afterAll(() => pool.end());

  it("has 94 base tables", async () => {
    // Exclude leading-underscore tables: drizzle's `__drizzle_migrations` and the
    // transient `_`-prefixed scratch tables other integration suites create/drop
    // (e.g. `_t_demo`, `_l_demo`). Real schema tables are all snake_case starting
    // with a letter, so this keeps the count stable under parallel test files.
    const r = await pool.query(
      `SELECT count(*)::int n FROM information_schema.tables
       WHERE table_schema='public' AND table_type='BASE TABLE'
       AND table_name NOT LIKE '\\_%'`);
    expect(r.rows[0].n).toBe(94);
  });
  it("has 23 enum types", async () => {
    const r = await pool.query(`SELECT count(*)::int n FROM pg_type WHERE typtype='e'`);
    expect(r.rows[0].n).toBe(23);
  });
  it("has 6 views", async () => {
    const r = await pool.query(
      `SELECT count(*)::int n FROM information_schema.views WHERE table_schema='public'`);
    expect(r.rows[0].n).toBe(6);
  });
  it("attached set_timestamps to every table with created/updated", async () => {
    // Scope to BASE TABLE: information_schema.columns also lists view columns,
    // and the 6 views surface a `created` column from their base table. Views
    // cannot carry this trigger, so they must not count as "missing" it.
    // Also exclude leading-underscore scratch tables (e.g. _l_demo from
    // load.test.ts) that other parallel suites transiently create with a
    // `created` column but no trigger — they would flake this count otherwise.
    const r = await pool.query(`
      SELECT count(*)::int n FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema=c.table_schema AND t.table_name=c.table_name
      WHERE c.table_schema='public' AND c.column_name='created'
      AND t.table_type='BASE TABLE'
      AND t.table_name NOT LIKE '\\_%'
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.triggers tg
        WHERE tg.event_object_table=c.table_name AND tg.trigger_name='set_timestamps')`);
    expect(r.rows[0].n).toBe(0);
  });
});
