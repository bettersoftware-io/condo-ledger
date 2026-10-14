import { type Cents, cents } from "@cl/domain";

const AMOUNT = /^-?\d{1,3}(,\d{3})*(\.\d{1,2})?$|^-?\d+(\.\d{1,2})?$/;

/** Reads `1,234.56`, `1234.56` or `1234` as cents; anything else is null. Whether the sign is allowed is the domain's call. */
export function parseAmount(text: string): Cents | null {
  const trimmed = text.trim();

  if (!AMOUNT.test(trimmed)) {
    return null;
  }

  return cents(Math.round(Number(trimmed.replaceAll(",", "")) * 100));
}
