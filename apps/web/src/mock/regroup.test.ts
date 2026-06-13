import { describe, it, expect } from "vitest";
import { regroupUnits } from "./regroup";
import { unitsByPeriod } from "./fixtures";

const rows = unitsByPeriod["sat-2011"]!;

describe("regroupUnits", () => {
  it("'gruppo' returns the tree unchanged (same reference)", () => {
    expect(regroupUnits(rows, "gruppo")).toBe(rows);
  });
  it("'unita' lifts units to the top level, residents kept as children", () => {
    const out = regroupUnits(rows, "unita");
    expect(out.map((r) => r.id)).toEqual(["u-a01", "u-a02"]);
    expect(out[0]!.children!.map((r) => r.id)).toEqual(["r-a01-1"]);
  });
  it("'condomino' lifts residents to the top level with their unit as child", () => {
    const out = regroupUnits(rows, "condomino");
    expect(out.map((r) => r.id)).toEqual(["r-a01-1", "r-a02-1", "r-a02-2"]);
    expect(out[0]!.children!.map((r) => r.label)).toEqual(["A01 - Alberi Dina (PR)"]);
  });
});
