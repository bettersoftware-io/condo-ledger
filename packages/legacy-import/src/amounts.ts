import { money, type Money } from "@cl/domain";

/** Legacy decimal string (or null) -> Money. null/empty -> 0. */
export function eur(s: string | null | undefined): Money {
  if (s === null || s === undefined || s === "") return { cents: 0 };
  return money(parseFloat(s));
}

/** Signed integer-cent amounts -> dare (Σ positives), avere (Σ |negatives|), saldo (Σ). */
export function dareAvereSaldo(centsList: number[]): { dare: number; avere: number; saldo: number } {
  let dare = 0, avere = 0, saldo = 0;
  for (const c of centsList) {
    if (c > 0) dare += c; else avere += -c;
    saldo += c;
  }
  return { dare, avere, saldo };
}
