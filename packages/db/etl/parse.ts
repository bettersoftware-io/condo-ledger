export interface InsertStmt {
  table: string;
  // Column names for the row tuples. mysqldump emits two INSERT forms:
  //   - column-LIST form:  INSERT INTO `t` (`a`,`b`) VALUES ...  -> columns taken
  //     verbatim from the inline list.
  //   - column-LESS form:  INSERT INTO `t` VALUES ...            -> no inline list;
  //     real dumps in old/db/*.sql use THIS form, with tuples positionally aligned
  //     to the table's CREATE TABLE column order. Pass a `resolveColumns` hook to
  //     parseInserts to supply that DDL-derived order; without one, columns is [].
  columns: string[];
  rows: Array<Array<string | null>>;
}

// Tolerant reader for mysqldump extended INSERTs. Values come back as raw
// strings (or null); type coercion happens in transform.ts.
//
// `resolveColumns` is consulted only for the column-LESS INSERT form (no inline
// column list). When the inline list is present it always wins and the resolver
// is ignored. With no resolver, column-less statements get columns: [].
export function parseInserts(
  sql: string,
  resolveColumns?: (table: string) => string[],
): InsertStmt[] {
  const out: InsertStmt[] = [];
  const re = /INSERT INTO `(\w+)`\s*(?:\(([^)]*)\))?\s*VALUES\s*/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    const table = m[1]!;
    const inlineList = m[2];
    const columns =
      inlineList !== undefined
        ? inlineList.split(",").map((c) => c.trim().replace(/`/g, ""))
        : resolveColumns
          ? resolveColumns(table)
          : [];
    const { rows, end } = readTuples(sql, re.lastIndex);
    out.push({ table, columns, rows });
    re.lastIndex = end;
  }
  return out;
}

function readTuples(s: string, i: number): { rows: Array<Array<string | null>>; end: number } {
  const rows: Array<Array<string | null>> = [];
  const n = s.length;
  while (i < n) {
    while (i < n && /\s/.test(s[i]!)) i++;
    if (s[i] !== "(") break;
    i++; // past '('
    const row: Array<string | null> = [];
    while (i < n) {
      while (i < n && /\s/.test(s[i]!)) i++;
      if (s[i] === "'") {
        let v = ""; i++;
        while (i < n) {
          const ch = s[i];
          if (ch === "\\") { v += s[i + 1]; i += 2; continue; }
          if (ch === "'") { i++; break; }
          v += ch; i++;
        }
        row.push(v);
      } else {
        let tok = "";
        while (i < n && s[i] !== "," && s[i] !== ")") { tok += s[i]; i++; }
        tok = tok.trim();
        // Unquoted NULL keyword -> SQL NULL. mysqldump normally emits uppercase
        // `NULL`, but the country/locale reference dump emits lowercase `null`;
        // match case-insensitively. Real string data is always single-quoted
        // (handled above), so this can never swallow a legitimate "null" value.
        row.push(/^null$/i.test(tok) ? null : tok);
      }
      while (i < n && /\s/.test(s[i]!)) i++;
      if (s[i] === ",") { i++; continue; }
      if (s[i] === ")") { i++; break; }
    }
    rows.push(row);
    while (i < n && /\s/.test(s[i]!)) i++;
    if (s[i] === ",") { i++; continue; }
    if (s[i] === ";") { i++; break; }
  }
  return { rows, end: i };
}
