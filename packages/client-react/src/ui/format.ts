import { type Cents, cents } from "@cl/domain";

const AMOUNT = /^-?\d{1,3}(,\d{3})*(\.\d{1,2})?$|^-?\d+(\.\d{1,2})?$/;

const MONEY = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Money as en-US text with two decimals: `1,234.56`. */
export function formatCents(amount: Cents): string {
  return MONEY.format(amount / 100);
}

/** Reads `1,234.56`, `1234.56` or `1234` as cents; anything else is null. Whether the sign is allowed is the domain's call. */
export function parseAmount(text: string): Cents | null {
  const trimmed = text.trim();

  if (!AMOUNT.test(trimmed)) {
    return null;
  }

  return cents(Math.round(Number(trimmed.replaceAll(",", "")) * 100));
}

/** `2013-01-10T15:59:00` as `10/01/2013`. Sliced, never parsed: a timezone must not move it. */
export function formatDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** `2013-01-10T15:59:00` as `10/01/2013 15:59`. */
export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} ${iso.slice(11, 16)}`;
}
