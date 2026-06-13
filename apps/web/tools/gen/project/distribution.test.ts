import { describe, it, expect } from "vitest";
import { projectDistributionTables, projectDistribution } from "./distribution.ts";
import { buildDb } from "../db.ts";
import type { Tables } from "../loadRows.ts";

const tables: Tables = {
  condominium: [{ id: "1", code: "SAT", name: "S", status: "active", type: "regular", address: null, taxCode: null, vatNumber: null, parentCondominiumId: null }],
  accountingPeriod: [{ id: "1", condominiumId: "1", name: "2011", type: "ordinary", status: "opened", startDate: "2011-01-01", endDate: "2011-12-31" }],
  unit: [
    { id: "100", accountingPeriodId: "1", code: "A01", name: "", unitTypeId: "1", unitGroupId: null, floor: null, innerNumber: null, subordinateNumber: null, periodRestrictionStartDate: null, periodRestrictionEndDate: null },
    { id: "101", accountingPeriodId: "1", code: "A02", name: "", unitTypeId: "1", unitGroupId: null, floor: null, innerNumber: null, subordinateNumber: null, periodRestrictionStartDate: null, periodRestrictionEndDate: null },
  ],
  unitPeriod: [{ id: "500", unitId: "100" }, { id: "501", unitId: "101" }],
  unitResident: [{ id: "900", unitPeriodId: "500", masterDataId: "10", percentage: "100", startingBalance: "0", unitResidentPriorityId: "1" }, { id: "901", unitPeriodId: "501", masterDataId: "11", percentage: "100", startingBalance: "0", unitResidentPriorityId: "1" }],
  distributionTable: [{ id: "7", accountingPeriodId: "1", name: "Proprietà", order: "1", restrictionUnitGroupId: null }],
  distributionTableItem: [{ distributionTableId: "7", unitId: "100", coefficient: "250" }, { distributionTableId: "7", unitId: "101", coefficient: "750" }],
  ledgerAccount: [{ id: "3", accountingPeriodId: "1", name: "Pulizie", type: "regular", parentLedgerAccountId: null, kind: "expenses", order: "1" }],
  expenseLedgerAccount: [{ ledgerAccountId: "3", estimate: "200.00", restrictionUnitGroupId: null }],
  expenseLA2Table: [{ id: "1", expenseLedgerAccountId: "3", distributionTableId: "7", type: "estimate", percentage: "100" }],
  expenseLA2Role: [],
  ledgerTransaction: [{ id: "9", accountingPeriodId: "1", code: "1", type: "individualExpense" }],
  ledgerEntry: [
    { id: "21", ledgerTransactionId: "9", postingAccountId: "3", amount: "50.00", order: "1", type: "individualExpense", unitResidentId: "900" },
    { id: "22", ledgerTransactionId: "9", postingAccountId: "3", amount: "150.00", order: "2", type: "individualExpense", unitResidentId: "901" },
  ],
};

describe("distribution projection", () => {
  const db = buildDb(tables);
  it("builds tables with total = Σ coefficients", () => {
    const t = projectDistributionTables(db, "1");
    expect(t[0]).toMatchObject({ id: "dt7", name: "Proprietà", total: 1000 });
    expect(t[0]!.items.map((i) => i.coefficient)).toEqual([250, 750]);
  });
  it("estimate matrix = estimate × coefficient ÷ total", () => {
    const est = projectDistribution(db, "1").estimate;
    expect(est.columns).toEqual([{ accountId: "la3", header: "Pulizie", tableId: "dt7" }]);
    const grp = est.rows[0]!;
    expect(grp.children!.find((r) => r.unitId === "u100")!.amounts["la3"]).toEqual({ cents: 5000 });
    expect(grp.children!.find((r) => r.unitId === "u101")!.amounts["la3"]).toEqual({ cents: 15000 });
    expect(grp.total).toEqual({ cents: 20000 });
  });
  it("current matrix = Σ individualExpense entries per unit", () => {
    const cur = projectDistribution(db, "1").current;
    const grp = cur.rows[0]!;
    expect(grp.children!.find((r) => r.unitId === "u100")!.amounts["la3"]).toEqual({ cents: 5000 });
    expect(grp.children!.find((r) => r.unitId === "u101")!.amounts["la3"]).toEqual({ cents: 15000 });
  });
});
