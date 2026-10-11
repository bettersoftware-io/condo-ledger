import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

export function makePool(url = process.env.DATABASE_URL): pg.Pool {
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  return new pg.Pool({ connectionString: url });
}

export function makeDb(url = process.env.DATABASE_URL) {
  return drizzle(makePool(url));
}
