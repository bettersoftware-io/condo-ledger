import { describe, expect, it } from "vitest";

import { cents } from "@cl/domain";

import {
  formatCents,
  formatDate,
  formatDateTime,
  parseAmount,
} from "./format.ts";

describe("formatCents", () => {
  it("writes en-US style with two decimals", () => {
    expect(formatCents(cents(123456))).toBe("1,234.56");
    expect(formatCents(cents(-60746))).toBe("-607.46");
    expect(formatCents(cents(0))).toBe("0.00");
    expect(formatCents(cents(13788287))).toBe("137,882.87");
  });
});

describe("parseAmount", () => {
  it("reads what formatCents writes, and plain numbers", () => {
    expect(parseAmount("1,234.56")).toBe(123456);
    expect(parseAmount("1234.56")).toBe(123456);
    expect(parseAmount("1234")).toBe(123400);
    expect(parseAmount(" 12 ")).toBe(1200);
    expect(parseAmount("-5")).toBe(-500);
  });

  it("answers null for anything else", () => {
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("1.2.3")).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("1,23")).toBeNull();
  });
});

describe("dates", () => {
  it("writes dd/mm/yyyy and dd/mm/yyyy hh:mm", () => {
    expect(formatDate("2013-01-10T15:59:00")).toBe("10/01/2013");
    expect(formatDateTime("2013-01-10T15:59:00")).toBe("10/01/2013 15:59");
  });
});
