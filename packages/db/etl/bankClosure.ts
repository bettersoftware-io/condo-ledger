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

/** Filter bankBranch INSERT rows down to the referenced ids (+ their banks). */
export function filterReferenced(
  branchStmts: InsertStmt[],
  branchIdCol: string,
  keep: Set<string>,
): InsertStmt[] {
  return branchStmts.map((s) => {
    const idx = s.columns.indexOf(branchIdCol);
    return {
      ...s,
      rows:
        idx < 0
          ? s.rows
          : s.rows.filter((r) => {
              return keep.has(r[idx] ?? "");
            }),
    };
  });
}
