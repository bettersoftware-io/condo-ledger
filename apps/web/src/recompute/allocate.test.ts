import { describe, it, expect } from "vitest";
import { allocate } from "./allocate";

describe("allocate (largest remainder)", () => {
  it("splits exactly, handing leftover cents to the largest fractional parts", () => {
    // 1000 cents over equal thirds → 334/333/333 (first index wins the tie)
    expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333]);
  });
  it("preserves the total for millesimal weights", () => {
    const out = allocate(200000, [312.5, 687.5]);
    expect(out[0] + out[1]).toBe(200000);
    expect(out).toEqual([62500, 137500]);
  });
  it("handles negative totals symmetrically", () => {
    expect(allocate(-1000, [1, 1, 1])).toEqual([-334, -333, -333]);
  });
  it("returns zeros when all weights are zero", () => {
    expect(allocate(500, [0, 0])).toEqual([0, 0]);
  });
  it("rejects non-integer totals", () => {
    expect(() => allocate(10.5, [1])).toThrow();
  });
});
