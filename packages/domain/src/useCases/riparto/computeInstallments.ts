import { allocate } from "../allocate.ts";
import { listFor, must } from "../must.ts";
import type { InstallmentPlan } from "./periodTypes.ts";

/**
 * Split each resident's total estimate across the plan's installments.
 * Even split via largest-remainder `allocate`; then apply valid overrides.
 * An override pins one cell and spreads the delta across LATER cells via the same
 * largest-remainder `allocate(delta, later)` call as the app's redistributeOverride
 * (so the per-cent placement is identical to the app). An override that would drive a
 * later cell negative is rejected (ignored) and that resident keeps the prior split.
 * Overrides for a resident are applied in installment order, each checked against the
 * running amounts. A LAST-cell override is a no-op here: the app would change the row
 * total, but this stage preserves the invariant that Σ cells per resident always equals
 * that resident's estimate.
 */
export function computeInstallments(
  estimateByResident: Map<string, number>,
  plan: InstallmentPlan,
): Map<string, Map<string, number>> {
  const ids = plan.installmentIds;
  const overridesByResident = new Map<
    string,
    { installmentId: string; cents: number }[]
  >();

  for (const o of plan.overrides) {
    listFor(overridesByResident, o.residentId).push({
      installmentId: o.installmentId,
      cents: o.cents,
    });
  }

  const out = new Map<string, Map<string, number>>();

  for (const [residentId, totalCents] of estimateByResident) {
    const cells = new Map<string, number>();

    if (ids.length === 0) {
      out.set(residentId, cells);
      continue;
    }

    // even split (residual to last)
    let amounts = allocate(
      totalCents,
      ids.map(() => {
        return 1;
      }),
    );

    // apply overrides in installment order
    const myOverrides = (overridesByResident.get(residentId) ?? [])
      .slice()
      .sort((a, b) => {
        return ids.indexOf(a.installmentId) - ids.indexOf(b.installmentId);
      });

    for (const ov of myOverrides) {
      const idx = ids.indexOf(ov.installmentId);

      if (idx < 0) {
        continue;
      }

      amounts = applyOverride(amounts, idx, ov.cents);
    }

    for (let i = 0; i < ids.length; i++) {
      cells.set(must(ids[i]), must(amounts[i]));
    }

    out.set(residentId, cells);
  }

  return out;
}

/** Pin cell `index` to `newValue`, spreading the delta across later cells.
 *  Rejects (returns the input unchanged) if any later cell would go negative. */
function applyOverride(
  cells: number[],
  index: number,
  newValue: number,
): number[] {
  if (newValue < 0) {
    return cells;
  }

  const delta = must(cells[index]) - newValue; // amount to redistribute to later cells
  const later = cells.slice(index + 1);

  if (later.length === 0) {
    return cells; // nothing to absorb the delta
  }

  const spread = allocate(
    delta,
    later.map(() => {
      return 1;
    }),
  );

  const projected = later.map((c, i) => {
    return c + must(spread[i]);
  });

  if (
    projected.some((c) => {
      return c < 0;
    })
  ) {
    return cells; // reject
  }

  const next = cells.slice();
  next[index] = newValue;

  for (let i = 0; i < projected.length; i++) {
    next[index + 1 + i] = must(projected[i]);
  }

  return next;
}
