import { describe, it, expect } from "vitest";
import { distributeInstallments, redistributeOverride } from "./installments";

describe("distributeInstallments", () => {
  it("allocates total by coefficient, then per resident across N rate", () => {
    const out = distributeInstallments(200000, [312.5, 687.5], 3);
    expect(out).toEqual([
      [20834, 20833, 20833],   // 62500 over 3
      [45834, 45833, 45833],   // 137500 over 3
    ]);
    const grand = out.flat().reduce((a, b) => a + b, 0);
    expect(grand).toBe(200000);
  });
});

describe("redistributeOverride", () => {
  it("keeps the row total constant by spreading the delta over later cells", () => {
    expect(redistributeOverride([300, 300, 400], 0, 250)).toEqual([250, 325, 425]);
  });
  it("leaves earlier cells untouched and absorbs into nothing when last cell edited", () => {
    expect(redistributeOverride([300, 300, 400], 2, 350)).toEqual([300, 300, 350]);
  });
  it("rejects overrides that would drive later cells negative", () => {
    const cells = [100, 10, 10];
    expect(redistributeOverride(cells, 0, 300)).toBe(cells); // delta -200 → r2/r3 would go negative
    expect(redistributeOverride(cells, 0, -5)).toBe(cells);  // negative cell value itself rejected
    expect(redistributeOverride(cells, 0, 80)).toEqual([80, 20, 20]); // legal spread still works
  });
  it("returns the original reference for identity edits (delta 0)", () => {
    const cells = [100, 50, 50];
    expect(redistributeOverride(cells, 0, 100)).toBe(cells);
  });
});
