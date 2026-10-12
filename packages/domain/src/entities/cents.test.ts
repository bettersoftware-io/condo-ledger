import { describe, expect, it } from "vitest";

import { addCents, cents, subtractCents, ZERO_CENTS } from "./cents.ts";

describe("cents", () => {
  it("accepts an integer, negative included", () => {
    expect(cents(12345)).toBe(12345);
    expect(cents(-7)).toBe(-7);
    expect(ZERO_CENTS).toBe(0);
  });

  it("refuses a fraction and a non-finite number", () => {
    expect(() => {
      return cents(1.5);
    }).toThrow("not an integer amount of cents: 1.5");
    expect(() => {
      return cents(Number.NaN);
    }).toThrow("not an integer amount of cents: NaN");
  });

  it("adds and subtracts", () => {
    expect(addCents(cents(100), cents(-30))).toBe(70);
    expect(subtractCents(cents(100), cents(30))).toBe(70);
  });
});
