import { allocate } from "../allocate";
import type { InstallmentPlan } from "./periodTypes";

/**
 * Split each resident's total estimate across the plan's installments.
 * Even split via largest-remainder `allocate`; then apply valid overrides.
 * An override pins one cell and spreads the delta across LATER cells (residual-to-last,
 * same rule as the app's redistributeOverride). An override that would drive a later cell
 * negative is rejected (ignored) and that resident keeps the even split.
 * Σ cells per resident always equals that resident's estimate.
 */
export function computeInstallments(
  estimateByResident: Map<string, number>,
  plan: InstallmentPlan,
): Map<string, Map<string, number>> {
  const ids = plan.installmentIds;
  const overridesByResident = new Map<string, { installmentId: string; cents: number }[]>();
  for (const o of plan.overrides) {
    (overridesByResident.get(o.residentId) ?? overridesByResident.set(o.residentId, []).get(o.residentId)!)
      .push({ installmentId: o.installmentId, cents: o.cents });
  }

  const out = new Map<string, Map<string, number>>();
  for (const [residentId, totalCents] of estimateByResident) {
    const cells = new Map<string, number>();
    if (ids.length === 0) {
      out.set(residentId, cells);
      continue;
    }
    // even split (residual to last)
    let amounts = allocate(totalCents, ids.map(() => 1));
    // apply overrides in installment order
    const myOverrides = (overridesByResident.get(residentId) ?? [])
      .slice()
      .sort((a, b) => ids.indexOf(a.installmentId) - ids.indexOf(b.installmentId));
    for (const ov of myOverrides) {
      const idx = ids.indexOf(ov.installmentId);
      if (idx < 0) continue;
      amounts = applyOverride(amounts, idx, ov.cents);
    }
    for (let i = 0; i < ids.length; i++) cells.set(ids[i]!, amounts[i]!);
    out.set(residentId, cells);
  }
  return out;
}

/** Pin cell `index` to `newValue`, spreading the delta across later cells.
 *  Rejects (returns the input unchanged) if any later cell would go negative. */
function applyOverride(cells: number[], index: number, newValue: number): number[] {
  if (newValue < 0) return cells;
  const delta = cells[index]! - newValue; // amount to redistribute to later cells
  const later = cells.slice(index + 1);
  if (later.length === 0) return cells; // nothing to absorb the delta
  const spread = allocate(delta, later.map(() => 1));
  const projected = later.map((c, i) => c + spread[i]!);
  if (projected.some((c) => c < 0)) return cells; // reject
  const next = cells.slice();
  next[index] = newValue;
  for (let i = 0; i < projected.length; i++) next[index + 1 + i] = projected[i]!;
  return next;
}
