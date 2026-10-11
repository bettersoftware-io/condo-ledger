import { describe, expect, it } from "vitest";

import { buildDb } from "../db.ts";
import type { Tables } from "../loadRows.ts";
import {
  projectDistribution,
  projectDistributionTables,
} from "./distribution.ts";

// ---------------------------------------------------------------------------
// projectDistributionTables — unchanged behaviour (Σ coefficients).
// ---------------------------------------------------------------------------
const tablesFixture: Tables = {
  condominium: [
    {
      id: "1",
      code: "SAT",
      name: "S",
      status: "active",
      type: "regular",
      address: null,
      taxCode: null,
      vatNumber: null,
      parentCondominiumId: null,
    },
  ],
  accountingPeriod: [
    {
      id: "1",
      condominiumId: "1",
      name: "2011",
      type: "ordinary",
      status: "opened",
      startDate: "2011-01-01",
      endDate: "2011-12-31",
    },
  ],
  unit: [
    {
      id: "100",
      accountingPeriodId: "1",
      code: "A01",
      name: "",
      unitTypeId: "1",
      unitGroupId: null,
      floor: null,
      innerNumber: null,
      subordinateNumber: null,
      periodRestrictionStartDate: null,
      periodRestrictionEndDate: null,
    },
    {
      id: "101",
      accountingPeriodId: "1",
      code: "A02",
      name: "",
      unitTypeId: "1",
      unitGroupId: null,
      floor: null,
      innerNumber: null,
      subordinateNumber: null,
      periodRestrictionStartDate: null,
      periodRestrictionEndDate: null,
    },
  ],
  distributionTable: [
    {
      id: "7",
      accountingPeriodId: "1",
      name: "Proprietà",
      order: "1",
      restrictionUnitGroupId: null,
    },
  ],
  distributionTableItem: [
    { distributionTableId: "7", unitId: "100", coefficient: "250" },
    { distributionTableId: "7", unitId: "101", coefficient: "750" },
  ],
};

describe("projectDistributionTables", () => {
  it("builds tables with total = Σ coefficients", () => {
    const t = projectDistributionTables(db, "1");
    expect(t[0]).toMatchObject({ id: "dt7", name: "Proprietà", total: 1000 });
    expect(
      t[0]!.items.map((i) => {
        return i.coefficient;
      }),
    ).toEqual([250, 750]);
  });

  const db = buildDb(tablesFixture);
});

// ---------------------------------------------------------------------------
// Engine behaviours via projectDistribution (per-UNIT matrices).
// ---------------------------------------------------------------------------

// Two units, one table 250/750 (total 1000). A GROUPING account (id 3, type
// 'grouping', estimate null) is linked to table 7; its money + estimate live on
// two LEAF children (id 30 estimate 100.00 actual +60.00; id 31 estimate 100.00
// actual +40.00). Subtree estimate = 200.00, subtree actual = 100.00.
//   u100 estimate = 200.00 × 250/1000 = 50.00 = 5000c
//   u101 estimate = 200.00 × 750/1000 = 150.00 = 15000c
//   u100 current  = 100.00 × 250/1000 = 25.00 = 2500c
//   u101 current  = 100.00 × 750/1000 = 75.00 = 7500c
const subtreeFixture: Tables = {
  ...tablesFixture,
  unitPeriod: [
    { id: "500", unitId: "100" },
    { id: "501", unitId: "101" },
  ],
  unitResident: [
    {
      id: "900",
      unitPeriodId: "500",
      masterDataId: "10",
      percentage: "100",
      startingBalance: "0",
      unitResidentPriorityId: "1",
    },
    {
      id: "901",
      unitPeriodId: "501",
      masterDataId: "11",
      percentage: "100",
      startingBalance: "0",
      unitResidentPriorityId: "1",
    },
  ],
  ledgerAccount: [
    {
      id: "3",
      accountingPeriodId: "1",
      name: "Pulizie",
      type: "grouping",
      parentLedgerAccountId: null,
      kind: "expenses",
      order: "1",
    },
    {
      id: "30",
      accountingPeriodId: "1",
      name: "Pulizie A",
      type: "regular",
      parentLedgerAccountId: "3",
      kind: "expenses",
      order: "1",
    },
    {
      id: "31",
      accountingPeriodId: "1",
      name: "Pulizie B",
      type: "regular",
      parentLedgerAccountId: "3",
      kind: "expenses",
      order: "2",
    },
  ],
  expenseLedgerAccount: [
    { ledgerAccountId: "3", estimate: null, restrictionUnitGroupId: null },
    { ledgerAccountId: "30", estimate: "100.00", restrictionUnitGroupId: null },
    { ledgerAccountId: "31", estimate: "100.00", restrictionUnitGroupId: null },
  ],
  expenseLA2Table: [
    {
      id: "1",
      expenseLedgerAccountId: "3",
      distributionTableId: "7",
      type: null,
      percentage: null,
    },
  ],
  expenseLA2Role: [],
  ledgerTransaction: [
    { id: "9", accountingPeriodId: "1", code: "1", type: "expense" },
  ],
  ledgerEntry: [
    {
      id: "21",
      ledgerTransactionId: "9",
      postingAccountId: "30",
      amount: "60.00",
      order: "1",
      type: "expense",
      unitResidentId: null,
    },
    {
      id: "22",
      ledgerTransactionId: "9",
      postingAccountId: "31",
      amount: "40.00",
      order: "2",
      type: "expense",
      unitResidentId: null,
    },
  ],
};

describe("subtree rollup", () => {
  it("distributes the grouping's SUBTREE total, not its own 0", () => {
    const { estimate, current } = projectDistribution(db, "1");
    expect(estimate.columns).toEqual([
      { accountId: "la3", header: "Pulizie", tableId: "dt7" },
    ]);
    const eg = estimate.rows[0]!;
    expect(
      eg.children!.find((r) => {
        return r.unitId === "u100";
      })!.amounts.la3,
    ).toEqual({ cents: 5000 });
    expect(
      eg.children!.find((r) => {
        return r.unitId === "u101";
      })!.amounts.la3,
    ).toEqual({ cents: 15000 });
    expect(eg.total).toEqual({ cents: 20000 });
    const cg = current.rows[0]!;
    expect(
      cg.children!.find((r) => {
        return r.unitId === "u100";
      })!.amounts.la3,
    ).toEqual({ cents: 2500 });
    expect(
      cg.children!.find((r) => {
        return r.unitId === "u101";
      })!.amounts.la3,
    ).toEqual({ cents: 7500 });
    expect(cg.total).toEqual({ cents: 10000 });
  });

  const db = buildDb(subtreeFixture);
});

// Multi-table % split: leaf account 3 estimate 1000.00, linked 60% to table 7
// (250/750 of 1000) and 40% to table 8 (100/100 of 200 → 50%/50%).
//   u100 = 1000×0.60×(250/1000) + 1000×0.40×(100/200)
//        = 150.00 + 200.00 = 350.00 = 35000c
//   u101 = 1000×0.60×(750/1000) + 1000×0.40×(100/200)
//        = 450.00 + 200.00 = 650.00 = 65000c
const multiTableFixture: Tables = {
  ...tablesFixture,
  distributionTable: [
    {
      id: "7",
      accountingPeriodId: "1",
      name: "TabA",
      order: "1",
      restrictionUnitGroupId: null,
    },
    {
      id: "8",
      accountingPeriodId: "1",
      name: "TabB",
      order: "2",
      restrictionUnitGroupId: null,
    },
  ],
  distributionTableItem: [
    { distributionTableId: "7", unitId: "100", coefficient: "250" },
    { distributionTableId: "7", unitId: "101", coefficient: "750" },
    { distributionTableId: "8", unitId: "100", coefficient: "100" },
    { distributionTableId: "8", unitId: "101", coefficient: "100" },
  ],
  ledgerAccount: [
    {
      id: "3",
      accountingPeriodId: "1",
      name: "Spese",
      type: "regular",
      parentLedgerAccountId: null,
      kind: "expenses",
      order: "1",
    },
  ],
  expenseLedgerAccount: [
    { ledgerAccountId: "3", estimate: "1000.00", restrictionUnitGroupId: null },
  ],
  expenseLA2Table: [
    {
      id: "1",
      expenseLedgerAccountId: "3",
      distributionTableId: "7",
      type: null,
      percentage: "60.00",
    },
    {
      id: "2",
      expenseLedgerAccountId: "3",
      distributionTableId: "8",
      type: null,
      percentage: "40.00",
    },
  ],
  expenseLA2Role: [],
};

describe("multi-table % split", () => {
  it("sums both link contributions per unit", () => {
    const eg = projectDistribution(db, "1").estimate.rows[0]!;
    expect(
      eg.children!.find((r) => {
        return r.unitId === "u100";
      })!.amounts.la3,
    ).toEqual({ cents: 35000 });
    expect(
      eg.children!.find((r) => {
        return r.unitId === "u101";
      })!.amounts.la3,
    ).toEqual({ cents: 65000 });
    expect(eg.total).toEqual({ cents: 100000 });
  });

  const db = buildDb(multiTableFixture);
});

// Estimate vs currentBalance tables: account 3 estimate→TabA (250/750),
// currentBalance→TabB (100/100). estimate 400.00, actual +200.00.
//   estimate uses TabA: u100 = 400×250/1000 = 100.00; u101 = 300.00
//   current  uses TabB: u100 = 200×100/200 = 100.00; u101 = 100.00
const typeSplitFixture: Tables = {
  ...tablesFixture,
  distributionTable: [
    {
      id: "7",
      accountingPeriodId: "1",
      name: "TabA",
      order: "1",
      restrictionUnitGroupId: null,
    },
    {
      id: "8",
      accountingPeriodId: "1",
      name: "TabB",
      order: "2",
      restrictionUnitGroupId: null,
    },
  ],
  distributionTableItem: [
    { distributionTableId: "7", unitId: "100", coefficient: "250" },
    { distributionTableId: "7", unitId: "101", coefficient: "750" },
    { distributionTableId: "8", unitId: "100", coefficient: "100" },
    { distributionTableId: "8", unitId: "101", coefficient: "100" },
  ],
  ledgerAccount: [
    {
      id: "3",
      accountingPeriodId: "1",
      name: "Spese",
      type: "regular",
      parentLedgerAccountId: null,
      kind: "expenses",
      order: "1",
    },
  ],
  expenseLedgerAccount: [
    { ledgerAccountId: "3", estimate: "400.00", restrictionUnitGroupId: null },
  ],
  expenseLA2Table: [
    {
      id: "1",
      expenseLedgerAccountId: "3",
      distributionTableId: "7",
      type: "estimate",
      percentage: null,
    },
    {
      id: "2",
      expenseLedgerAccountId: "3",
      distributionTableId: "8",
      type: "currentBalance",
      percentage: null,
    },
  ],
  expenseLA2Role: [],
  ledgerTransaction: [
    { id: "9", accountingPeriodId: "1", code: "1", type: "expense" },
  ],
  ledgerEntry: [
    {
      id: "21",
      ledgerTransactionId: "9",
      postingAccountId: "3",
      amount: "200.00",
      order: "1",
      type: "expense",
      unitResidentId: null,
    },
  ],
};

describe("estimate vs currentBalance tables", () => {
  it("estimate matrix uses tableA, current uses tableB", () => {
    const { estimate, current } = projectDistribution(db, "1");
    // displayTableId is the estimate-side table (dt7)
    expect(estimate.columns[0]!.tableId).toBe("dt7");
    const eg = estimate.rows[0]!;
    expect(
      eg.children!.find((r) => {
        return r.unitId === "u100";
      })!.amounts.la3,
    ).toEqual({ cents: 10000 });
    expect(
      eg.children!.find((r) => {
        return r.unitId === "u101";
      })!.amounts.la3,
    ).toEqual({ cents: 30000 });
    const cg = current.rows[0]!;
    expect(
      cg.children!.find((r) => {
        return r.unitId === "u100";
      })!.amounts.la3,
    ).toEqual({ cents: 10000 });
    expect(
      cg.children!.find((r) => {
        return r.unitId === "u101";
      })!.amounts.la3,
    ).toEqual({ cents: 10000 });
  });

  const db = buildDb(typeSplitFixture);
});

describe("group/unit rollups still sum", () => {
  it("group amount = Σ unit amounts and group total = Σ unit totals", () => {
    const eg = projectDistribution(db, "1").estimate.rows[0]!;
    const sumLa3 = eg.children!.reduce((s, r) => {
      return s + r.amounts.la3!.cents;
    }, 0);
    expect(eg.amounts.la3).toEqual({ cents: sumLa3 });
    const sumTot = eg.children!.reduce((s, r) => {
      return s + r.total.cents;
    }, 0);
    expect(eg.total).toEqual({ cents: sumTot });
  });

  const db = buildDb(subtreeFixture);
});
