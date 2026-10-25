import type { AmountLocale } from "@cl/client-core";
import type { Cents } from "@cl/domain";

/** One formatter per locale, made the first time the locale is shown. */
const MONEY = new Map<AmountLocale, Intl.NumberFormat>();

/**
 * Money with two decimals in the locale: `1,234.56` in en-US, `1.234,56` in
 * it-IT, de-DE and es-ES, `1 234,56` (narrow no-break spaces) in fr-FR. Every
 * group is marked, four digits too, so the amounts of a column read alike.
 */
export function formatCents(amount: Cents, locale: AmountLocale): string {
  return moneyIn(locale).format(amount / 100);
}

/** `2013-01-10T15:59:00` as `10/01/2013`. Sliced, never parsed: a timezone must not move it. */
export function formatDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** `2013-01-10T15:59:00` as `10/01/2013 15:59`. */
export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} ${iso.slice(11, 16)}`;
}

function moneyIn(locale: AmountLocale): Intl.NumberFormat {
  const known = MONEY.get(locale);

  if (known !== undefined) {
    return known;
  }

  const made = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: "always",
  });

  MONEY.set(locale, made);

  return made;
}
