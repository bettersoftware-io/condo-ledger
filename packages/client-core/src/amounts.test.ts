import { describe, expect, it } from "vitest";

import { cents } from "@cl/domain";

import { amountText, parseAmount, parseDate } from "./amounts.ts";

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

describe("amountText", () => {
  it("writes cents as a text parseAmount reads back", () => {
    expect(amountText(cents(2350))).toBe("23.50");
    expect(amountText(cents(123456))).toBe("1234.56");
    expect(amountText(cents(5))).toBe("0.05");
    expect(amountText(cents(0))).toBe("0.00");
    expect(amountText(cents(-759))).toBe("-7.59");
    expect(parseAmount(amountText(cents(-123456)))).toBe(-123456);
  });
});

describe("parseDate", () => {
  it("reads a day and a month, with the year or in the period's year", () => {
    expect(parseDate("23/4/2013", 2013)).toBe("2013-04-23");
    expect(parseDate("23/04/2013", 2013)).toBe("2013-04-23");
    expect(parseDate("23/4", 2013)).toBe("2013-04-23");
    expect(parseDate(" 1/12 ", 2011)).toBe("2011-12-01");
    expect(parseDate("5/1/2014", 2013)).toBe("2014-01-05");
  });

  it("knows how long each month is", () => {
    expect(parseDate("31/1/2013", 2013)).toBe("2013-01-31");
    expect(parseDate("29/2/2012", 2012)).toBe("2012-02-29");
    expect(parseDate("29/2/2013", 2013)).toBeNull();
    expect(parseDate("31/4/2013", 2013)).toBeNull();
  });

  it("answers null for a day or a month that does not exist, and for anything else", () => {
    expect(parseDate("31/2/2013", 2013)).toBeNull();
    expect(parseDate("0/4/2013", 2013)).toBeNull();
    expect(parseDate("23/13/2013", 2013)).toBeNull();
    expect(parseDate("23/0", 2013)).toBeNull();
    expect(parseDate("2013-04-23x", 2013)).toBeNull();
    expect(parseDate("2013-04-23", 2013)).toBeNull();
    expect(parseDate("23/4/13", 2013)).toBeNull();
    expect(parseDate("23/4/2013x", 2013)).toBeNull();
    expect(parseDate("", 2013)).toBeNull();
  });
});
