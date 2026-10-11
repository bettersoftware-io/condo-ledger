// Authoritative DDL parser for the legacy mysqldump structure file. The data
// dumps use the column-LESS INSERT form, so both column NAMES and TYPES must be
// derived from the CREATE TABLE statements here — this module is the single
// source of truth feeding the Task-12 parser's resolveColumns hook (names) and
// the transform's per-column type classification (types).

export interface DdlColumn {
  // Legacy camelCase identifier exactly as written in the DDL.
  name: string;
  // Raw type token, lowercased: e.g. `tinyint(1)`, `datetime`, `date`, `int(10)`,
  // `varchar(255)`, `decimal(12,2)`, `enum('a','b')`.
  sqlType: string;
}

// Constraint/index line keywords to exclude — these begin a line inside the
// parenthesised table body but are NOT column definitions.
const NON_COLUMN =
  /^(PRIMARY KEY|UNIQUE KEY|KEY|CONSTRAINT|FULLTEXT|SPATIAL)\b/i;

// Parse the structure SQL into per-table ordered column metadata. For each
// `CREATE TABLE \`name\` ( ... ) ENGINE...` block we walk the body lines and keep
// the ones that start with a backtick-quoted identifier (column defs), in order.
export function parseDdl(structureSql: string): Record<string, DdlColumn[]> {
  const out: Record<string, DdlColumn[]> = {};
  // Match each CREATE TABLE header; we then scan forward line-by-line until the
  // closing `) ENGINE` so commas/parens inside enum(...) defaults don't confuse us.
  const headerRe = /CREATE TABLE\s+`([^`]+)`\s*\(/gi;

  for (
    let m = headerRe.exec(structureSql);
    m;
    m = headerRe.exec(structureSql)
  ) {
    const table = m[1]!;
    const cols: DdlColumn[] = [];
    // Walk lines from just after the header to the terminating `) ENGINE` line.
    const rest = structureSql.slice(headerRe.lastIndex);
    const lines = rest.split("\n");

    for (const rawLine of lines) {
      const line = rawLine.trim();

      // End of this table body.
      if (/^\)\s*ENGINE/i.test(line)) {
        break;
      }

      if (NON_COLUMN.test(line)) {
        continue;
      }

      const col = parseColumnLine(line);

      if (col) {
        cols.push(col);
      }
    }

    out[table] = cols;
  }

  return out;
}

// Parse a single column-definition line. Returns null for lines that don't begin
// with a backtick-quoted identifier (blank lines, etc.). Captures the identifier
// and the type token immediately following it — the type word plus, if present, a
// balanced parenthetical (`int(10)`, `decimal(12,2)`, `enum('a','b')`).
function parseColumnLine(line: string): DdlColumn | null {
  const idMatch = /^`([^`]+)`\s+(.*)$/.exec(line);

  if (!idMatch) {
    return null;
  }

  const name = idMatch[1]!;
  const after = idMatch[2]!;
  // Type word: leading run of letters (int, varchar, tinyint, datetime, ...).
  const wordMatch = /^([A-Za-z]+)/.exec(after);

  if (!wordMatch) {
    return null;
  }

  let sqlType = wordMatch[1]!;
  const rest = after.slice(sqlType.length);

  // If a parenthetical immediately follows, capture it with balanced-paren scan
  // (handles enum('a','b') containing commas).
  if (rest.startsWith("(")) {
    let depth = 0;
    let i = 0;

    for (; i < rest.length; i++) {
      const ch = rest[i]!;

      if (ch === "(") {
        depth++;
      } else if (ch === ")") {
        depth--;

        if (depth === 0) {
          i++;
          break;
        }
      }
    }

    sqlType += rest.slice(0, i);
  }

  return { name, sqlType: sqlType.toLowerCase() };
}

// Just the column names in order — fed to the parser's resolveColumns hook.
export function tableColumns(
  ddl: Record<string, DdlColumn[]>,
  table: string,
): string[] {
  const cols = ddl[table];
  return cols
    ? cols.map((c) => {
        return c.name;
      })
    : [];
}

// Classify a raw sqlType token into the transform's handling categories.
export function classify(sqlType: string): "bool" | "tz" | "date" | "raw" {
  if (sqlType === "tinyint(1)") {
    return "bool";
  }

  if (sqlType === "datetime" || sqlType === "timestamp") {
    return "tz";
  }

  if (sqlType === "date") {
    return "date";
  }

  return "raw";
}
