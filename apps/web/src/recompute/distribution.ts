import { fromCents } from "@cl/domain";
import type { DistributionColumn, DistributionRow, Id } from "@cl/application";
import { allocate } from "./allocate";

type Dist = { columns: DistributionColumn[]; rows: DistributionRow[] };

/** Re-split every expense column's group total across units by new coefficients.
 * Group rows keep their totals (the expense amounts don't change — their split does). */
export function recomputeDistribution(dist: Dist, coefficientByUnit: Map<Id, number>): Dist {
  const rows = dist.rows.map((group) => {
    if (!group.children?.length) return group;
    const units = group.children;
    const weights = units.map((u) => coefficientByUnit.get(u.unitId ?? "") ?? 0);
    const amounts = units.map((u) => ({ ...u.amounts }));
    for (const col of dist.columns) {
      const total = group.amounts[col.accountId]?.cents ?? 0;
      const split = allocate(total, weights);
      split.forEach((cents, i) => { amounts[i]![col.accountId] = fromCents(cents); });
    }
    const children = units.map((u, i) => ({
      ...u,
      amounts: amounts[i]!,
      total: fromCents(dist.columns.reduce((a, col) => a + (amounts[i]![col.accountId]?.cents ?? 0), 0)),
    }));
    return { ...group, children };
  });
  return { columns: dist.columns, rows };
}
