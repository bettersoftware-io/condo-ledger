import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildDb, type Db } from "#/db.ts";
import { parseTables, type Tables } from "#/loadRows.ts";

let cachedTables: Tables | null = null;
let cachedDb: Db | null = null;

/** Parse the 48 MB dump once per worker (cwd = packages/legacy-import under Vitest). */
function legacyTables(): Tables {
  if (!cachedTables) {
    const path = resolve(
      process.cwd(),
      "../../old/db/it-jtime-condominium.all.sql",
    );
    cachedTables = parseTables(readFileSync(path, "utf8"));
  }

  return cachedTables;
}

export function legacyDb(): Db {
  if (!cachedDb) {
    cachedDb = buildDb(legacyTables());
  }

  return cachedDb;
}

export interface SpecWorld {
  db: Db;
  legacyPeriodId?: string; // e.g. "1"
  result?: unknown; // last computed value
  [k: string]: unknown;
}

export function makeWorld(): SpecWorld {
  return { db: legacyDb() };
}

/** "Saturno 2011" → legacy accountingPeriod id ("1"). Last token = year, rest = building name. */
export function resolvePeriod(db: Db, label: string): string {
  const parts = label.trim().split(/\s+/);
  const year = parts[parts.length - 1]!;
  const condName = parts.slice(0, -1).join(" ");
  const cond = db.rows("condominium").find((c) => {
    return String(c.name) === condName;
  });

  if (!cond) {
    throw new Error(`No condominium named "${condName}"`);
  }

  const period = db.rows("accountingPeriod").find((p) => {
    return (
      String(p.condominiumId) === String(cond.id) && String(p.name) === year
    );
  });

  if (!period) {
    throw new Error(`No period "${year}" for condominium "${condName}"`);
  }

  return String(period.id);
}
