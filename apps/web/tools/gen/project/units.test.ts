import { describe, it, expect } from "vitest";
import { projectUnits } from "./units.ts";
import { buildDb } from "../db.ts";
import type { Tables } from "../loadRows.ts";

const tables: Tables = {
  condominium: [{ id: "1", code: "SAT", name: "Saturno", status: "active", type: "regular", address: null, taxCode: null, vatNumber: null, parentCondominiumId: null }],
  accountingPeriod: [{ id: "1", condominiumId: "1", name: "2011", type: "ordinary", status: "opened", startDate: "2011-01-01", endDate: "2011-12-31" }],
  unitType: [{ id: "1", name: "Appartamento" }], unitTypeI18n: [],
  unit: [{ id: "100", accountingPeriodId: "1", unitTypeId: "1", unitGroupId: null, code: "A01", name: "", floor: "T", innerNumber: "1", subordinateNumber: null, periodRestrictionStartDate: "2011-01-01", periodRestrictionEndDate: "2011-12-31" }],
  unitPeriod: [{ id: "500", unitId: "100", unitOwnershipScenarioId: "1", periodRestrictionStartDate: null, periodRestrictionEndDate: null }],
  unitResidentPriority: [{ id: "1" }],
  unitResidentRole: [{ id: "1", unitOwnershipScenarioId: "1", unitResidentPriorityId: "1", abbreviation: "PR", name: "Proprietario" }],
  unitResident: [{ id: "900", unitPeriodId: "500", masterDataId: "10", unitResidentPriorityId: "1", percentage: "100", startingBalance: "-860.65", periodRestrictionStartDate: null, periodRestrictionEndDate: null }],
  masterData: [{ id: "10", status: "active", masterDataCategoryId: "2", code: null, taxCode: null, vatNumber: null, postalAddress: null, notes: null }],
  masterDataCategory: [{ id: "2", name: "Condòmino", code: "C", order: "1" }], masterDataCategoryI18n: [],
  person: [{ masterDataId: "10", firstName: "Dina", lastName: "Alberi", sex: "F" }], company: [],
  ledgerTransaction: [{ id: "9", accountingPeriodId: "1", code: "1", type: "individualExpense" }, { id: "10", accountingPeriodId: "1", code: "2", type: "unitResidentTakings" }],
  ledgerEntry: [
    { id: "21", ledgerTransactionId: "9", postingAccountId: "3", amount: "151.18", order: "1", type: "individualExpense", unitResidentId: "900" },
    { id: "22", ledgerTransactionId: "10", postingAccountId: "2", amount: "-100.00", order: "1", type: "unitResidentTakings", unitResidentId: "900" },
  ],
  installment: [{ id: "1", accountingPeriodId: "1", name: "Rata 1", expiryDate: "2011-02-28" }],
  installmentItem: [{ id: "1", installmentId: "1", unitResidentId: "900", amount: "148.73", status: "issued" }],
};

describe("units projection", () => {
  const db = buildDb(tables);
  const rows = projectUnits(db, "1");
  it("nests group → unit → resident", () => {
    expect(rows[0]!.kind).toBe("group");
    const unit = rows[0]!.children![0]!;
    expect(unit.kind).toBe("unit");
    expect(unit.label).toContain("A01");
    expect(unit.unitType).toBe("Appartamento");
    expect(unit.children![0]!.label).toBe("Alberi Dina (PR 100%)");
  });
  it("computes resident money from the ledger", () => {
    const res = rows[0]!.children![0]!.children![0]!;
    expect(res.saldoPrec).toEqual({ cents: -86065 });
    expect(res.consuntivo).toEqual({ cents: 15118 });
    expect(res.versato).toEqual({ cents: 10000 });   // -Σ takings (−100.00) → +100.00
    expect(res.preventivo).toEqual({ cents: 14873 }); // Σ installmentItem
    expect(res.totDovuto).toEqual({ cents: -71192 }); // saldoPrec + preventivo
  });
  it("group totals sum the children", () => {
    expect(rows[0]!.saldoPrec).toEqual({ cents: -86065 });
  });
});

describe("percentage formatting in resident label", () => {
  const baseResident = (tables["unitResident"] as (typeof tables.unitResident & {}))![0]!;
  function makeTablesWithPct(percentage: string): Tables {
    return {
      ...tables,
      unitResident: [{ ...baseResident, percentage }],
    };
  }

  it('formats "100.000000" as "100"', () => {
    const db = buildDb(makeTablesWithPct("100.000000"));
    const rows = projectUnits(db, "1");
    const label = rows[0]!.children![0]!.children![0]!.label;
    expect(label).toMatch(/\(PR 100%\)$/);
    expect(label).not.toContain("100.000000");
  });

  it('formats "33.333300" as "33.33"', () => {
    const db = buildDb(makeTablesWithPct("33.333300"));
    const rows = projectUnits(db, "1");
    const label = rows[0]!.children![0]!.children![0]!.label;
    expect(label).toMatch(/\(PR 33\.33%\)$/);
    expect(label).not.toContain("33.333300");
  });

  it('formats "50.000000" as "50"', () => {
    const db = buildDb(makeTablesWithPct("50.000000"));
    const rows = projectUnits(db, "1");
    const label = rows[0]!.children![0]!.children![0]!.label;
    expect(label).toMatch(/\(PR 50%\)$/);
  });
});
