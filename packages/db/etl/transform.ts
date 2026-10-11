// DDL-driven row transform. Given the parsed DDL (single source of truth for
// column names + types), turn a legacy positional row into a schema-shaped object
// ready for insert: rename columns to the authored snake_case schema names and
// coerce values by their declared MySQL type (bool / Rome-local datetime ->
// UTC / calendar date passthrough / raw passthrough).

import { classify, type DdlColumn } from "./ddl.ts";
import { toSnake } from "../src/naming.ts";

export type TransformValue = string | number | boolean | null;

// Factory: bind the DDL so callers transform rows table-by-table.
export function makeTransform(
  ddl: Record<string, DdlColumn[]>,
): (
  table: string,
  columns: string[],
  values: Array<string | null>,
) => Record<string, TransformValue> {
  // Per-table name->sqlType lookup, built once on first use (the ETL hot loop
  // runs this per column per row over the full dump — avoid a linear find each time).
  const typeByTable = new Map<string, Map<string, string>>();

  function typesFor(table: string): Map<string, string> {
    let m = typeByTable.get(table);

    if (!m) {
      m = new Map((ddl[table] ?? []).map((c) => {return [c.name, c.sqlType]}));
      typeByTable.set(table, m);
    }

    return m;
  }

  return function transformRow(table, columns, values) {
    const types = typesFor(table);
    const row: Record<string, TransformValue> = {};

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]!;
      const v = values[i] ?? null;
      const key = renameColumn(col);

      if (v === null) {
        row[key] = null;
        continue;
      }

      // ISO-3166-1 alpha-2 country codes are canonically UPPERCASE (the `country`
      // reference table keys on 'IT', 'FR', ...). Legacy master-data stores them
      // lowercase ('it'), which orphans the country FK. Canonicalize to uppercase
      // so the FK resolves to the existing parent — a lossless normalization (the
      // code still denotes the same country), not a data invention.
      if (key === "country_iso3166_1_a2" || key === "citizenship_iso3166_1_a2") {
        row[key] = v.toUpperCase();
        continue;
      }

      const sqlType = types.get(col);
      // Unknown column (not in DDL): pass through raw. Shouldn't happen for real
      // data, but we never crash on it.
      const kind = sqlType ? classify(sqlType) : "raw";

      switch (kind) {
        case "bool":
          row[key] = v === "1" || v === "true";
          break;
        case "tz":
          row[key] = romeToUtcIso(v);
          break;
        case "date":
          // Calendar date — pass through verbatim, no timezone conversion.
          row[key] = v;
          break;
        case "raw":
        default:
          row[key] = v;
          break;
      }
    }

    return row;
  };
}

// Rename a legacy column to its authored schema name. Two exact-match special
// cases (reserved word + audit timestamp); everything else is plain toSnake.
// NOTE: the exact-match on the whole string `"lastModified"` means audit-FK
// columns like `lastModifiedMasterDataId` fall through to toSnake unchanged.
function renameColumn(col: string): string {
  if (col === "default") return "is_default";
  if (col === "lastModified") return "updated";
  return toSnake(col);
}

// Interpret a 'YYYY-MM-DD HH:MM:SS' string as Europe/Rome wall-clock and return
// the equivalent instant as an ISO UTC string. CEST (+02:00) applies from the
// last Sunday of March to the last Sunday of October; CET (+01:00) otherwise.
// Contract: callers route only `datetime`/`timestamp` columns here (via classify),
// so `s` is always a full date+time — date-only strings would yield NaN.
function romeToUtcIso(s: string): string {
  const [d, t] = s.split(" ");
  const [Y, Mo, Da] = d!.split("-").map(Number);
  const [H, Mi, Se] = t!.split(":").map(Number);
  const offsetH = isCEST(Y!, Mo!, Da!) ? 2 : 1;
  const ms = Date.UTC(Y!, Mo! - 1, Da!, H! - offsetH, Mi!, Se!);
  return new Date(ms).toISOString();
}

// Day-granularity DST decision. The sub-day transition windows (~1h on the two
// changeover Sundays) are intentionally not special-cased — out of scope for this
// migration dataset (Module 0), per the plan.
function isCEST(Y: number, Mo: number, Da: number): boolean {
  function lastSun(y: number, m: number): number {
    const d = new Date(Date.UTC(y, m, 0));
    return d.getUTCDate() - d.getUTCDay();
  }

  const startDay = lastSun(Y, 3);
  const endDay = lastSun(Y, 10);

  function after(mo: number, da: number, bMo: number, bDa: number): boolean {
    return mo > bMo || (mo === bMo && da >= bDa);
  }

  return after(Mo, Da, 3, startDay) && !after(Mo, Da, 10, endDay);
}
