export interface InsertStmt {
  table: string;
  columns: string[];
  rows: Array<Array<string | null>>;
}

// Tolerant reader for mysqldump extended INSERTs. Values come back as raw
// strings (or null); type coercion happens in transform.ts.
export function parseInserts(sql: string): InsertStmt[] {
  const out: InsertStmt[] = [];
  const re = /INSERT INTO `(\w+)`\s*\(([^)]*)\)\s*VALUES\s*/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    const table = m[1]!;
    const columns = m[2]!.split(",").map((c) => c.trim().replace(/`/g, ""));
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
        row.push(tok === "NULL" ? null : tok);
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
