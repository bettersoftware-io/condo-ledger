import { describe, it, expect } from "vitest";
import { projectUnits } from "./units.ts";
import { buildDb } from "../db.ts";
import type { Tables } from "../loadRows.ts";

// ---------------------------------------------------------------------------
// Base fixture: one unit (A01) with one OWNER resident (priority 1). One leaf
// expense account (id 3) estimate 200.00, actual +151.18, linked to table 7
// (single unit, coeff 1000 → 100%). With NO role rows the whole amount lands on
// the owner. preventivo = 200.00 (estimate); consuntivo = 151.18 (actual).
// ---------------------------------------------------------------------------
const tables: Tables = {
  condominium: [{ id: "1", code: "SAT", name: "Saturno", status: "active", type: "regular", address: null, taxCode: null, vatNumber: null, parentCondominiumId: null }],
  accountingPeriod: [{ id: "1", condominiumId: "1", name: "2011", type: "ordinary", status: "opened", startDate: "2011-01-01", endDate: "2011-12-31" }],
  unitType: [{ id: "1", name: "Appartamento" }], unitTypeI18n: [],
  unit: [{ id: "100", accountingPeriodId: "1", unitTypeId: "1", unitGroupId: null, code: "A01", name: "", floor: "T", innerNumber: "1", subordinateNumber: null, periodRestrictionStartDate: "2011-01-01", periodRestrictionEndDate: "2011-12-31" }],
  unitPeriod: [{ id: "500", unitId: "100", unitOwnershipScenarioId: "1", periodRestrictionStartDate: null, periodRestrictionEndDate: null }],
  unitResidentPriority: [{ id: "1" }, { id: "3" }],
  unitResidentRole: [
    { id: "1", unitOwnershipScenarioId: "1", unitResidentPriorityId: "1", abbreviation: "PR", name: "Proprietario" },
    { id: "2", unitOwnershipScenarioId: "1", unitResidentPriorityId: "3", abbreviation: "CO", name: "Conduttore" },
  ],
  unitResident: [{ id: "900", unitPeriodId: "500", masterDataId: "10", unitResidentPriorityId: "1", percentage: "100", startingBalance: "-860.65", periodRestrictionStartDate: null, periodRestrictionEndDate: null }],
  masterData: [{ id: "10", status: "active", masterDataCategoryId: "2", code: null, taxCode: null, vatNumber: null, postalAddress: null, notes: null }],
  masterDataCategory: [{ id: "2", name: "Condòmino", code: "C", order: "1" }], masterDataCategoryI18n: [],
  person: [{ masterDataId: "10", firstName: "Dina", lastName: "Alberi", sex: "F" }], company: [],
  distributionTable: [{ id: "7", accountingPeriodId: "1", name: "Proprietà", order: "1", restrictionUnitGroupId: null }],
  distributionTableItem: [{ distributionTableId: "7", unitId: "100", coefficient: "1000" }],
  ledgerAccount: [{ id: "3", accountingPeriodId: "1", name: "Spese", type: "regular", parentLedgerAccountId: null, kind: "expenses", order: "1" }],
  expenseLedgerAccount: [{ ledgerAccountId: "3", estimate: "200.00", restrictionUnitGroupId: null }],
  expenseLA2Table: [{ id: "1", expenseLedgerAccountId: "3", distributionTableId: "7", type: null, percentage: null }],
  expenseLA2Role: [],
  ledgerTransaction: [{ id: "9", accountingPeriodId: "1", code: "1", type: "expense" }, { id: "10", accountingPeriodId: "1", code: "2", type: "unitResidentTakings" }],
  ledgerEntry: [
    { id: "21", ledgerTransactionId: "9", postingAccountId: "3", amount: "151.18", order: "1", type: "expense", unitResidentId: null },
    { id: "22", ledgerTransactionId: "10", postingAccountId: "2", amount: "-100.00", order: "1", type: "unitResidentTakings", unitResidentId: "900" },
  ],
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
  it("preventivo/consuntivo come from the riparto engine; saldoPrec & versato from the ledger", () => {
    const res = rows[0]!.children![0]!.children![0]!;
    expect(res.saldoPrec).toEqual({ cents: -86065 });
    expect(res.preventivo).toEqual({ cents: 20000 }); // estimate 200.00 → owner (no role rows)
    expect(res.consuntivo).toEqual({ cents: 15118 }); // actual 151.18 → owner
    expect(res.versato).toEqual({ cents: 10000 });     // -Σ takings (−100.00) → +100.00
    expect(res.totDovuto).toEqual({ cents: -66065 });  // saldoPrec + preventivo
  });
  it("group totals sum the children", () => {
    expect(rows[0]!.saldoPrec).toEqual({ cents: -86065 });
    expect(rows[0]!.preventivo).toEqual({ cents: 20000 });
    expect(rows[0]!.consuntivo).toEqual({ cents: 15118 });
  });
});

// ---------------------------------------------------------------------------
// Role split: a unit with an OWNER (priority 1, res 900) and a TENANT
// (priority 3, res 901). The account's link has expenseLA2Role priority 3 @100%.
// The consuntivo must land entirely on the TENANT, not the owner.
// ---------------------------------------------------------------------------
const roleTables: Tables = {
  ...tables,
  unitResident: [
    { id: "900", unitPeriodId: "500", masterDataId: "10", unitResidentPriorityId: "1", percentage: "100", startingBalance: "0", periodRestrictionStartDate: null, periodRestrictionEndDate: null },
    { id: "901", unitPeriodId: "500", masterDataId: "11", unitResidentPriorityId: "3", percentage: "100", startingBalance: "0", periodRestrictionStartDate: null, periodRestrictionEndDate: null },
  ],
  masterData: [
    { id: "10", status: "active", masterDataCategoryId: "2", code: null, taxCode: null, vatNumber: null, postalAddress: null, notes: null },
    { id: "11", status: "active", masterDataCategoryId: "2", code: null, taxCode: null, vatNumber: null, postalAddress: null, notes: null },
  ],
  person: [
    { masterDataId: "10", firstName: "Dina", lastName: "Alberi", sex: "F" },
    { masterDataId: "11", firstName: "Tiziano", lastName: "Rossi", sex: "M" },
  ],
  expenseLA2Role: [{ expenseLA2TableId: "1", unitResidentPriorityId: "3", percentage: "100.00" }],
};

describe("role split — tenant-charged account", () => {
  const db = buildDb(roleTables);
  const rows = projectUnits(db, "1");
  const residents = rows[0]!.children![0]!.children!;
  const owner = residents.find((r) => r.label.includes("Alberi"))!;
  const tenant = residents.find((r) => r.label.includes("Rossi"))!;
  it("consuntivo lands on the TENANT (priority 3), not the owner", () => {
    expect(tenant.consuntivo).toEqual({ cents: 15118 });
    expect(owner.consuntivo).toEqual({ cents: 0 });
    expect(tenant.preventivo).toEqual({ cents: 20000 });
    expect(owner.preventivo).toEqual({ cents: 0 });
  });
});

// Orphan case: tenant-charged account (role priority 3 @100%) but the unit has
// ONLY an owner. The orphaned share falls back to the owner so totals tie out.
describe("role split — orphan falls back to owner", () => {
  const db = buildDb({ ...tables, expenseLA2Role: [{ expenseLA2TableId: "1", unitResidentPriorityId: "3", percentage: "100.00" }] });
  const rows = projectUnits(db, "1");
  const owner = rows[0]!.children![0]!.children![0]!;
  it("owner absorbs the tenant-priority share", () => {
    expect(owner.consuntivo).toEqual({ cents: 15118 });
    expect(owner.preventivo).toEqual({ cents: 20000 });
  });
});

// ---------------------------------------------------------------------------
// Individual expenses: a resident has BOTH a riparto current share (15118
// cents, from account 3 "expenses"-kind, same as base fixture, linked via
// table 7) AND a directly-attributed entry on account 50, also expenses-kind
// but NOT linked to any distribution table, with unitResidentId set, for
// 48909 cents (€489.09). This mirrors the real Pozzetto data where accounts
// 223/225/227/228 under parent 222 ("Spese individuali") are expenses-kind
// with unitResidentId but have NO expenseLA2Table links.
// Expected consuntivo = 15118 + 48909 = 64027 cents.
// The OWNER (res 900) gets the riparto share; the individual entry is also
// on res 900. Residents with NO such entries are unaffected — the existing
// base fixture passes unchanged because its entry on account 3 has
// unitResidentId: null, so it is not picked up as an individual expense.
// ---------------------------------------------------------------------------
const individualExpenseTables: Tables = {
  ...tables,
  ledgerAccount: [
    { id: "3", accountingPeriodId: "1", name: "Spese", type: "regular", parentLedgerAccountId: null, kind: "expenses", order: "1" },
    { id: "50", accountingPeriodId: "1", name: "Spese postali singole unità", type: "regular", parentLedgerAccountId: null, kind: "expenses", order: "2" },
  ],
  ledgerTransaction: [
    { id: "9", accountingPeriodId: "1", code: "1", type: "expense" },
    { id: "10", accountingPeriodId: "1", code: "2", type: "unitResidentTakings" },
    { id: "11", accountingPeriodId: "1", code: "3", type: "expense" },
  ],
  ledgerEntry: [
    { id: "21", ledgerTransactionId: "9", postingAccountId: "3", amount: "151.18", order: "1", type: "expense", unitResidentId: null },
    { id: "22", ledgerTransactionId: "10", postingAccountId: "2", amount: "-100.00", order: "1", type: "unitResidentTakings", unitResidentId: "900" },
    { id: "23", ledgerTransactionId: "11", postingAccountId: "50", amount: "489.09", order: "1", type: "expense", unitResidentId: "900" },
  ],
};

describe("controlUnitResident individual expenses added to consuntivo", () => {
  const db = buildDb(individualExpenseTables);
  const rows = projectUnits(db, "1");
  const res = rows[0]!.children![0]!.children![0]!;
  it("consuntivo = riparto current share + direct individual expense", () => {
    // riparto current: 15118 (actual 151.18 → 100% owner)
    // individual:      48909 (€489.09 posted to controlUnitResident acct, unitResidentId=900)
    // sum:             64027
    expect(res.consuntivo).toEqual({ cents: 64027 });
  });
  it("preventivo, saldoPrec, versato, totDovuto are unchanged from base fixture", () => {
    expect(res.preventivo).toEqual({ cents: 20000 });
    expect(res.saldoPrec).toEqual({ cents: -86065 });
    expect(res.versato).toEqual({ cents: 10000 });
    expect(res.totDovuto).toEqual({ cents: -66065 }); // saldoPrec + preventivo only
  });
  it("group consuntivo sums correctly including individual expense", () => {
    expect(rows[0]!.consuntivo).toEqual({ cents: 64027 });
  });
});

describe("percentage formatting in resident label", () => {
  const baseResident = (tables["unitResident"] as (typeof tables.unitResident & {}))![0]!;
  function makeTablesWithPct(percentage: string): Tables {
    return { ...tables, unitResident: [{ ...baseResident, percentage }] };
  }
  it('formats "100.000000" as "100"', () => {
    const db = buildDb(makeTablesWithPct("100.000000"));
    const label = projectUnits(db, "1")[0]!.children![0]!.children![0]!.label;
    expect(label).toMatch(/\(PR 100%\)$/);
    expect(label).not.toContain("100.000000");
  });
  it('formats "33.333300" as "33.33"', () => {
    const db = buildDb(makeTablesWithPct("33.333300"));
    const label = projectUnits(db, "1")[0]!.children![0]!.children![0]!.label;
    expect(label).toMatch(/\(PR 33\.33%\)$/);
    expect(label).not.toContain("33.333300");
  });
  it('formats "50.000000" as "50"', () => {
    const db = buildDb(makeTablesWithPct("50.000000"));
    const label = projectUnits(db, "1")[0]!.children![0]!.children![0]!.label;
    expect(label).toMatch(/\(PR 50%\)$/);
  });
});
