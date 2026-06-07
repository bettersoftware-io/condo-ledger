import { describe, it, expect } from "vitest";
import { money, fromCents, add, formatEUR, isNegative } from "./money";

describe("Money", () => {
  it("constructs from a decimal amount as integer cents", () => {
    expect(money(1234.56).cents).toBe(123456);
  });
  it("rounds half away from zero at cent precision", () => {
    expect(money(0.005).cents).toBe(1);
    expect(money(-0.005).cents).toBe(-1);
  });
  it("adds without float drift", () => {
    expect(add(money(0.1), money(0.2)).cents).toBe(30);
  });
  it("formats Italian EUR", () => {
    expect(formatEUR(fromCents(123456))).toBe("1.234,56");
    expect(formatEUR(fromCents(-50))).toBe("-0,50");
  });
  it("detects negative", () => {
    expect(isNegative(fromCents(-1))).toBe(true);
    expect(isNegative(fromCents(0))).toBe(false);
  });
});
