import type {
  DistributionTable,
  DistributionColumn,
  DistributionRow,
  DistributionType,
} from "@cl/application";
import type { Money } from "@cl/domain";
import type { Db } from "../db.ts";
import { eur } from "../amounts.ts";

const str = (v: unknown): string | undefined =>
  v === null || v === undefined || String(v).trim() === "" ? undefined : String(v).trim();

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

interface ColMeta {
  accountId: string;
  header: string;
  tableId: string;
  estimateCents: number;
  legacyAccountId: string;
  legacyTableId: string;
}

function expenseColumns(db: Db, periodId: string): ColMeta[] {
  const accounts = db
    .rows("ledgerAccount")
    .filter((a) => String(a.accountingPeriodId) === periodId && String(a.kind) === "expenses")
    .sort((a, b) => num(a.order) - num(b.order));
  const expense = db.by("expenseLedgerAccount", "ledgerAccountId");
  const la2t = db.group("expenseLA2Table", "expenseLedgerAccountId");
  const cols: ColMeta[] = [];
  for (const a of accounts) {
    const exp = expense.get(String(a.id));
    if (!exp) continue;
    const link = (la2t.get(String(a.id)) ?? [])[0];
    if (!link) continue;
    cols.push({
      accountId: `la${a.id}`,
      header: String(a.name),
      tableId: `dt${link.distributionTableId}`,
      estimateCents: eur(str(exp.estimate)).cents,
      legacyAccountId: String(a.id),
      legacyTableId: String(link.distributionTableId),
    });
  }
  return cols;
}

export function projectDistribution(
  db: Db,
  periodId: string,
): Record<DistributionType, { columns: DistributionColumn[]; rows: DistributionRow[] }> {
  const cols = expenseColumns(db, periodId);
  const columns: DistributionColumn[] = cols.map((c) => ({
    accountId: c.accountId,
    header: c.header,
    tableId: c.tableId,
  }));

  const units = db
    .rows("unit")
    .filter((u) => String(u.accountingPeriodId) === periodId)
    .sort((a, b) => String(a.code ?? "").localeCompare(String(b.code ?? ""), "it"));

  const itemsByTable = db.group("distributionTableItem", "distributionTableId");

  const coeff = (legacyTableId: string, legacyUnitId: string): { c: number; total: number } => {
    const items = itemsByTable.get(legacyTableId) ?? [];
    const total = items.reduce((s, i) => s + num(i.coefficient), 0) || 1;
    const mine = items.find((i) => String(i.unitId) === legacyUnitId);
    return { c: mine ? num(mine.coefficient) : 0, total };
  };

  // Build unitResident -> unit mapping
  const upById = db.by("unitPeriod", "id");
  const urToUnit = new Map<string, string>();
  for (const r of db.rows("unitResident")) {
    const up = upById.get(String(r.unitPeriodId));
    if (up) urToUnit.set(String(r.id), String(up.unitId));
  }

  // Aggregate individualExpense entries per unit per account
  const txInPeriod = new Set(
    db
      .rows("ledgerTransaction")
      .filter((t) => String(t.accountingPeriodId) === periodId)
      .map((t) => String(t.id)),
  );
  const actual = new Map<string, Map<string, number>>();
  for (const e of db.rows("ledgerEntry")) {
    if (String(e.type) !== "individualExpense") continue;
    if (!txInPeriod.has(String(e.ledgerTransactionId))) continue;
    const ur = str(e.unitResidentId);
    if (!ur) continue;
    const unitId = urToUnit.get(ur);
    if (!unitId) continue;
    const acc = String(e.postingAccountId);
    const byAcc = actual.get(unitId) ?? new Map<string, number>();
    byAcc.set(acc, (byAcc.get(acc) ?? 0) + eur(str(e.amount)).cents);
    actual.set(unitId, byAcc);
  }

  const buildMatrix = (
    mode: DistributionType,
  ): { columns: DistributionColumn[]; rows: DistributionRow[] } => {
    const unitRows: DistributionRow[] = units.map((u) => {
      const legacyUnitId = String(u.id);
      const amounts: Record<string, Money> = {};
      let total = 0;
      for (const col of cols) {
        let cents = 0;
        if (mode === "estimate") {
          const { c, total: tt } = coeff(col.legacyTableId, legacyUnitId);
          cents = Math.round((col.estimateCents * c) / tt);
        } else {
          cents = actual.get(legacyUnitId)?.get(col.legacyAccountId) ?? 0;
        }
        amounts[col.accountId] = m(cents);
        total += cents;
      }
      return {
        id: `d${mode}-${u.id}`,
        kind: "unit" as const,
        unitId: `u${u.id}`,
        label: unitLabel(db, legacyUnitId),
        amounts,
        total: m(total),
      };
    });

    const groupAmounts: Record<string, Money> = {};
    for (const col of cols) {
      groupAmounts[col.accountId] = m(
        unitRows.reduce((s, r) => s + (r.amounts[col.accountId]?.cents ?? 0), 0),
      );
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
