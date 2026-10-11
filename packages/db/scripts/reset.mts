// No-docker schema reset: wipe the database to an empty `public` schema so a
// fresh `migrate` + `seed` can rebuild it from nothing. Used by `pnpm rebuild`.
//
// This intentionally does NOT touch docker. The DB must already be up — on a host
// that means `pnpm db:up` first; in the sibling-container sandbox the Postgres is
// always running. We connect via DATABASE_URL and drop BOTH the application schema
// (`public`) and drizzle's migration-bookkeeping schema (`drizzle`), then recreate
// an empty `public`. Dropping `drizzle` is essential: leaving the migration journal
// behind makes `drizzle-kit migrate` think everything is already applied and skip
// rebuilding the tables.
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
try {
  await pool.query(`
    DROP SCHEMA public CASCADE;
    DROP SCHEMA IF EXISTS drizzle CASCADE;
    CREATE SCHEMA public;
  `);
  console.log("reset: dropped public + drizzle schemas, recreated empty public");
} catch (error) {
  console.error("reset failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
