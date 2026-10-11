import { describe, it, expect } from "vitest";
import { recomputePeriod } from "./recomputePeriod.ts";
import type { PeriodState } from "./periodTypes.ts";

const state: PeriodState = {
  riparto: {
    accounts: [{ id: "A", name: "Spese", order: 1, parentId: null }],
    links: [{ accountId: "A", linkId: "L1", tableId: "T", pct: 100, type: null }],
    estimateCentsByAccount: { A: 100000 },
    actualCentsByAccount: { A: 0 },
    tableItems: [
      { tableId: "T", unitId: "u1", coefficient: 60 },
      { tableId: "T", unitId: "u2", coefficient: 40 },
    ],
    roles: [],
    residents: [
      { unitId: "u1", residentId: "r1", priorityId: "1", percentage: 100 },
      { unitId: "u2", residentId: "r2", priorityId: "1", percentage: 100 },
    ],
    unitLegacyIds: ["u1", "u2"],
  },
  plan: { installmentIds: ["i1", "i2"], overrides: [] },
  opening: { r1: 1000 },
  paid: {},
};

describe("recomputePeriod", () => {
  it("returns riparto engine, installments, and balances", () => {
    const r = recomputePeriod(state);
    expect(r.riparto.unitLegacyIds).toEqual(["u1", "u2"]);
    expect(r.balances.find((b) => b.residentId === "r1")!.preventivoCents).toBe(60000);
    // installments: r1 preventivo 60000 over 2 → 30000,30000
    const r1cells = r.installments.get("r1")!;
    expect(r1cells.get("i1")).toBe(30000);
    expect(r1cells.get("i2")).toBe(30000);
  });

  it("installment cells per resident sum to that resident's preventivo", () => {
    const r = recomputePeriod(state);
    for (const b of r.balances) {
      const cells = r.installments.get(b.residentId);
      const sum = cells ? [...cells.values()].reduce((a, c) => a + c, 0) : 0;
      expect(sum).toBe(b.preventivoCents);
    }
  });
});
