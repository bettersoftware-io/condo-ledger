import { fromCents } from "@cl/domain";
import type { DistributionColumn, DistributionRow, DistributionTable, Id } from "@cl/application";
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

/** Cents per expense column that the largest-remainder pass had to assign:
 * total − Σ floor(total·wᵢ/W) over the group's units, using the column's owning table. */
export function roundingByColumn(dist: Dist, tables: DistributionTable[]): Record<Id, number> {
  const group = dist.rows[0];
  const units = group?.children ?? [];
  const out: Record<Id, number> = {};
  for (const col of dist.columns) {
    const table = tables.find((t) => t.id === col.tableId);
    if (!table || !group) { out[col.accountId] = 0; continue; }
    const w = new Map(table.items.map((i) => [i.unitId, i.coefficient]));
    const W = units.reduce((a, u) => a + (w.get(u.unitId ?? "") ?? 0), 0);
    const total = group.amounts[col.accountId]?.cents ?? 0;
    if (W === 0) { out[col.accountId] = 0; continue; }
    const floors = units.reduce((a, u) => a + Math.floor((total * (w.get(u.unitId ?? "") ?? 0)) / W), 0);
    out[col.accountId] = total - floors;
  }
  return out;
}
