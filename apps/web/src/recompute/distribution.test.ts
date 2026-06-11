import { describe, it, expect } from "vitest";
import { fromCents } from "@cl/domain";
import type { DistributionColumn, DistributionRow } from "@cl/application";
import { recomputeDistribution } from "./distribution";

const c = fromCents;
const columns: DistributionColumn[] = [{ accountId: "e-pul", header: "Pulizie" }];
const rows: DistributionRow[] = [
  { id: "d-g", kind: "group", label: "Totale", amounts: { "e-pul": c(120000) }, total: c(120000),
    children: [
      { id: "d-a01", kind: "unit", unitId: "u-a01", label: "A01", amounts: { "e-pul": c(37500) }, total: c(37500) },
      { id: "d-a02", kind: "unit", unitId: "u-a02", label: "A02", amounts: { "e-pul": c(82500) }, total: c(82500) },
    ] },
];

describe("recomputeDistribution", () => {
  it("re-splits each column total by the new coefficients and re-derives row totals", () => {
    const out = recomputeDistribution({ columns, rows }, new Map([["u-a01", 500], ["u-a02", 500]]));
    const [a01, a02] = out.rows[0]!.children!;
    expect(a01!.amounts["e-pul"]!.cents).toBe(60000);
    expect(a02!.amounts["e-pul"]!.cents).toBe(60000);
    expect(a01!.total.cents).toBe(60000);
    expect(out.rows[0]!.amounts["e-pul"]!.cents).toBe(120000); // group total unchanged
  });
});
