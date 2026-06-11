import { describe, it, expect } from "vitest";
import { fromCents } from "@cl/domain";
import type { DistributionColumn, DistributionRow } from "@cl/application";
import { recomputeDistribution } from "./distribution";

const c = fromCents;
const columns: DistributionColumn[] = [
  { accountId: "e-pul", header: "Pulizie", tableId: "t-prop" },
  { accountId: "e-asc", header: "Ascensore", tableId: "t-scale" },
];
const rows: DistributionRow[] = [
  { id: "d-g", kind: "group", label: "Totale", amounts: { "e-pul": c(120000), "e-asc": c(80000) }, total: c(200000),
    children: [
      { id: "d-a01", kind: "unit", unitId: "u-a01", label: "A01", amounts: { "e-pul": c(37500), "e-asc": c(32000) }, total: c(69500) },
      { id: "d-a02", kind: "unit", unitId: "u-a02", label: "A02", amounts: { "e-pul": c(82500), "e-asc": c(48000) }, total: c(130500) },
    ] },
];

describe("recomputeDistribution", () => {
  it("re-splits each column total by the new coefficients and re-derives row totals", () => {
    const out = recomputeDistribution({ columns, rows }, new Map([["u-a01", 500], ["u-a02", 500]]), "t-prop");
    const [a01, a02] = out.rows[0]!.children!;
    // e-pul (owned by t-prop) must be re-split 50/50
    expect(a01!.amounts["e-pul"]!.cents).toBe(60000);
    expect(a02!.amounts["e-pul"]!.cents).toBe(60000);
    // e-asc (owned by t-scale, different table) must be untouched
    expect(a01!.amounts["e-asc"]!.cents).toBe(32000);
    expect(a02!.amounts["e-asc"]!.cents).toBe(48000);
    // row total = new e-pul + preserved e-asc
    expect(a01!.total.cents).toBe(60000 + 32000);
    expect(out.rows[0]!.amounts["e-pul"]!.cents).toBe(120000); // group total unchanged
  });
});
