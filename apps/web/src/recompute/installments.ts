import { allocate } from "./allocate";

/** amounts[resident][installment]: total → per resident (by coefficient) → equal split per rata. */
export function distributeInstallments(
  totalCents: number, coefficients: number[], count: number,
): number[][] {
  const perResident = allocate(totalCents, coefficients);
  return perResident.map((cents) => allocate(cents, Array(count).fill(1)));
}

/** Manual override of one cell. The difference is spread over the LATER cells
 * (largest remainder), keeping the row total constant — the legacy behavior for
 * rounding adjustments. Editing the last cell simply changes the row total. */
export function redistributeOverride(cells: number[], index: number, newValue: number): number[] {
  const out = [...cells];
  const delta = out[index] - newValue;
  out[index] = newValue;
  const later = out.map((_, i) => i).filter((i) => i > index);
  if (later.length === 0 || delta === 0) return out;
  const split = allocate(delta, later.map(() => 1));
  later.forEach((cellIdx, k) => { out[cellIdx] += split[k]; });
  return out;
}
