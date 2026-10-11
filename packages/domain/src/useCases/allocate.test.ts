// packages/domain/src/allocate.test.ts
import { describe, it, expect } from "vitest";
import { allocate } from "./allocate.ts";

describe("allocate", () => {
  it("sums exactly to the total (largest-remainder)", () => {
    expect(allocate(100, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(100);
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
  });
  it("returns zeros when weights are all zero", () => {
    expect(allocate(100, [0, 0])).toEqual([0, 0]);
  });
  it("handles negative totals symmetrically", () => {
    expect(allocate(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
  });
  it("preserves the total for millesimal weights", () => {
    expect(allocate(200000, [312.5, 687.5]).reduce((a, b) => a + b, 0)).toBe(200000);
    expect(allocate(200000, [312.5, 687.5])).toEqual([62500, 137500]);
  });
  it("rejects non-integer totals", () => {
    expect(() => allocate(10.5, [1])).toThrow();
  });
});
