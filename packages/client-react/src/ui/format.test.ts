import { describe, expect, it } from "vitest";

import { cents } from "@cl/domain";

import { formatCents, formatDate, formatDateTime } from "./format.ts";

describe("formatCents", () => {
  it("writes en-US style with two decimals", () => {
    expect(formatCents(cents(123456))).toBe("1,234.56");
    expect(formatCents(cents(-60746))).toBe("-607.46");
    expect(formatCents(cents(0))).toBe("0.00");
    expect(formatCents(cents(13788287))).toBe("137,882.87");
  });
});

describe("dates", () => {
  it("writes dd/mm/yyyy and dd/mm/yyyy hh:mm", () => {
    expect(formatDate("2013-01-10T15:59:00")).toBe("10/01/2013");
    expect(formatDateTime("2013-01-10T15:59:00")).toBe("10/01/2013 15:59");
  });
});
