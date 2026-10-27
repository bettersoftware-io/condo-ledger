import { describe, expect, it } from "vitest";

import type { Account } from "../entities/account.ts";
import type { TableLink, ThousandthTable } from "../entities/table.ts";
import { must } from "../support/must.ts";
import {
  type TableDraft,
  validateCoefficient,
  validateTable,
  validateTableDelete,
} from "./validateTable.ts";

describe("validateTable", () => {
  it("accepts a new table with a name of its own and a whole order from 1", () => {
    expect(validateTable(TABLES, createDraft({}), null)).toEqual({ ok: true });
    expect(validateTable(TABLES, createDraft({ order: 1 }), null)).toEqual({
      ok: true,
    });
  });

  it("refuses a blank name, spaces included", () => {
    expect(validateTable(TABLES, createDraft({ name: "" }), null)).toEqual({
      ok: false,
      reason: "blank-name",
    });
    expect(validateTable(TABLES, createDraft({ name: "  " }), null)).toEqual({
      ok: false,
      reason: "blank-name",
    });
  });

  it("refuses a name another table of the period has, by case", () => {
    expect(
      validateTable(TABLES, createDraft({ name: "Proprietà" }), null),
    ).toEqual({ ok: false, reason: "name-taken" });
    expect(
      validateTable(TABLES, createDraft({ name: " Scale " }), "dt1"),
    ).toEqual({ ok: false, reason: "name-taken" });
    expect(
      validateTable(TABLES, createDraft({ name: "proprietà" }), null),
    ).toEqual({ ok: true });
  });

  it("lets a table keep its own name when it is edited", () => {
    expect(
      validateTable(TABLES, createDraft({ name: "Proprietà" }), "dt1"),
    ).toEqual({ ok: true });
  });

  it("refuses an order that is not a whole number from 1", () => {
    for (const order of [0, -1, 1.5, Number.NaN]) {
      expect(validateTable(TABLES, createDraft({ order }), null)).toEqual({
        ok: false,
        reason: "bad-order",
      });
    }
  });

  it("names the first thing wrong: the name blank, then taken, then the order", () => {
    expect(
      validateTable(TABLES, createDraft({ name: " ", order: 0 }), null),
    ).toEqual({ ok: false, reason: "blank-name" });
    expect(
      validateTable(TABLES, createDraft({ name: "Scale", order: 0 }), null),
    ).toEqual({ ok: false, reason: "name-taken" });
  });
});

describe("validateTableDelete", () => {
  it("accepts a table no account links", () => {
    expect(
      validateTableDelete(must(TABLES[1], "dt2"), [
        createAccount("la1", [createLink("la1", "dt1")]),
      ]),
    ).toEqual({ ok: true });
  });

  it("refuses a linked table, naming the first account that links it", () => {
    expect(
      validateTableDelete(must(TABLES[0], "dt1"), [
        createAccount("la1", []),
        createAccount("la2", [createLink("la2", "dt3")]),
        createAccount("la3", [
          createLink("la3", "dt3"),
          createLink("la3", "dt1"),
        ]),
        createAccount("la4", [createLink("la4", "dt1")]),
      ]),
    ).toEqual({ ok: false, reason: "table-linked", detail: "la3" });
  });
});

describe("validateCoefficient", () => {
  it("accepts zero and any whole count of ten-thousandths", () => {
    expect(validateCoefficient(0)).toEqual({ ok: true });
    expect(validateCoefficient(1453000)).toEqual({ ok: true });
    expect(validateCoefficient(1)).toEqual({ ok: true });
  });

  it("refuses a negative value and a fraction of a ten-thousandth", () => {
    for (const value of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(validateCoefficient(value)).toEqual({
        ok: false,
        reason: "not-a-coefficient",
      });
    }
  });
});

function createDraft(overrides: Partial<TableDraft>): TableDraft {
  return { name: "Ascensore", order: 4, notes: "", ...overrides };
}

function createTable(id: string, name: string, order: number): ThousandthTable {
  return {
    id,
    periodId: "p1",
    name,
    order,
    notes: "",
    restrictionGroupId: null,
  };
}

function createAccount(id: string, links: TableLink[]): Account {
  return {
    id,
    periodId: "p1",
    parentId: null,
    name: id,
    order: 1,
    nature: "expenses",
    type: "regular",
    role: null,
    budget: null,
    abbreviation: null,
    links,
  };
}

function createLink(accountId: string, tableId: string): TableLink {
  return {
    id: `el-${accountId}-${tableId}`,
    accountId,
    tableId,
    use: "both",
    percentage: null,
    roles: { 1: null, 2: null, 3: null, 4: null },
    present: { 1: true, 2: false, 3: false, 4: false },
  };
}

const TABLES: ThousandthTable[] = [
  createTable("dt1", "Proprietà", 1),
  createTable("dt2", "Scale", 2),
  createTable("dt3", "Generale residenti", 3),
];
