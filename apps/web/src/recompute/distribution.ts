import { fromCents } from "@cl/domain";
import type { DistributionColumn, DistributionRow, Id } from "@cl/application";
import { allocate } from "./allocate";

type Dist = { columns: DistributionColumn[]; rows: DistributionRow[] };

/** Re-split the expense columns that belong to `tableId` across units by new coefficients.
 * Columns whose `tableId` differs from the supplied value (or is absent) keep their existing
 * amounts unchanged.  Group rows always keep their own totals (the expense amounts don't change
 * — only the per-unit split does).  The child `total` is re-derived by summing ALL columns,
 * mixing the newly-split amounts for owned columns with the preserved amounts for others. */
export function recomputeDistribution(dist: Dist, coefficientByUnit: Map<Id, number>, tableId: Id): Dist {
  const rows = dist.rows.map((group) => {
    if (!group.children?.length) return group;
    const units = group.children;
    const weights = units.map((u) => coefficientByUnit.get(u.unitId ?? "") ?? 0);
    const amounts = units.map((u) => ({ ...u.amounts }));
    for (const col of dist.columns) {
      if (col.tableId !== tableId) continue; // only re-split columns owned by this table
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
