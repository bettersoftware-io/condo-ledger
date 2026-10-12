import type { InsertStmt } from "./parse.ts";

/** Distinct non-null values of `fkColumn` across all rows of `table`. */
export function referencedBankBranchIds(
  stmts: InsertStmt[],
  table: string,
  fkColumn: string,
): Set<string> {
  const ids = new Set<string>();

  for (const s of stmts) {
    if (s.table !== table) {
      continue;
    }

    const idx = s.columns.indexOf(fkColumn);

    if (idx < 0) {
      continue;
    }

    for (const row of s.rows) {
      const v = row[idx];

      if (v !== null && v !== undefined && v !== "0") {
        ids.add(v);
      }
    }
  }

  return ids;
}
