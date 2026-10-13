import { type Money, type RipartoMode, recomputePeriod } from "@cl/domain";

import type {
  DistributionColumn,
  DistributionRow,
  DistributionTable,
  DistributionType,
} from "#/seedTypes.ts";

import type { Db } from "../db.ts";
import { dbToPeriodState } from "./periodState.ts";

function unitLabel(db: Db, unitId: string): string {
  const u = db.by("unit", "id").get(unitId);
  return u ? String(u.code ?? u.name ?? unitId) : unitId;
}

export function projectDistributionTables(
  db: Db,
  periodId: string,
): DistributionTable[] {
  const tables = db
    .rows("distributionTable")
    .filter((t) => {
      return String(t.accountingPeriodId) === periodId;
    })
    .sort((a, b) => {
      return num(a.order) - num(b.order);
    });
  const itemsByTable = db.group("distributionTableItem", "distributionTableId");
  return tables.map((t) => {
    const items = (itemsByTable.get(String(t.id)) ?? []).map((it) => {
      return {
        unitId: `u${it.unitId}`,
        unitLabel: unitLabel(db, String(it.unitId)),
        coefficient: num(it.coefficient),
        competenza: "intero",
      };
    });

    const total = Math.round(
      items.reduce((s, i) => {
        return s + i.coefficient;
      }, 0),
    );
    return {
      id: `dt${t.id}`,
      name: String(t.name),
      restriction: null,
      total,
      items,
    };
  });
}

/** One riparto matrix: its columns and its rows (the group row first). */
export interface DistributionMatrix {
  columns: DistributionColumn[];
  rows: DistributionRow[];
}

export function projectDistribution(
  db: Db,
  periodId: string,
): Record<DistributionType, DistributionMatrix> {
  const eng = recomputePeriod(dbToPeriodState(db, periodId)).riparto;

  const columns: DistributionColumn[] = eng.columns.map((c) => {
    return {
      accountId: `la${c.legacyAccountId}`,
      header: c.name,
      tableId: `dt${c.displayTableId}`,
    };
  });

  function buildMatrix(mode: DistributionType): DistributionMatrix {
    const engMode: RipartoMode = mode === "estimate" ? "estimate" : "current";

    const unitRows: DistributionRow[] = eng.unitLegacyIds.map(
      (legacyUnitId) => {
        const amounts: Record<string, Money> = {};
        let total = 0;

        for (const col of eng.columns) {
          const cents = eng.perUnitAmount(
            col.legacyAccountId,
            engMode,
            legacyUnitId,
          );
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
      },
    );

    const groupAmounts: Record<string, Money> = {};

    for (const col of eng.columns) {
      const key = `la${col.legacyAccountId}`;
      groupAmounts[key] = m(
        unitRows.reduce((s, r) => {
          return s + (r.amounts[key]?.cents ?? 0);
        }, 0),
      );
    }

    const groupTotal = unitRows.reduce((s, r) => {
      return s + r.total.cents;
    }, 0);

    const group: DistributionRow = {
      id: `d${mode}-g`,
      kind: "group",
      label: "Totale",
      amounts: groupAmounts,
      total: m(groupTotal),
      children: unitRows,
    };
    return { columns, rows: [group] };
  }

  return { estimate: buildMatrix("estimate"), current: buildMatrix("current") };
}

function m(c: number): Money {
  return { cents: c };
}

function num(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}
