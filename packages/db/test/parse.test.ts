import { describe, it, expect } from "vitest";
import { parseInserts } from "../etl/parse.ts";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("./fixtures/sample.sql", import.meta.url), "utf8");

describe("parseInserts", () => {
  const stmts = parseInserts(sql);
  it("finds two INSERT statements", () => {
    expect(stmts.map((s) => s.table)).toEqual(["condominium", "unit"]);
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
});
