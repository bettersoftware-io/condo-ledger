import { allocate } from "@cl/domain";

/** amounts[resident][installment]: total → per resident (by coefficient) → equal split per rata. */
export function distributeInstallments(
  totalCents: number, coefficients: number[], count: number,
): number[][] {
  const perResident = allocate(totalCents, coefficients);
  return perResident.map((cents) => allocate(cents, Array(count).fill(1)));
}

/** Manual override of one cell. The difference is spread over the LATER cells
 * (largest remainder), keeping the row total constant — the legacy behavior for
 * rounding adjustments. Editing the last cell simply changes the row total.
 *
 * Rejection contract: returns the original `cells` reference (unchanged) when
 * `newValue` is negative, when the edit is an identity (delta 0), or when
 * spreading the delta would drive any later cell below zero. Callers can
 * detect rejection via reference equality. */
export function redistributeOverride(cells: number[], index: number, newValue: number): number[] {
  if (newValue < 0) return cells;
  const delta = cells[index]! - newValue; // index is a valid cell index per caller contract
  if (delta === 0) return cells; // identity edit: caller treats original ref as no-op
  const out = [...cells];
  out[index] = newValue;
  const later = out.map((_, i) => i).filter((i) => i > index);
  if (later.length === 0) return out; // last-cell edit changes the row total
  const split = allocate(delta, later.map(() => 1));
  if (later.some((cellIdx, k) => out[cellIdx]! + split[k]! < 0)) return cells;
  later.forEach((cellIdx, k) => { out[cellIdx] = out[cellIdx]! + split[k]!; }); // cellIdx/k are valid indices
  return out;
}
