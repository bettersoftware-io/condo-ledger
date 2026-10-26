// Seed orchestrator — three-tier ETL (A -> B -> C) under replica mode.
//
// Pipeline:
//   1. Parse the legacy DDL (structure.sql) — single source of truth for the
//      column-LESS data dumps' column names + types.
//   2. Read each source file ONCE, parse its column-less INSERTs with the
//      DDL-derived column resolver, transform rows to schema shape.
//   3. Load every LOAD_ORDER table from its tier's source, under
//      session_replication_role='replica' (FK triggers off) so order is forgiving.
//   4. Resync each table's id sequence, then COMMIT.
//
// The whole load is one transaction: any failure ROLLBACKs and rethrows.

import { readFileSync } from "node:fs";

import { makePool } from "../src/db.ts";
import { toSnake } from "../src/naming.ts";
import { referencedBankBranchIds } from "./bankClosure.ts";
import { parseDdl, tableColumns } from "./ddl.ts";
import { loadTable, resyncSequence } from "./load.ts";
import { LOAD_ORDER } from "./order.ts";
import { type InsertStmt, parseInserts } from "./parse.ts";
import {
  DROP_STUDIO_ID,
  FILES,
  STUDIO_BACKFILL,
  TIER_A,
  TIER_B,
} from "./sources.ts";
import { makeTransform } from "./transform.ts";

async function main(): Promise<void> {
  // 1. DDL: names + types for the column-less dumps.
  const ddl = parseDdl(readFileSync(FILES.structure, "utf8"));

  // Column resolver for the column-LESS dumps. Tables whose dump predates the
  // studioId column (DROP_STUDIO_ID) must resolve to the DDL list MINUS studioId,
  // so positional tuples line up; studio_id is backfilled later (STUDIO_BACKFILL).
  function resolve(t: string): string[] {
    return DROP_STUDIO_ID.has(t)
      ? tableColumns(ddl, t).filter((c) => {
          return c !== "studioId";
        })
      : tableColumns(ddl, t);
  }

  const transformRow = makeTransform(ddl);

  // Read + parse a file once. The full dump is 46MB — never re-read per table.
  const parsedCache = new Map<string, InsertStmt[]>();

  function read(u: URL): InsertStmt[] {
    const key = u.href;
    let stmts = parsedCache.get(key);

    if (!stmts) {
      stmts = parseInserts(readFileSync(u, "utf8"), resolve);
      parsedCache.set(key, stmts);
    }

    return stmts;
  }

  // Group a parsed file's statements by table for O(1) per-table lookup.
  function byTable(stmts: InsertStmt[]): Map<string, InsertStmt[]> {
    const m = new Map<string, InsertStmt[]>();

    for (const s of stmts) {
      const arr = m.get(s.table);

      if (arr) {
        arr.push(s);
      } else {
        m.set(s.table, [s]);
      }
    }

    return m;
  }

  // 4. Operational dumps -> Tier C, derived dynamically.
  const opStmts = [...read(FILES.saturnoOnly), ...read(FILES.pozzettoOnly)];
  const opByTable = byTable(opStmts);
  const tierC = new Set(
    opStmts.map((s) => {
      return s.table;
    }),
  );

  // 6. Guard: nothing in the dumps may be silently dropped, and every declared
  // Tier A/B table must have a slot in LOAD_ORDER.
  const orderSet = new Set(LOAD_ORDER);
  const missing = [
    ...[...tierC]
      .filter((t) => {
        return !orderSet.has(t);
      })
      .map((t) => {
        return `tierC:${t}`;
      }),
    ...[...TIER_A]
      .filter((t) => {
        return !orderSet.has(t);
      })
      .map((t) => {
        return `tierA:${t}`;
      }),
    ...[...TIER_B]
      .filter((t) => {
        return !orderSet.has(t);
      })
      .map((t) => {
        return `tierB:${t}`;
      }),
  ];

  if (missing.length) {
    throw new Error(
      `LOAD_ORDER is missing source tables: ${missing.join(", ")}`,
    );
  }

  console.log("tier C (from dumps):", [...tierC].sort().join(", "));

  // 7. Bank closure — empty in this dataset; compute for correctness/logging.
  const branchIds = referencedBankBranchIds(
    opStmts,
    "bankAccount",
    "bankBranchId",
  );

  if (branchIds.size === 0) {
    console.log("0 bank branches referenced; skipping bank/bankBranch");
  } else {
    console.log(`${branchIds.size} bank branches referenced`);
  }

  // Lazily grouped Tier A / Tier B sources (read each file once, on first need).
  let refByTable: Map<string, InsertStmt[]> | undefined;
  let fullByTable: Map<string, InsertStmt[]> | undefined;

  function tierAStmts(t: string): InsertStmt[] {
    refByTable ??= byTable(read(FILES.reference));
    return refByTable.get(t) ?? [];
  }

  function tierBStmts(t: string): InsertStmt[] {
    fullByTable ??= byTable(read(FILES.full));
    return fullByTable.get(t) ?? [];
  }

  const pool = makePool();
  const client = await pool.connect();
  const loaded: string[] = [];

  try {
    await client.query("BEGIN");
    await client.query("SET session_replication_role = 'replica'");

    // 9. Load each table from its tier's source.
    for (const table of LOAD_ORDER) {
      const stmts = tierC.has(table)
        ? (opByTable.get(table) ?? [])
        : TIER_A.has(table)
          ? tierAStmts(table)
          : TIER_B.has(table)
            ? tierBStmts(table)
            : [];

      if (stmts.length === 0) {
        continue;
      }

      const rows = stmts.flatMap((s) => {
        return s.rows.map((r) => {
          return transformRow(s.table, s.columns, r);
        });
      });

      if (rows.length === 0) {
        continue;
      }

      // studioId reconciliation: the dumps predate multi-tenancy and all this data
      // is studio 1. Backfill the post-transform snake_case key, covering both the
      // absent case (DROP_STUDIO_ID tables) and the present-but-NULL case (condominium).
      if (STUDIO_BACKFILL.has(table)) {
        for (const r of rows) {
          r.studio_id ??= 1;
        }
      }

      await loadTable(client, toSnake(table), rows);
      loaded.push(table);
      console.log("loaded", rows.length, "into", table);
    }

    // 10/11. Re-enable FK enforcement and resync sequences for loaded tables.
    await client.query("SET session_replication_role = 'origin'");

    for (const table of loaded) {
      await resyncSequence(client, toSnake(table), "id");
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
