import { parseDdl, tableColumns } from "@cl/db/etl/ddl.ts";
import { parseInserts } from "@cl/db/etl/parse.ts";
import type { TransformValue } from "@cl/db/etl/transform.ts";

export type Row = Record<string, TransformValue>;
export type Tables = Record<string, Row[]>;

/**
 * Parse a self-contained mysqldump (DDL + column-less data INSERTs) into
 * DDL-named, type-coerced row objects keyed by table name. Reuses the @cl/db
 * ETL: parseDdl supplies column order and type metadata. We keep LEGACY
 * camelCase column names (projection code references them), so we build rows
 * directly from DDL column names + a local coercer, rather than makeTransform's
 * snake_case rename.
 */
export function parseTables(sql: string): Tables {
  const ddl = parseDdl(sql);

  function resolve(table: string): string[] {
    return tableColumns(ddl, table);
  }

  const stmts = parseInserts(sql, resolve);
  const out: Tables = {};

  for (const s of stmts) {
    const cols = s.columns;
    const types = new Map(
      (ddl[s.table] ?? []).map((c) => {
        return [c.name, c.sqlType];
      }),
    );

    const rows = s.rows.map((tuple) => {
      const r: Row = {};

      for (let i = 0; i < cols.length; i++) {
        const name = cols[i]!;
        const raw = tuple[i] ?? null;
        const sqlType = types.get(name) ?? "";
        r[name] = coerce(raw, sqlType);
      }

      return r;
    });
    const bucket = out[s.table] ?? [];
    out[s.table] = bucket;
    bucket.push(...rows);
  }

  return out;
}

// tinyint(1) -> boolean; everything else stays a raw string|null (numbers and
// decimals are parsed at projection time). Keeps the loader dumb and explicit.
function coerce(raw: string | null, sqlType: string): TransformValue {
  if (raw === null) {
    return null;
  }

  if (/^tinyint\(1\)/i.test(sqlType)) {
    return raw === "1";
  }

  return raw;
}
