import { describe, expect, it } from "vitest";

import { parseAmount } from "./amounts.ts";

describe("parseAmount", () => {
  it("reads what formatCents writes, and plain numbers", () => {
    expect(parseAmount("1,234.56")).toBe(123456);
    expect(parseAmount("1234.56")).toBe(123456);
    expect(parseAmount("1234")).toBe(123400);
    expect(parseAmount(" 12 ")).toBe(1200);
    expect(parseAmount("-5")).toBe(-500);
  });

  it("rounds to the nearest cent where the binary fraction falls just short", () => {
    expect(parseAmount("0.29")).toBe(29);
    expect(parseAmount("-0.29")).toBe(-29);
  });

  it("answers null for anything else", () => {
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("1.2.3")).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("1,23")).toBeNull();
  });
});
