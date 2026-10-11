import type {
  DistributionTable,
  DistributionColumn,
  DistributionRow,
  DistributionType,
} from "#/seedTypes.ts";
import { recomputePeriod, type Mode, type Money } from "@cl/domain";
import type { Db } from "../db.ts";
import { dbToPeriodState } from "./periodState.ts";

const m = (c: number): Money => ({ cents: c });
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

function unitLabel(db: Db, unitId: string): string {
  const u = db.by("unit", "id").get(unitId);
  return u ? String(u.code ?? u.name ?? unitId) : unitId;
}

export function projectDistributionTables(db: Db, periodId: string): DistributionTable[] {
  const tables = db
    .rows("distributionTable")
    .filter((t) => String(t.accountingPeriodId) === periodId)
    .sort((a, b) => num(a.order) - num(b.order));
  const itemsByTable = db.group("distributionTableItem", "distributionTableId");
  return tables.map((t) => {
    const items = (itemsByTable.get(String(t.id)) ?? []).map((it) => ({
      unitId: `u${it.unitId}`,
      unitLabel: unitLabel(db, String(it.unitId)),
      coefficient: num(it.coefficient),
      competenza: "intero",
    }));
    const total = Math.round(items.reduce((s, i) => s + i.coefficient, 0));
    return { id: `dt${t.id}`, name: String(t.name), restriction: null, total, items };
  });
}

export function projectDistribution(
  db: Db,
  periodId: string,
): Record<DistributionType, { columns: DistributionColumn[]; rows: DistributionRow[] }> {
  const eng = recomputePeriod(dbToPeriodState(db, periodId)).riparto;

  const columns: DistributionColumn[] = eng.columns.map((c) => ({
    accountId: `la${c.legacyAccountId}`,
    header: c.name,
    tableId: `dt${c.displayTableId}`,
  }));

  const buildMatrix = (
    mode: DistributionType,
  ): { columns: DistributionColumn[]; rows: DistributionRow[] } => {
    const engMode: Mode = mode === "estimate" ? "estimate" : "current";

    const unitRows: DistributionRow[] = eng.unitLegacyIds.map((legacyUnitId) => {
      const amounts: Record<string, Money> = {};
      let total = 0;
      for (const col of eng.columns) {
        const cents = eng.perUnitAmount(col.legacyAccountId, engMode, legacyUnitId);
        amounts[`la${col.legacyAccountId}`] = m(cents);
        total += cents;
      }
      return {
        id: `d${mode}-${legacyUnitId}`,
        kind: "unit" as const,
        unitId: `u${legacyUnitId}`,
        label: unitLabel(db, legacyUnitId),
        amounts,
        total: m(total),
      };
    });

    const groupAmounts: Record<string, Money> = {};
    for (const col of eng.columns) {
      const key = `la${col.legacyAccountId}`;
      groupAmounts[key] = m(unitRows.reduce((s, r) => s + (r.amounts[key]?.cents ?? 0), 0));
    }
    const groupTotal = unitRows.reduce((s, r) => s + r.total.cents, 0);
    const group: DistributionRow = {
      id: `d${mode}-g`,
      kind: "group",
      label: "Totale",
      amounts: groupAmounts,
      total: m(groupTotal),
      children: unitRows,
    };
    return { columns, rows: [group] };
  };

  return { estimate: buildMatrix("estimate"), current: buildMatrix("current") };
}
