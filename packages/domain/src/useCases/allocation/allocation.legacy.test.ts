import { describe, expect, it } from "vitest";

import type { Cents } from "#/entities/cents.ts";
import { must } from "#/support/must.ts";
import { createSeedAllocationSource } from "#/testing/createSeedAllocationSource.ts";

import {
  type Allocation,
  type AllocationRow,
  allocationBooksOf,
  allocationOf,
} from "./allocation.ts";
import type { AllocationMode } from "./share.ts";

describe("the allocation of Saturno 2011 (p1)", () => {
  it("has six columns: the prototype's five and Spese personali", () => {
    expect(
      allocationOfPeriod("p1", "budget").columns.map((column) => {
        return column.accountId;
      }),
    ).toEqual(SATURNO_COLUMNS);
  });

  it("allocates the budget: 2,800.00 / 1,300.00 / 950.00 / 1,900.00 / 450.00 / 0.00, with 0.01 of Roundings on Water", () => {
    const allocation = allocationOfPeriod("p1", "budget");

    expect(allocation.root.amounts).toEqual([
      280000, 130000, 95000, 190000, 45000, 0,
    ]);
    expect(allocation.root.total).toBe(740000);
    expect(roundingsOf(allocation).amounts).toEqual([0, 0, 0, 0, 1, 0]);
    expect(allocation.unallocated).toEqual([]);
  });

  it("gives the ten residents the budget Totals of the legacy report", () => {
    expect(residentTotals(allocationOfPeriod("p1", "budget"))).toEqual(
      new Map([
        ["r1", 85641],
        ["r2", 47600],
        ["r3", 75273],
        ["r4", 217432],
        ["r5", 278264],
        ["r6", 5600],
        ["r7", 3179],
        ["r8", 8996],
        ["r9", 9112],
        ["r10", 8902],
      ]),
    );
  });

  it("carries a previous balance of 288.92, a Total due of 7,688.92 and 3,279.97 paid on the root", () => {
    expect(allocationOfPeriod("p1", "budget").root).toMatchObject({
      previousBalance: 28892,
      due: 768892,
      paid: 327997,
    });
  });

  it("allocates the final balance: 1,378.40 / 491.84 / 116.99 / 467.96 / 0.00 / 0.00, with Roundings −0.01 / 0.03 / −0.01", () => {
    const allocation = allocationOfPeriod("p1", "finalBalance");

    expect(allocation.root.amounts).toEqual([
      137840, 49184, 11699, 46796, 0, 0,
    ]);
    expect(allocation.root.total).toBe(245519);
    expect(roundingsOf(allocation).amounts).toEqual([-1, 3, -1, 0, 0, 0]);
    expect(allocation.root).toMatchObject({
      previousBalance: 28892,
      due: 274411,
      paid: 327997,
    });
  });

  it("gives the units the final-balance Totals of the legacy report", () => {
    const allocation = allocationOfPeriod("p1", "finalBalance");

    expect(
      [
        "resident:r1",
        "unit:u2",
        "resident:r4",
        "resident:r5",
        "unit:u5",
        "resident:r8",
        "resident:r9",
        "resident:r10",
      ].map((key) => {
        return rowOf(allocation, key).total;
      }),
    ).toEqual([24552, 40568, 73656, 91782, 3740, 3740, 3740, 3740]);
  });

  it("draws groups A and B, then Roundings, with A1's dates and days, and A2's dates without days", () => {
    const allocation = allocationOfPeriod("p1", "budget");

    expect(
      allocation.root.children.map((row) => {
        return row.key;
      }),
    ).toEqual(["group:ug1", "group:ug2", "roundings"]);
    expect(rowOf(allocation, "resident:r1")).toMatchObject({
      restriction: "01/05/2011 - 31/05/2011",
      days: "31/365",
    });
    expect(rowOf(allocation, "unit:u2")).toMatchObject({
      restriction: "27/05/2011 - end of FY",
      days: "",
    });
  });

  const SATURNO_COLUMNS = ["la28", "la34", "la37", "la40", "la43", "la47"];
});

describe("the allocation of Pozzetto 2013 (p36)", () => {
  it("allocates 38,000.00 of budget", () => {
    expect(allocationOfPeriod("p36", "budget").root.total).toBe(3800000);
  });

  it("gives A01 (r162) 166.68 on Generali PR and a Total of 1,687.31", () => {
    const allocation = allocationOfPeriod("p36", "budget");
    const r162 = rowOf(allocation, "resident:r162");

    expect(amountOf(allocation, r162, "la172")).toBe(16668);
    expect(r162.total).toBe(168731);
  });

  it("prorates A04: 170.97 from 19 January and 8.87 until the 18th on Generali PR, Totals 898.64 and 46.63", () => {
    const allocation = allocationOfPeriod("p36", "budget");
    const r166 = rowOf(allocation, "resident:r166");
    const r167 = rowOf(allocation, "resident:r167");

    expect(amountOf(allocation, r166, "la172")).toBe(17097);
    expect(amountOf(allocation, r167, "la172")).toBe(887);
    expect(r166.total).toBe(89864);
    expect(r167.total).toBe(4663);
    expect([r166.days, r167.days]).toEqual(["347/365", "18/365"]);
  });

  it("splits A18 between owner and tenant: 42.00 each on Generali PR+CO, and all of Generali CO to the tenant", () => {
    const allocation = allocationOfPeriod("p36", "budget");
    const r187 = rowOf(allocation, "resident:r187");
    const r188 = rowOf(allocation, "resident:r188");

    expect(amountOf(allocation, r187, "la185")).toBe(4200);
    expect(amountOf(allocation, r188, "la185")).toBe(4200);
    expect(amountOf(allocation, r187, "la191")).toBe(0);
    expect(amountOf(allocation, r188, "la191")).toBe(24676);
  });

  it("leaves the report's nine Roundings, −0.52 in all", () => {
    const allocation = allocationOfPeriod("p36", "budget");
    const roundings = roundingsOf(allocation);

    expect(
      allocation.columns
        .map((column, index) => {
          return [column.accountId, roundings.amounts[index]];
        })
        .filter(([, amount]) => {
          return amount !== 0;
        }),
    ).toEqual([
      ["la172", -7],
      ["la185", -20],
      ["la191", -14],
      ["la204", 2],
      ["la207", -1],
      ["la211", -1],
      ["la213", -2],
      ["la217", -6],
      ["la219", -3],
    ]);
    expect(roundings.total).toBe(-52);
  });

  it("allocates 34,887.71 of final balance, 489.06 of it Individual", () => {
    const allocation = allocationOfPeriod("p36", "finalBalance");

    expect(allocation.root.total).toBe(3488771);
    expect(amountOf(allocation, allocation.root, "la222")).toBe(48906);
  });
});

function allocationOfPeriod(
  periodId: string,
  mode: AllocationMode,
): Allocation {
  return allocationOf(
    allocationBooksOf(createSeedAllocationSource(periodId)),
    mode,
  );
}

function residentTotals(allocation: Allocation): Map<string, Cents> {
  const totals = new Map<string, Cents>();

  function visit(row: AllocationRow): void {
    if (row.kind === "resident") {
      totals.set(row.key.replace("resident:", ""), row.total);
    }

    row.children.forEach(visit);
  }

  visit(allocation.root);

  return totals;
}

function amountOf(
  allocation: Allocation,
  row: AllocationRow,
  accountId: string,
): Cents | undefined {
  const index = allocation.columns.findIndex((column) => {
    return column.accountId === accountId;
  });

  return row.amounts[index];
}

function roundingsOf(allocation: Allocation): AllocationRow {
  return rowOf(allocation, "roundings");
}

function rowOf(allocation: Allocation, key: string): AllocationRow {
  return must(find([allocation.root], key), `the row ${key}`);
}

function find(rows: AllocationRow[], key: string): AllocationRow | undefined {
  for (const row of rows) {
    if (row.key === key) {
      return row;
    }

    const found = find(row.children, key);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}
