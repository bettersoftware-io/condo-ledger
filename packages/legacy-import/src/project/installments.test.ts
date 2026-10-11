import { describe, expect, it } from "vitest";

import { buildDb } from "../db.ts";
import type { Tables } from "../loadRows.ts";
import { projectInstallments } from "./installments.ts";

const tables: Tables = {
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
  ],
  unitPeriod: [{ id: "500", unitId: "100", unitOwnershipScenarioId: "1" }],
  unitResident: [
    {
      id: "900",
      unitPeriodId: "500",
      masterDataId: "10",
      percentage: "100",
      startingBalance: "-86.07",
      unitResidentPriorityId: "1",
    },
  ],
  unitResidentRole: [
    {
      id: "1",
      unitOwnershipScenarioId: "1",
      unitResidentPriorityId: "1",
      abbreviation: "PR",
      name: "Proprietario",
    },
  ],
  unitResidentPriority: [{ id: "1" }],
  masterData: [{ id: "10", status: "active", masterDataCategoryId: "2" }],
  masterDataCategory: [{ id: "2", name: "Condòmino", code: "C", order: "1" }],
  masterDataCategoryI18n: [],
  person: [
    { masterDataId: "10", firstName: "Dina", lastName: "Alberi", sex: "F" },
  ],
  company: [],
  installment: [
    {
      id: "1",
      accountingPeriodId: "1",
      name: "Rata 1",
      expiryDate: "2011-02-28",
    },
    {
      id: "2",
      accountingPeriodId: "1",
      name: "Rata 2",
      expiryDate: "2011-04-30",
    },
  ],
  installmentItem: [
    {
      id: "1",
      installmentId: "1",
      unitResidentId: "900",
      amount: "49.58",
      status: "issued",
    },
    {
      id: "2",
      installmentId: "2",
      unitResidentId: "900",
      amount: "49.58",
      status: "issued",
    },
  ],
};

describe("installments projection", () => {
  it("columns sorted by expiry", () => {
    expect(out.columns).toEqual([
      { id: "inst1", header: "Rata 1", expiry: "2011-02-28" },
      { id: "inst2", header: "Rata 2", expiry: "2011-04-30" },
    ]);
  });
  it("resident byInstallment + totals", () => {
    const res = out.rows[0]!.children![0]!.children![0]!;
    expect(res.byInstallment).toEqual({
      inst1: { cents: 4958 },
      inst2: { cents: 4958 },
    });
    expect(res.totPreventivo).toEqual({ cents: 9916 });
    expect(res.saldoPrec).toEqual({ cents: -8607 });
    expect(res.role).toBe("Proprietario");
  });

  const db = buildDb(tables);

  const out = projectInstallments(db, "1");
});
