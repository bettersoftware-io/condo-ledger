// Single source of truth for operational row-count parity: how many rows each
// Tier-C table should hold after a seed. Derived by parsing the two per-condominium
// operational dumps (Saturno + Pozzetto) — the same files the orchestrator loads
// Tier C from — and tallying rows per table (snake_cased to match the live schema).
//
// The dumps are column-LESS, so we pass a DDL-derived column resolver. Row counts
// don't depend on the studioId column override (counts are just rows.length), so a
// plain DDL resolver is fine here.

import { readFileSync } from "node:fs";
import { parseInserts } from "./parse.ts";
import { parseDdl, tableColumns } from "./ddl.ts";
import { FILES } from "./sources.ts";
import { toSnake } from "../src/naming.ts";

export function expectedOperationalCounts(): Record<string, number> {
  const ddl = parseDdl(
    readFileSync(
      new URL("../../../old/db/it-jtime-condominium.structure.sql", import.meta.url),
      "utf8",
    ),
  );
  const resolve = (t: string): string[] => tableColumns(ddl, t);
  const stmts = [
    ...parseInserts(readFileSync(FILES.saturnoOnly, "utf8"), resolve),
    ...parseInserts(readFileSync(FILES.pozzettoOnly, "utf8"), resolve),
  ];
  const counts: Record<string, number> = {};
  for (const s of stmts) {
    counts[toSnake(s.table)] = (counts[toSnake(s.table)] ?? 0) + s.rows.length;
  }
  return counts;
}
