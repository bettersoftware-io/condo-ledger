import { distinctUntilChanged, type Observable, skip } from "rxjs";

import {
  type Cents,
  cents,
  DEFAULT_PREFERENCES,
  type Language,
} from "@cl/domain";

/** The locales amounts are shown, typed and written in: one per language of the session. */
export const AMOUNT_LOCALES = [
  "en-US",
  "it-IT",
  "fr-FR",
  "de-DE",
  "es-ES",
] as const;

export type AmountLocale = (typeof AMOUNT_LOCALES)[number];

/** A locale as it stands and as it changes: the session's, or a test's subject. */
export interface AmountLocaleSource extends Observable<AmountLocale> {
  getValue: () => AmountLocale;
}

/** How a machine reads and writes the amounts, rates and percentages of its form: in the session's locale at the moment it asks. */
export interface AmountTexts {
  /** parseAmount in the locale of the moment. */
  parse: (text: string) => Cents | null;
  /** amountText in the locale of the moment. */
  text: (amount: Cents) => string;
  /** parseHundredths in the locale of the moment: a rate or a percentage. */
  parseHundredths: (text: string) => number | null;
  /** hundredthsText in the locale of the moment. */
  hundredthsText: (value: number) => string;
  /** Each new locale, once it is the one parse and text use: whatever was judged from a text is judged again. */
  changed$: Observable<AmountLocale>;
}

/** A locale's separators: the decimal one, and those a group may be marked with. */
interface Separators {
  decimal: string;
  groups: readonly string[];
}

/** France groups with a space: the narrow no-break space Intl writes, the no-break space, or the one a keyboard types. */
const SEPARATORS: Record<AmountLocale, Separators> = {
  "en-US": { decimal: ".", groups: [","] },
  "it-IT": { decimal: ",", groups: ["."] },
  "fr-FR": { decimal: ",", groups: ["\u202f", "\u00a0", " "] },
  "de-DE": { decimal: ",", groups: ["."] },
  "es-ES": { decimal: ",", groups: ["."] },
};

const LOCALES: Record<Language, AmountLocale> = {
  en: "en-US",
  it: "it-IT",
  fr: "fr-FR",
  de: "de-DE",
  es: "es-ES",
};

/** The default language's: what amounts are shown in before the session says otherwise, and wherever nothing hands down the session's. */
export const DEFAULT_AMOUNT_LOCALE: AmountLocale =
  LOCALES[DEFAULT_PREFERENCES.language];

const PATTERNS: Record<AmountLocale, RegExp> = {
  "en-US": patternOf(SEPARATORS["en-US"]),
  "it-IT": patternOf(SEPARATORS["it-IT"]),
  "fr-FR": patternOf(SEPARATORS["fr-FR"]),
  "de-DE": patternOf(SEPARATORS["de-DE"]),
  "es-ES": patternOf(SEPARATORS["es-ES"]),
};

/** The locale a language shows, types and writes amounts in. */
export function amountLocaleOf(language: Language): AmountLocale {
  return LOCALES[language];
}

/**
 * Reads an amount typed in the locale as cents: its decimal separator, up to
 * two decimals, and groups of three marked or not (`1.234,56`, `1234,56` or
 * `12` in it-IT); anything else, a group out of place or another locale's
 * decimal separator, is null. Whether the sign is allowed is the domain's call.
 */
export function parseAmount(text: string, locale: AmountLocale): Cents | null {
  const trimmed = text.trim();

  if (!PATTERNS[locale].test(trimmed)) {
    return null;
  }

  const { decimal, groups } = SEPARATORS[locale];
  let plain = trimmed;

  for (const group of groups) {
    plain = plain.replaceAll(group, "");
  }

  // `-0,00` reads as -0, which is zero; `|| 0` keeps the sign off it.
  return cents(Math.round(Number(plain.replace(decimal, ".")) * 100) || 0);
}

/** Cents as a text parseAmount reads back in the locale: its decimal separator, no groups (`1234,56` in it-IT). What a form holds for an amount it did not have typed. */
export function amountText(amount: Cents, locale: AmountLocale): string {
  const sign = amount < 0 ? "-" : "";
  const whole = Math.floor(Math.abs(amount) / 100);
  const fraction = String(Math.abs(amount) % 100).padStart(2, "0");

  return `${sign}${whole}${SEPARATORS[locale].decimal}${fraction}`;
}

/**
 * Reads a decimal number typed in the locale, a rate or a percentage, as
 * hundredths: the locale's decimal separator, up to two decimals, no groups
 * (`21,5` is 2150 in it-IT, `21.5` in en-US). Read digit by digit, so no
 * floating-point rounding comes in; a leading minus negates it, and whether
 * one is allowed is the caller's call. Anything else is null.
 */
export function parseHundredths(
  text: string,
  locale: AmountLocale,
): number | null {
  const { decimal } = SEPARATORS[locale];
  const match = new RegExp(
    `^(-?)(\\d+)(?:${escaped(decimal)}(\\d{1,2}))?$`,
    "u",
  ).exec(text.trim());

  if (match === null) {
    return null;
  }

  const [, sign, whole = "", fraction = ""] = match;
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  return sign === "-" ? 0 - value : value;
}

/** Hundredths as the text parseHundredths reads back in the locale, with no trailing zero: 2150 is `21,5` in it-IT, 2000 is `20`. What a form holds for a rate or a percentage it did not have typed. */
export function hundredthsText(value: number, locale: AmountLocale): string {
  return String(value / 100).replace(".", SEPARATORS[locale].decimal);
}

/** Parse and text in the locale `locale$` holds when they are called; `changed$` emits each new one. */
export function amountTextsIn(locale$: AmountLocaleSource): AmountTexts {
  return {
    parse: (text: string): Cents | null => {
      return parseAmount(text, locale$.getValue());
    },
    text: (amount: Cents): string => {
      return amountText(amount, locale$.getValue());
    },
    parseHundredths: (text: string): number | null => {
      return parseHundredths(text, locale$.getValue());
    },
    hundredthsText: (value: number): string => {
      return hundredthsText(value, locale$.getValue());
    },
    changed$: locale$.pipe(distinctUntilChanged(), skip(1)),
  };
}

/** A day and a month, with a four-digit year or none: `23/4/2013`, `23/04/2013`, `23/4`. */
const DATE = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/;

/** Reads `23/4/2013`, `23/04/2013`, or `23/4` in the period's year, as YYYY-MM-DD; a day the month does not have, or anything else, is null. */
export function parseDate(text: string, periodYear: number): string | null {
  const match = DATE.exec(text.trim());

  if (match === null) {
    return null;
  }

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = yearText === undefined ? periodYear : Number(yearText);

  if (month < 1 || month > 12 || day < 1 || day > daysIn(year, month)) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${twoDigits(month)}-${twoDigits(day)}`;
}

/** The days of the month: day 0 of the next month is this month's last. */
function daysIn(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

/** An amount in the locale: a sign, groups of three marked with one of its group separators or no group at all, then up to two decimals. */
function patternOf({ decimal, groups }: Separators): RegExp {
  const group = `[${groups.map(escaped).join("")}]`;
  const whole = `(?:\\d{1,3}(?:${group}\\d{3})+|\\d+)`;

  return new RegExp(`^-?${whole}(?:${escaped(decimal)}\\d{1,2})?$`, "u");
}

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
