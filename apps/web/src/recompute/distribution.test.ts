import { expect, test } from "vitest";
import { roundingByColumn } from "./distribution";
import { distributionByPeriod, distributionTablesByPeriod } from "../mock/fixtures";

test("roundingByColumn yields the leftover cents the remainder pass assigned", () => {
  const dist = distributionByPeriod["sat-2011"]!.estimate;
  const tables = distributionTablesByPeriod["sat-2011"]!;
  // 312.5/687.5 over 120000 splits exactly → 0; same for e-asc 400/600 over 80000.
  expect(roundingByColumn(dist, tables)).toEqual({ "e-pul": 0, "e-asc": 0 });
  // 500/687.5 over 120000: floors are 50526 + 69473 = 119999 → 1 cent assigned by remainder
  const edited = tables.map((t) => t.id !== "t-prop" ? t : ({
    ...t, items: t.items.map((i) => (i.unitId === "u-a01" ? { ...i, coefficient: 500 } : i)),
  }));
  expect(roundingByColumn(dist, edited)).toEqual({ "e-pul": 1, "e-asc": 0 });
});
