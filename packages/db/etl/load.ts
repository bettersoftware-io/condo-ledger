import type { PoolClient } from "pg";

type Row = Record<string, string | number | boolean | null>;

export async function loadTable(client: PoolClient, table: string, rows: Row[]): Promise<void> {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]!);
  const colList = cols.map((c) => `"${c}"`).join(",");
  // batch in chunks to keep parameter count under pg's 65535 limit
  const perRow = cols.length;
  const maxRows = Math.max(1, Math.floor(60000 / perRow));
  for (let start = 0; start < rows.length; start += maxRows) {
    const chunk = rows.slice(start, start + maxRows);
    const params: Array<string | number | boolean | null> = [];
    const tuples = chunk.map((r) => {
      const ph = cols.map((c) => { params.push(r[c]!); return `$${params.length}`; });
      return `(${ph.join(",")})`;
    });
    await client.query(
      `INSERT INTO "${table}" (${colList}) OVERRIDING SYSTEM VALUE VALUES ${tuples.join(",")}`,
      params,
    );
  }
}

export async function resyncSequence(client: PoolClient, table: string, idCol = "id"): Promise<void> {
  await client.query(
    `SELECT setval(
       pg_get_serial_sequence($1, $2),
       COALESCE((SELECT max("${idCol}") FROM "${table}"), 1),
       (SELECT count(*) > 0 FROM "${table}"))`,
    [table, idCol],
  );
}
