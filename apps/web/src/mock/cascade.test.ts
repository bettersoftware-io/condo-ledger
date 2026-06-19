// apps/web/src/mock/cascade.test.ts
import { describe, it, expect } from "vitest";
import type { DistributionColumn, DistributionRow, DistributionTable, LedgerAccountRow, UnitRow } from "@cl/application";
import type { PeriodState, RipartoEngine, ResidentBalance } from "@cl/domain";
import { liveState, overlayDistribution, overlayUnits } from "./cascade";

const m = (cents: number) => ({ cents });

describe("liveState", () => {
  const seeded: PeriodState = {
    riparto: {
      accounts: [{ id: "10", name: "Pulizie", order: 0, parentId: null }],
      links: [], roles: [], residents: [], unitLegacyIds: ["1", "2"],
      tableItems: [{ tableId: "5", unitId: "1", coefficient: 100 }],
      estimateCentsByAccount: { "10": 9999 },
      actualCentsByAccount: { "10": 8888 },
    },
    plan: { installmentIds: [], overrides: [] },
    opening: {}, paid: { "1": 1 },
  };
  const tables: DistributionTable[] = [
    { id: "dt5", name: "Prop", restriction: null, total: 300,
      items: [
        { unitId: "u1", unitLabel: "A1", coefficient: 120, competenza: "intero" },
        { unitId: "u2", unitLabel: "A2", coefficient: 180, competenza: "intero" },
      ] },
  ];
  const accounts: LedgerAccountRow[] = [
    { id: "la10", kind: "regular", label: "Pulizie", dare: m(8888), avere: m(0), saldo: m(8888), preventivo: m(120000) },
  ];

  it("overrides coefficients, estimate, actuals and paid from the live subjects (strip prefixes)", () => {
    const out = liveState(seeded, tables, accounts, { "1": 5000 });
    expect(out.riparto.tableItems).toEqual([
      { tableId: "5", unitId: "1", coefficient: 120 },
      { tableId: "5", unitId: "2", coefficient: 180 },
    ]);
    expect(out.riparto.estimateCentsByAccount).toEqual({ "10": 120000 });
    expect(out.riparto.actualCentsByAccount).toEqual({ "10": 8888 });
    expect(out.paid).toEqual({ "1": 5000 });
    // static parts unchanged
    expect(out.riparto.unitLegacyIds).toEqual(["1", "2"]);
    expect(out.opening).toBe(seeded.opening);
  });

  it("keeps the seeded value when an account key is absent from accounts$", () => {
    const out = liveState(seeded, tables, [], { });
    expect(out.riparto.estimateCentsByAccount).toEqual({ "10": 9999 });
    expect(out.riparto.actualCentsByAccount).toEqual({ "10": 8888 });
  });
});

describe("overlayDistribution", () => {
  const columns: DistributionColumn[] = [{ accountId: "la10", header: "Pulizie", tableId: "dt5" }];
  const skeleton = {
    columns,
    rows: [{
      id: "destimate-g", kind: "group" as const, label: "Totale",
      amounts: { la10: m(0) }, total: m(0),
      children: [
        { id: "destimate-1", kind: "unit" as const, unitId: "u1", label: "A1", amounts: { la10: m(0) }, total: m(0) },
        { id: "destimate-2", kind: "unit" as const, unitId: "u2", label: "A2", amounts: { la10: m(0) }, total: m(0) },
      ],
    } satisfies DistributionRow],
  };
  const engine = {
    perUnitAmount: (acct: string, _mode: string, unit: string) =>
      acct === "10" && unit === "1" ? 50000 : acct === "10" && unit === "2" ? 70000 : 0,
  } as unknown as RipartoEngine;

  it("paints per-unit amounts and re-sums group + unit totals, preserving skeleton labels/ids", () => {
    const out = overlayDistribution(engine, skeleton, "estimate");
    const g = out.rows[0]!;
    expect(g.children!.find((r) => r.unitId === "u1")!.amounts.la10!.cents).toBe(50000);
    expect(g.children!.find((r) => r.unitId === "u2")!.amounts.la10!.cents).toBe(70000);
    expect(g.children!.find((r) => r.unitId === "u1")!.total.cents).toBe(50000);
    expect(g.amounts.la10!.cents).toBe(120000);
    expect(g.total.cents).toBe(120000);
    expect(g.children![0]!.label).toBe("A1"); // skeleton preserved
  });
});

describe("overlayUnits", () => {
  const balances: ResidentBalance[] = [
    { residentId: "1", preventivoCents: 1000, consuntivoCents: 800, saldoPrecCents: 200, versatoCents: 300, totDovutoCents: 900 },
  ];
  const skeleton: UnitRow[] = [{
    id: "g", kind: "group", label: "Totale",
    saldoPrec: m(0), preventivo: m(0), consuntivo: m(0), totDovuto: m(0), versato: m(0),
    children: [{
      id: "u1", kind: "unit", label: "A1",
      saldoPrec: m(0), preventivo: m(0), consuntivo: m(0), totDovuto: m(0), versato: m(0),
      children: [{
        id: "r1", kind: "resident", label: "Rossi",
        saldoPrec: m(0), preventivo: m(0), consuntivo: m(0), totDovuto: m(0), versato: m(0),
      }],
    }],
  }];

  it("sets resident money from balances + individual, uses saldoPrec+preventivo for totDovuto, re-sums ancestors", () => {
    const out = overlayUnits(balances, skeleton, { "1": 50 });
    const res = out[0]!.children![0]!.children![0]!;
    expect(res.saldoPrec.cents).toBe(200);
    expect(res.preventivo.cents).toBe(1000);
    expect(res.consuntivo.cents).toBe(800 + 50); // individual folded in
    expect(res.versato.cents).toBe(300);
    expect(res.totDovuto.cents).toBe(200 + 1000); // saldoPrec + preventivo, NOT totDovutoCents
    expect(out[0]!.consuntivo.cents).toBe(850); // group re-summed
    expect(out[0]!.children![0]!.label).toBe("A1"); // skeleton preserved
  });
});
