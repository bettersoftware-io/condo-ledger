import { type Cents, cents } from "@cl/domain";

const AMOUNT = /^-?\d{1,3}(,\d{3})*(\.\d{1,2})?$|^-?\d+(\.\d{1,2})?$/;

/** A day and a month, with a four-digit year or none: `23/4/2013`, `23/04/2013`, `23/4`. */
const DATE = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/;

/** Reads `1,234.56`, `1234.56` or `1234` as cents; anything else is null. Whether the sign is allowed is the domain's call. */
export function parseAmount(text: string): Cents | null {
  const trimmed = text.trim();

  if (!AMOUNT.test(trimmed)) {
    return null;
  }

  return cents(Math.round(Number(trimmed.replaceAll(",", "")) * 100));
}

/** Cents as a text parseAmount reads back: `1234.56`, no grouping. What a form holds for an amount it did not have typed. */
export function amountText(amount: Cents): string {
  const sign = amount < 0 ? "-" : "";
  const whole = Math.floor(Math.abs(amount) / 100);
  const fraction = String(Math.abs(amount) % 100).padStart(2, "0");

  return `${sign}${whole}.${fraction}`;
}

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
