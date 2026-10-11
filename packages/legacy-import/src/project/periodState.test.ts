import { describe, it, expect } from "vitest";
import { dbToPeriodState } from "./periodState.ts";
import type { Db } from "../db.ts";

describe("dbToPeriodState", () => {
  it("carries the riparto input, an empty installment plan, opening (startingBalance) and paid (-takings)", () => {
    const state = dbToPeriodState(db, "p1");
    // riparto comes from dbToRipartoInput — residents present, unit in period:
    expect(state.riparto.unitLegacyIds).toEqual(["u1"]);
    expect(state.riparto.residents.map((r) => {return r.residentId}).sort()).toEqual(["r1", "r2"]);
    // installments are kept legacy — empty plan here:
    expect(state.plan).toEqual({ installmentIds: [], overrides: [] });
    // opening = startingBalance cents per resident:
    expect(state.opening).toEqual({ r1: 5000, r2: 0 });
    // paid = -takings (versato); r1 has a -20,00 taking (credit) → versato 2000; r2 none → absent:
    expect(state.paid).toEqual({ r1: 2000 });
  });
});

// Minimal in-memory Db: only rows() and by() are exercised by the adapter.
function createFakeDb(tables: Record<string, Record<string, unknown>[]>): Db {
  function rows(t: string) {
    return tables[t] ?? [];
  }

  function by(t: string, key: string) {
    const map = new Map<string, Record<string, unknown>>();
    for (const r of rows(t)) map.set(String(r[key]), r);
    return { get: (k: string) => {return map.get(k)} };
  }

  function group(t: string, key: string) {
    const map = new Map<string, Record<string, unknown>[]>();

    for (const r of rows(t)) {
      const k = String(r[key]);
      (map.get(k) ?? map.set(k, []).get(k)!).push(r);
    }

    return { get: (k: string) => {return map.get(k)} };
  }

  return { rows, by, group } as unknown as Db;
}

const db = createFakeDb({
  unit: [{ id: "u1", code: "1", accountingPeriodId: "p1" }],
  unitPeriod: [{ id: "up1", unitId: "u1" }],
  unitResident: [
    { id: "r1", unitPeriodId: "up1", unitResidentPriorityId: "1", percentage: 100, startingBalance: "50,00" },
    { id: "r2", unitPeriodId: "up1", unitResidentPriorityId: "1", percentage: 100, startingBalance: "0,00" },
  ],
  ledgerTransaction: [{ id: "t1", accountingPeriodId: "p1" }],
  ledgerEntry: [
    // takings credit the resident (NEGATIVE in the ledger), exactly as in the real dump
    { ledgerTransactionId: "t1", type: "unitResidentTakings", unitResidentId: "r1", amount: "-20,00" },
  ],
  // tables read by dbToRipartoInput but empty here:
  ledgerAccount: [],
  expenseLA2Table: [],
  expenseLedgerAccount: [],
  distributionTableItem: [],
  expenseLA2Role: [],
});
