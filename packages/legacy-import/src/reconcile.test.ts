import { describe, it, expect } from "vitest";
import { reconcilePeriods } from "./reconcile.ts";
import { buildDb } from "./db.ts";
import type { Tables } from "./loadRows.ts";

describe("reconcilePeriods", () => {
  it("flags balanced books valid, unbalanced invalid, empty as structure-only", () => {
    const balanced = buildDb({ ...base, ledgerEntry: [
      { id: "1", ledgerTransactionId: "9", postingAccountId: "2", amount: "100.00", order: "1", type: null, unitResidentId: null },
      { id: "2", ledgerTransactionId: "9", postingAccountId: "3", amount: "-100.00", order: "2", type: null, unitResidentId: null }] });
    const r = reconcilePeriods(balanced);
    expect(r["1"]).toEqual({ hasBooks: true, reconciles: true });
    expect(r["2"]).toEqual({ hasBooks: false, reconciles: true }); // no entries → structure-only, allowed

    const unbalanced = buildDb({ ...base, ledgerEntry: [
      { id: "1", ledgerTransactionId: "9", postingAccountId: "2", amount: "100.00", order: "1", type: null, unitResidentId: null }] });
    expect(reconcilePeriods(unbalanced)["1"]).toEqual({ hasBooks: true, reconciles: false });
  });
});

const base: Tables = {
  condominium: [{ id: "1", code: "SAT", name: "S", status: "active", type: "regular", address: null, taxCode: null, vatNumber: null, parentCondominiumId: null }],
  accountingPeriod: [
    { id: "1", condominiumId: "1", name: "2011", type: "ordinary", status: "opened", startDate: "2011-01-01", endDate: "2011-12-31" },
    { id: "2", condominiumId: "1", name: "2012", type: "ordinary", status: "opened", startDate: "2012-01-01", endDate: "2012-12-31" },
  ],
  unit: [{ id: "100", accountingPeriodId: "1", code: "A", name: "", unitTypeId: "1", unitGroupId: null, floor: null, innerNumber: null, subordinateNumber: null, periodRestrictionStartDate: null, periodRestrictionEndDate: null },
         { id: "101", accountingPeriodId: "2", code: "B", name: "", unitTypeId: "1", unitGroupId: null, floor: null, innerNumber: null, subordinateNumber: null, periodRestrictionStartDate: null, periodRestrictionEndDate: null }],
  ledgerTransaction: [{ id: "9", accountingPeriodId: "1", code: "1", type: "x" }],
};
