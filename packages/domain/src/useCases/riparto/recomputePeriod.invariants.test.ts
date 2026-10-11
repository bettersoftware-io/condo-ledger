import { describe, it, expect } from "vitest";
import { recomputePeriod } from "./recomputePeriod.ts";
import { perResidentTotals } from "./computeBalances.ts";
import type { PeriodState } from "./periodTypes.ts";

// Two linked accounts, two tables, owner/tenant role split on one link, rounding-edge totals.
const state: PeriodState = {
  riparto: {
    accounts: [
      { id: "A", name: "Acqua", order: 1, parentId: null },
      { id: "B", name: "Scale", order: 2, parentId: null },
    ],
    links: [
      { accountId: "A", linkId: "LA", tableId: "T1", pct: 100, type: null },
      { accountId: "B", linkId: "LB", tableId: "T2", pct: 100, type: null },
    ],
    estimateCentsByAccount: { A: 100001, B: 99999 }, // odd totals → rounding stress
    actualCentsByAccount: { A: 33333, B: 66667 },
    tableItems: [
      { tableId: "T1", unitId: "u1", coefficient: 333 },
      { tableId: "T1", unitId: "u2", coefficient: 333 },
      { tableId: "T1", unitId: "u3", coefficient: 334 },
      { tableId: "T2", unitId: "u1", coefficient: 1 },
      { tableId: "T2", unitId: "u2", coefficient: 1 },
      { tableId: "T2", unitId: "u3", coefficient: 1 },
    ],
    roles: [
      { linkId: "LA", priorityId: "1", percentage: 70 },
      { linkId: "LA", priorityId: "3", percentage: 30 },
    ],
    residents: [
      { unitId: "u1", residentId: "o1", priorityId: "1", percentage: 100 },
      { unitId: "u1", residentId: "t1", priorityId: "3", percentage: 100 },
      { unitId: "u2", residentId: "o2", priorityId: "1", percentage: 100 },
      { unitId: "u3", residentId: "o3", priorityId: "1", percentage: 100 },
    ],
    unitLegacyIds: ["u1", "u2", "u3"],
  },
  plan: { installmentIds: ["i1", "i2", "i3"], overrides: [{ residentId: "o2", installmentId: "i1", cents: 1 }] },
  opening: { o1: 500, o2: -200 },
  paid: { o3: 100 },
};

describe("recomputePeriod invariants", () => {
  it("conservation: per-resident estimate Σ equals per-unit estimate Σ (the matrix splits exactly)", () => {
    const r = recomputePeriod(state);
    const perResident = [...perResidentTotals(r.riparto, "estimate").values()].reduce((a, c) => a + c, 0);
    const perUnit = r.riparto.unitLegacyIds.reduce(
      (s, u) => s + r.riparto.columns.reduce((c, col) => c + r.riparto.perUnitAmount(col.legacyAccountId, "estimate", u), 0),
      0,
    );
    expect(perResident).toBe(perUnit);
  });

  it("installment cells Σ equals resident preventivo (conserved, overrides included)", () => {
    const r = recomputePeriod(state);
    for (const b of r.balances) {
      const cells = r.installments.get(b.residentId);
      const sum = cells ? [...cells.values()].reduce((a, c) => a + c, 0) : 0;
      expect(sum).toBe(b.preventivoCents);
    }
  });

  it("balances: totDovuto = preventivo + saldoPrec − versato for every resident", () => {
    const r = recomputePeriod(state);
    for (const b of r.balances) {
      expect(b.totDovutoCents).toBe(b.preventivoCents + b.saldoPrecCents - b.versatoCents);
    }
  });

  it("idempotence/determinism: recompute twice yields identical results", () => {
    const a = recomputePeriod(state);
    const b = recomputePeriod(state);
    const norm = (r: ReturnType<typeof recomputePeriod>) => ({
      balances: r.balances,
      installments: [...r.installments].map(([rid, cells]) => [rid, [...cells.entries()]]),
      estimate: [...perResidentTotals(r.riparto, "estimate").entries()],
    });
    expect(norm(a)).toEqual(norm(b));
  });

  it("owner/tenant split conserves within the unit (o1 + t1 estimate = unit u1 estimate)", () => {
    const r = recomputePeriod(state);
    const est = perResidentTotals(r.riparto, "estimate");
    const u1Total = r.riparto.columns.reduce((c, col) => c + r.riparto.perUnitAmount(col.legacyAccountId, "estimate", "u1"), 0);
    expect((est.get("o1") ?? 0) + (est.get("t1") ?? 0)).toBe(u1Total);
  });
});
