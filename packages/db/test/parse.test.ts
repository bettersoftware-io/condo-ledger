import { readFileSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import { parseInserts } from "../etl/parse.ts";
import {
  dumpSuiteName,
  legacyDumpAvailable,
  legacyDumpFile,
} from "./legacyDump.ts";

const sql = readFileSync(
  new URL("./fixtures/sample.sql", import.meta.url),
  "utf8",
);

describe("parseInserts", () => {
  it("finds two INSERT statements", () => {
    expect(
      stmts.map((s) => {
        return s.table;
      }),
    ).toEqual(["condominium", "unit"]);
  });
  it("captures legacy column names verbatim (incl. reserved `default`)", () => {
    expect(stmts[0]!.columns).toEqual(["id", "name", "default", "created"]);
  });
  it("parses rows, NULLs, escaped quotes, and numbers", () => {
    expect(stmts[0]!.rows).toEqual([
      ["1", "Saturno", "1", "2011-01-01 00:00:00"],
      ["2", "O'Brien, Inc.", "0", null],
    ]);
    expect(stmts[1]!.rows).toEqual([["10", "A1"]]);
  });

  const stmts = parseInserts(sql);
});

describe("parseInserts column-less form", () => {
  it("resolves columns via the resolver hook when the inline list is absent", () => {
    const r = parseInserts(colless, (t) => {
      return t === "accountingPeriod" ? ["id", "year", "note"] : [];
    });
    expect(r).toHaveLength(1);
    expect(r[0]!.table).toBe("accountingPeriod");
    expect(r[0]!.columns).toEqual(["id", "year", "note"]);
    expect(r[0]!.rows).toEqual([
      ["1", "2011", null],
      ["2", "2012", "x"],
    ]);
  });

  it("yields columns: [] without a resolver but still parses rows", () => {
    const r = parseInserts(colless);
    expect(r).toHaveLength(1);
    expect(r[0]!.table).toBe("accountingPeriod");
    expect(r[0]!.columns).toEqual([]);
    expect(r[0]!.rows).toEqual([
      ["1", "2011", null],
      ["2", "2012", "x"],
    ]);
  });

  const colless =
    "INSERT INTO `accountingPeriod` VALUES (1,'2011',NULL),(2,'2012','x');";
});

const SATURNO = "it-jtime-condominium-saturno-only.data.sql";

describe.skipIf(!legacyDumpAvailable(SATURNO))(
  dumpSuiteName("parseInserts real mysqldump smoke test", SATURNO),
  () => {
    beforeAll(() => {
      dump = readFileSync(legacyDumpFile(SATURNO), "utf8");
    });

    it("finds all 19 column-less INSERT statements in the real dump", () => {
      const stmts = parseInserts(dump);
      expect(stmts).toHaveLength(19);
      const ap = stmts.find((s) => {
        return s.table === "accountingPeriod";
      });
      expect(ap).toBeDefined();
      expect(ap!.rows[0]![0]).toBe("1");
    });

    let dump: string;
  },
);
