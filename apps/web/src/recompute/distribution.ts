import type { DistributionColumn, DistributionRow, DistributionTable, Id } from "@cl/application";

type Dist = { columns: DistributionColumn[]; rows: DistributionRow[] };

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
