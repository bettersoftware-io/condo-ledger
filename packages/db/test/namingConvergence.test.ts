import { readFileSync } from "node:fs";

import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { beforeAll, describe, expect, it } from "vitest";

import { toSnake } from "../src/naming.ts";
import * as schema from "../src/schema/index.ts";
import {
  dumpSuiteName,
  legacyDumpAvailable,
  legacyDumpFile,
} from "./legacyDump.ts";

// Build a lookup of authored schema table -> column-name set.
const schemaTables = new Map<string, Set<string>>();

for (const t of Object.values(schema)) {
  if (t instanceof PgTable) {
    const cfg = getTableConfig(t);
    schemaTables.set(
      cfg.name,
      new Set(
        cfg.columns.map((c) => {
          return c.name;
        }),
      ),
    );
  }
}

const STRUCTURE = "it-jtime-condominium.structure.sql";

describe.skipIf(!legacyDumpAvailable(STRUCTURE))(
  dumpSuiteName(
    "naming convergence: toSnake reproduces authored schema names",
    STRUCTURE,
  ),
  () => {
    beforeAll(() => {
      legacyTables = parseDdl(
        readFileSync(legacyDumpFile(STRUCTURE), "utf8"),
      ).filter((t) => {
        return t.name !== "codeIgniterSession";
      });
    });

    it("parsed a sane number of legacy tables", () => {
      // 95 CREATE TABLE statements minus codeIgniterSession = 94.
      expect(legacyTables.length).toBe(94);
    });

    it("authored schema exposes 94 tables", () => {
      expect(schemaTables.size).toBe(94);
    });

    it("every legacy table+column converges with the authored schema (0 mismatch)", () => {
      const mismatches: string[] = [];
      let tablesChecked = 0;
      let columnsChecked = 0;

      for (const lt of legacyTables) {
        const expectedTable = toSnake(lt.name);
        const cols = schemaTables.get(expectedTable);
        tablesChecked++;

        if (!cols) {
          mismatches.push(
            `TABLE  legacy=\`${lt.name}\`  toSnake=>\`${expectedTable}\`  but no such authored table`,
          );
          continue;
        }

        for (const col of lt.columns) {
          columnsChecked++;
          const expectedCol = expectedColumnName(lt.name, col);

          if (!cols.has(expectedCol)) {
            mismatches.push(
              `COLUMN ${expectedTable}.\`${col}\`  expected=>\`${expectedCol}\`  not present in authored columns [${[...cols].join(", ")}]`,
            );
          }
        }
      }

      if (mismatches.length > 0) {
        throw new Error(
          `Converged ${tablesChecked} tables / ${columnsChecked} columns; ${mismatches.length} mismatch(es):\n` +
            mismatches.join("\n"),
        );
      }

      // sanity: we actually checked a meaningful amount
      expect(tablesChecked).toBe(94);
      expect(columnsChecked).toBeGreaterThan(400);
    });
  },
);

// ---------------------------------------------------------------------------
// Hard acceptance criterion: for EVERY table and EVERY column in the authored
// Drizzle schema, there must exist a legacy identifier whose toSnake(...) equals
// the schema name. i.e. toSnake reproduces the schema's snake_case spelling.
//
// The only exceptions are two SEMANTIC renames (not pure case conversions):
//   1. legacy `lastModified` datetime column  -> schema `updated`
//   2. legacy `default` column (masterDataTaxTreatment only) -> schema `is_default`
// ---------------------------------------------------------------------------

interface LegacyTable {
  name: string;
  columns: string[];
}

function parseDdl(sql: string): LegacyTable[] {
  const lines = sql.split("\n");
  const tables: LegacyTable[] = [];
  let current: LegacyTable | null = null;

  const createRe = /^CREATE TABLE `([^`]+)` \(/;
  // A column line: exactly two leading spaces then a backtick-quoted name.
  const colRe = /^ {2}`([^`]+)`/;
  const nonColPrefixes = ["PRIMARY KEY", "UNIQUE KEY", "KEY", "CONSTRAINT"];

  for (const line of lines) {
    const create = createRe.exec(line);

    if (create) {
      current = { name: create[1]!, columns: [] };
      tables.push(current);
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith(")")) {
      current = null; // end of this CREATE TABLE body
      continue;
    }

    // skip index/constraint definitions even though they also start with two spaces
    const trimmed = line.trimStart();

    if (
      nonColPrefixes.some((p) => {
        return trimmed.startsWith(p);
      })
    ) {
      continue;
    }

    const col = colRe.exec(line);

    if (col) {
      current.columns.push(col[1]!);
    }
  }

  return tables;
}

// Map legacy column name -> expected authored schema column name.
function expectedColumnName(table: string, col: string): string {
  if (col === "lastModified") {
    return "updated";
  }

  if (table === "masterDataTaxTreatment" && col === "default") {
    return "is_default";
  }

  return toSnake(col);
}

let legacyTables: LegacyTable[] = [];
