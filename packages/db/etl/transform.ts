// DDL-driven row transform. Given the parsed DDL (single source of truth for
// column names + types), turn a legacy positional row into a schema-shaped object
// ready for insert: rename columns to the authored snake_case schema names and
// coerce values by their declared MySQL type (bool / Rome-local datetime ->
// UTC / calendar date passthrough / raw passthrough).

import type { DdlColumn } from "./ddl.ts";
import { classify } from "./ddl.ts";
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
  return function transformRow(table, columns, values) {
    const ddlCols = ddl[table];
    const row: Record<string, TransformValue> = {};
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]!;
      const v = values[i] ?? null;
      const key = renameColumn(col);
      if (v === null) {
        row[key] = null;
        continue;
      }
      const sqlType = ddlCols?.find((c) => c.name === col)?.sqlType;
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
// last Sunday of March 01:00 UTC to the last Sunday of October 01:00 UTC; CET
// (+01:00) otherwise.
function romeToUtcIso(s: string): string {
  const [d, t] = s.split(" ");
  const [Y, Mo, Da] = d!.split("-").map(Number);
  const [H, Mi, Se] = t!.split(":").map(Number);
  const offsetH = isCEST(Y!, Mo!, Da!, H!) ? 2 : 1;
  const ms = Date.UTC(Y!, Mo! - 1, Da!, H! - offsetH, Mi!, Se!);
  return new Date(ms).toISOString();
}

function isCEST(Y: number, Mo: number, Da: number, _H: number): boolean {
  const lastSun = (y: number, m: number) => {
    const d = new Date(Date.UTC(y, m, 0));
    return d.getUTCDate() - d.getUTCDay();
  };
  const startDay = lastSun(Y, 3);
  const endDay = lastSun(Y, 10);
  const after = (mo: number, da: number, bMo: number, bDa: number) =>
    mo > bMo || (mo === bMo && da >= bDa);
  return after(Mo, Da, 3, startDay) && !after(Mo, Da, 10, endDay);
}
