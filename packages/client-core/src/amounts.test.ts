import { BehaviorSubject } from "rxjs";
import { describe, expect, it } from "vitest";

import { cents } from "@cl/domain";

import {
  AMOUNT_LOCALES,
  type AmountLocale,
  amountLocaleOf,
  amountText,
  amountTextsIn,
  hundredthsText,
  parseAmount,
  parseDate,
  parseHundredths,
} from "./amounts.ts";

describe("parseAmount", () => {
  it("reads en-US amounts, grouped or not, and plain numbers", () => {
    expect(parseAmount("1,234.56", "en-US")).toBe(123456);
    expect(parseAmount("1234.56", "en-US")).toBe(123456);
    expect(parseAmount("1234", "en-US")).toBe(123400);
    expect(parseAmount(" 12 ", "en-US")).toBe(1200);
    expect(parseAmount("-5", "en-US")).toBe(-500);
    expect(parseAmount("0", "en-US")).toBe(0);
    expect(parseAmount("12,345,678.90", "en-US")).toBe(1234567890);
    expect(parseAmount("-1,200.00", "en-US")).toBe(-120000);
  });

  it("rounds to the nearest cent where the binary fraction falls just short", () => {
    expect(parseAmount("0.29", "en-US")).toBe(29);
    expect(parseAmount("-0.29", "en-US")).toBe(-29);
    expect(parseAmount("0,29", "it-IT")).toBe(29);
  });

  it("answers null for anything else in en-US", () => {
    expect(parseAmount("abc", "en-US")).toBeNull();
    expect(parseAmount("1.2.3", "en-US")).toBeNull();
    expect(parseAmount("", "en-US")).toBeNull();
    expect(parseAmount("1,23", "en-US")).toBeNull();
    expect(parseAmount("1.234,56", "en-US")).toBeNull();
    expect(parseAmount("1234,56", "en-US")).toBeNull();
  });

  it.each(["it-IT", "de-DE", "es-ES"] as const)(
    "reads %s with a decimal comma and optional dot groups",
    (locale) => {
      expect(parseAmount("1.234,56", locale)).toBe(123456);
      expect(parseAmount("1234,56", locale)).toBe(123456);
      expect(parseAmount("12", locale)).toBe(1200);
      expect(parseAmount("1.234", locale)).toBe(123400);
      expect(parseAmount("-1.200,5", locale)).toBe(-120050);
      expect(parseAmount("0,00", locale)).toBe(0);
      expect(parseAmount("12.345.678,90", locale)).toBe(1234567890);
    },
  );

  it.each(["it-IT", "de-DE", "es-ES"] as const)(
    "refuses in %s a decimal point and misplaced groups",
    (locale) => {
      expect(parseAmount("1,234.56", locale)).toBeNull();
      expect(parseAmount("1234.56", locale)).toBeNull();
      expect(parseAmount("1.23", locale)).toBeNull();
      expect(parseAmount("12.34,5", locale)).toBeNull();
      expect(parseAmount("1,234", locale)).toBeNull();
      expect(parseAmount("1 234,56", locale)).toBeNull();
    },
  );

  it("reads 1.500 in it-IT as one thousand five hundred, the locale's convention, and refuses 1.5 and 1.50", () => {
    expect(parseAmount("1.500", "it-IT")).toBe(150000);
    expect(parseAmount("1.5", "it-IT")).toBeNull();
    expect(parseAmount("1.50", "it-IT")).toBeNull();
  });

  it("reads a negative zero as zero, never -0", () => {
    for (const locale of AMOUNT_LOCALES) {
      expect(parseAmount(`-${amountText(cents(0), locale)}`, locale)).toBe(0);
    }

    expect(parseAmount("-0", "en-US")).toBe(0);
    expect(parseHundredths("-0,0", "it-IT")).toBe(0);
  });

  it("reads fr-FR with a decimal comma and any of the three spaces as the group", () => {
    expect(parseAmount("1 234,56", "fr-FR")).toBe(123456);
    expect(parseAmount("1\u00a0234,56", "fr-FR")).toBe(123456);
    expect(parseAmount("1\u202f234,56", "fr-FR")).toBe(123456);
    expect(parseAmount("12\u202f345\u202f678,90", "fr-FR")).toBe(1234567890);
    expect(parseAmount("1234,56", "fr-FR")).toBe(123456);
    expect(parseAmount("-7", "fr-FR")).toBe(-700);
  });

  it("refuses in fr-FR a decimal point, a dot group, and misplaced spaces", () => {
    expect(parseAmount("1234.56", "fr-FR")).toBeNull();
    expect(parseAmount("1.234,56", "fr-FR")).toBeNull();
    expect(parseAmount("12 34,56", "fr-FR")).toBeNull();
    expect(parseAmount("1  234,56", "fr-FR")).toBeNull();
  });

  it.each(AMOUNT_LOCALES)(
    "reads back what Intl shows in %s, with every group",
    (locale) => {
      const shown = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: "always",
      });

      for (const amount of [123456, -120000, 0, 1234567890, -29]) {
        expect(parseAmount(shown.format(amount / 100), locale)).toBe(amount);
      }
    },
  );
});

describe("amountText", () => {
  it("writes cents in en-US as a text parseAmount reads back: no groups", () => {
    expect(amountText(cents(2350), "en-US")).toBe("23.50");
    expect(amountText(cents(123456), "en-US")).toBe("1234.56");
    expect(amountText(cents(5), "en-US")).toBe("0.05");
    expect(amountText(cents(0), "en-US")).toBe("0.00");
    expect(amountText(cents(-759), "en-US")).toBe("-7.59");
  });

  it("writes the locale's decimal separator and no groups", () => {
    expect(amountText(cents(123456), "it-IT")).toBe("1234,56");
    expect(amountText(cents(-123456789), "de-DE")).toBe("-1234567,89");
    expect(amountText(cents(5), "fr-FR")).toBe("0,05");
    expect(amountText(cents(0), "es-ES")).toBe("0,00");
  });

  it.each(AMOUNT_LOCALES)("is read back by parseAmount in %s", (locale) => {
    for (const amount of [-123456, 0, 5, 1234567890]) {
      expect(parseAmount(amountText(cents(amount), locale), locale)).toBe(
        amount,
      );
    }
  });
});

describe("parseHundredths", () => {
  it("reads an en-US rate or percentage with a decimal point, as hundredths", () => {
    expect(parseHundredths("21.5", "en-US")).toBe(2150);
    expect(parseHundredths(" 33.33 ", "en-US")).toBe(3333);
    expect(parseHundredths("4", "en-US")).toBe(400);
    expect(parseHundredths("0", "en-US")).toBe(0);
    expect(parseHundredths("-4", "en-US")).toBe(-400);
  });

  it("refuses in en-US a decimal comma, any group, and a third decimal", () => {
    expect(parseHundredths("21,5", "en-US")).toBeNull();
    expect(parseHundredths("1,000", "en-US")).toBeNull();
    expect(parseHundredths("21.555", "en-US")).toBeNull();
    expect(parseHundredths("", "en-US")).toBeNull();
    expect(parseHundredths("abc", "en-US")).toBeNull();
  });

  it.each(["it-IT", "fr-FR", "de-DE", "es-ES"] as const)(
    "reads %s with a decimal comma and no group",
    (locale) => {
      expect(parseHundredths("21,5", locale)).toBe(2150);
      expect(parseHundredths("33,33", locale)).toBe(3333);
      expect(parseHundredths("20", locale)).toBe(2000);
      expect(parseHundredths("21.5", locale)).toBeNull();
      expect(parseHundredths("1.000", locale)).toBeNull();
      expect(parseHundredths("1 000", locale)).toBeNull();
    },
  );
});

describe("hundredthsText", () => {
  it("writes hundredths with the locale's decimal separator, no trailing zero", () => {
    expect(hundredthsText(2150, "en-US")).toBe("21.5");
    expect(hundredthsText(2150, "it-IT")).toBe("21,5");
    expect(hundredthsText(3334, "fr-FR")).toBe("33,34");
    expect(hundredthsText(2000, "de-DE")).toBe("20");
    expect(hundredthsText(-450, "es-ES")).toBe("-4,5");
  });

  it.each(AMOUNT_LOCALES)("is read back by parseHundredths in %s", (locale) => {
    for (const value of [2150, 3333, 0, 400, 100000]) {
      expect(parseHundredths(hundredthsText(value, locale), locale)).toBe(
        value,
      );
    }
  });
});

describe("amountLocaleOf", () => {
  it("gives each language its locale", () => {
    expect(amountLocaleOf("en")).toBe("en-US");
    expect(amountLocaleOf("it")).toBe("it-IT");
    expect(amountLocaleOf("fr")).toBe("fr-FR");
    expect(amountLocaleOf("de")).toBe("de-DE");
    expect(amountLocaleOf("es")).toBe("es-ES");
  });
});

describe("amountTextsIn", () => {
  it("parses and writes in the locale as it stands, and says when it changes", () => {
    const locale$ = new BehaviorSubject<AmountLocale>("en-US");
    const texts = amountTextsIn(locale$);
    const changes: AmountLocale[] = [];
    const subscription = texts.changed$.subscribe((locale) => {
      changes.push(locale);
    });

    expect(texts.parse("1,234.56")).toBe(123456);
    expect(texts.text(cents(123456))).toBe("1234.56");

    locale$.next("it-IT");

    expect(texts.parse("1,234.56")).toBeNull();
    expect(texts.parse("1.234,56")).toBe(123456);
    expect(texts.text(cents(123456))).toBe("1234,56");
    expect(texts.parseHundredths("21,5")).toBe(2150);
    expect(texts.hundredthsText(2150)).toBe("21,5");

    locale$.next("it-IT");

    expect(changes).toEqual(["it-IT"]);
    subscription.unsubscribe();
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
