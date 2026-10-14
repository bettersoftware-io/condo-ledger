import type { Cents } from "@cl/domain";

const MONEY = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Money as en-US text with two decimals: `1,234.56`. */
export function formatCents(amount: Cents): string {
  return MONEY.format(amount / 100);
}

/** `2013-01-10T15:59:00` as `10/01/2013`. Sliced, never parsed: a timezone must not move it. */
export function formatDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** `2013-01-10T15:59:00` as `10/01/2013 15:59`. */
export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} ${iso.slice(11, 16)}`;
}
