import { describe, expect, it } from "vitest";

import { cents } from "@cl/domain";

import {
  formatCents,
  formatCoefficient,
  formatDate,
  formatDateTime,
  formatShare,
} from "./format.ts";

describe("formatCents", () => {
  it("writes en-US style with two decimals", () => {
    expect(formatCents(cents(123456), "en-US")).toBe("1,234.56");
    expect(formatCents(cents(-60746), "en-US")).toBe("-607.46");
    expect(formatCents(cents(0), "en-US")).toBe("0.00");
    expect(formatCents(cents(13788287), "en-US")).toBe("137,882.87");
  });

  it("writes it-IT and de-DE with dot groups and a decimal comma, four digits grouped too", () => {
    for (const locale of ["it-IT", "de-DE"] as const) {
      expect(formatCents(cents(123456), locale)).toBe("1.234,56");
      expect(formatCents(cents(-120000), locale)).toBe("-1.200,00");
      expect(formatCents(cents(0), locale)).toBe("0,00");
      expect(formatCents(cents(1234567890), locale)).toBe("12.345.678,90");
    }
  });

  it("writes es-ES grouping four digits as well, as the other locales of a column do", () => {
    expect(formatCents(cents(123456), "es-ES")).toBe("1.234,56");
    expect(formatCents(cents(-60746), "es-ES")).toBe("-607,46");
    expect(formatCents(cents(1234567890), "es-ES")).toBe("12.345.678,90");
  });

  it("writes fr-FR with narrow no-break spaces between groups and a decimal comma", () => {
    expect(formatCents(cents(123456), "fr-FR")).toBe("1\u202f234,56");
    expect(formatCents(cents(-1234567890), "fr-FR")).toBe(
      "-12\u202f345\u202f678,90",
    );
    expect(formatCents(cents(0), "fr-FR")).toBe("0,00");
  });
});

describe("dates", () => {
  it("writes dd/mm/yyyy and dd/mm/yyyy hh:mm", () => {
    expect(formatDate("2013-01-10T15:59:00")).toBe("10/01/2013");
    expect(formatDateTime("2013-01-10T15:59:00")).toBe("10/01/2013 15:59");
  });
});

describe("formatCoefficient", () => {
  it("writes six decimals in the locale", () => {
    expect(formatCoefficient(0.0493150684, "en-US")).toBe("0.049315");
    expect(formatCoefficient(0.950685, "it-IT")).toBe("0,950685");
    expect(formatCoefficient(1, "en-US")).toBe("1.000000");
    expect(formatCoefficient(0, "fr-FR")).toBe("0,000000");
  });
});

describe("formatShare", () => {
  it("writes a share held in ten-thousandths of a percent as a percentage, up to four decimals", () => {
    expect(formatShare(1000000, "en-US")).toBe("100%");
    expect(formatShare(500000, "en-US")).toBe("50%");
    expect(formatShare(333333, "en-US")).toBe("33.3333%");
    expect(formatShare(125000, "it-IT")).toBe("12,5%");
  });
});
