import { describe, it, expect } from "vitest";
import { computeBalances, perResidentTotals } from "./computeBalances.ts";
import { buildRiparto } from "./computeRiparto.ts";
import type { RipartoInput } from "./types.ts";

describe("perResidentTotals", () => {
  it("accumulates per-resident estimate across units and columns", () => {
    const eng = buildRiparto(input);
    const est = perResidentTotals(eng, "estimate");
    expect(est.get("r1")).toBe(60000);
    expect(est.get("r2")).toBe(40000);
  });
});

describe("computeBalances", () => {
  it("computes preventivo/consuntivo/saldoPrec/versato/totDovuto per resident", () => {
    const eng = buildRiparto(input);
    const balances = computeBalances(
      input.residents,
      eng,
      { r1: 5000 }, // opening (saldoPrec)
      { r2: 2000 }, // paid (versato)
    );
    const r1 = balances.find((b) => {return b.residentId === "r1"})!;
    expect(r1.preventivoCents).toBe(60000);
    expect(r1.consuntivoCents).toBe(30000); // 50000 * 60/100
    expect(r1.saldoPrecCents).toBe(5000);
    expect(r1.versatoCents).toBe(0);
    expect(r1.totDovutoCents).toBe(60000 + 5000 - 0);

    const r2 = balances.find((b) => {return b.residentId === "r2"})!;
    expect(r2.preventivoCents).toBe(40000);
    expect(r2.consuntivoCents).toBe(20000);
    expect(r2.saldoPrecCents).toBe(0);
    expect(r2.versatoCents).toBe(2000);
    expect(r2.totDovutoCents).toBe(40000 + 0 - 2000);
  });

  it("includes a roster resident with zero shares", () => {
    const eng = buildRiparto(input);
    const balances = computeBalances(
      [...input.residents, { unitId: "u3", residentId: "r3", priorityId: "1", percentage: 100 }],
      eng,
      {},
      {},
    );
    const r3 = balances.find((b) => {return b.residentId === "r3"})!;
    expect(r3.preventivoCents).toBe(0);
    expect(r3.consuntivoCents).toBe(0);
    expect(r3.totDovutoCents).toBe(0);
  });
});

// account A linked to table T 100%; units u1/u2 coeff 60/40; estimate 100000, actual 50000.
// one owner resident per unit.
const input: RipartoInput = {
  accounts: [{ id: "A", name: "Spese", order: 1, parentId: null }],
  links: [{ accountId: "A", linkId: "L1", tableId: "T", pct: 100, type: null }],
  estimateCentsByAccount: { A: 100000 },
  actualCentsByAccount: { A: 50000 },
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
};
