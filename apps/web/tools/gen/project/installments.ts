import type { InstallmentColumn, InstallmentRow } from "@cl/application";
import type { Money } from "@cl/domain";
import type { Db } from "../db.ts";
import { eur } from "../amounts.ts";

const str = (v: unknown): string | undefined =>
  v === null || v === undefined || String(v).trim() === "" ? undefined : String(v).trim();

const m = (c: number): Money => ({ cents: c });

function residentName(db: Db, mdId: string): string {
  const p = db.by("person", "masterDataId").get(mdId);
  if (p) return [str(p.lastName), str(p.firstName)].filter(Boolean).join(" ");
  const c = db.by("company", "masterDataId").get(mdId);
  return c ? String(c.name) : `Anagrafica ${mdId}`;
}

function roleName(db: Db, scenarioId: string | undefined, priorityId: string | undefined): string | undefined {
  const role = db.rows("unitResidentRole").find(
    (r) => String(r.unitOwnershipScenarioId) === scenarioId && String(r.unitResidentPriorityId) === priorityId,
  );
  return role ? String(role.name) : undefined;
}

function labelYear(db: Db, periodId: string): string {
  const p = db.rows("accountingPeriod").find((x) => String(x.id) === periodId);
  return p ? String(p.name) : periodId;
}

export function projectInstallments(
  db: Db,
  periodId: string,
): { columns: InstallmentColumn[]; rows: InstallmentRow[] } {
  const installments = db
    .rows("installment")
    .filter((i) => String(i.accountingPeriodId) === periodId)
    .sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate)));

  const columns: InstallmentColumn[] = installments.map((i) => ({
    id: `inst${i.id}`,
    header: String(i.name),
    expiry: String(i.expiryDate),
  }));

  if (columns.length === 0) return { columns: [], rows: [] };

  // Build per-resident installment amounts: urId -> colId -> cents
  const instIds = new Set(installments.map((i) => String(i.id)));
  const itemsByResident = new Map<string, Map<string, number>>();
  for (const it of db.rows("installmentItem")) {
    if (!instIds.has(String(it.installmentId))) continue;
    const ur = str(it.unitResidentId);
    if (!ur) continue;
    const byInst = itemsByResident.get(ur) ?? new Map<string, number>();
    byInst.set(`inst${String(it.installmentId)}`, eur(str(it.amount)).cents);
    itemsByResident.set(ur, byInst);
  }

  const blank = (): Record<string, Money> =>
    Object.fromEntries(columns.map((c) => [c.id, m(0)]));

  const sumRows = (
    rows: InstallmentRow[],
  ): { byInstallment: Record<string, Money>; saldoPrec: Money; totPreventivo: Money; totDovuto: Money } => {
    const byInstallment = blank();
    let saldoPrec = 0;
    let totPreventivo = 0;
    let totDovuto = 0;
    for (const r of rows) {
      for (const c of columns) {
        const curr = byInstallment[c.id];
        const add = r.byInstallment[c.id];
        byInstallment[c.id] = m((curr?.cents ?? 0) + (add?.cents ?? 0));
      }
      saldoPrec += r.saldoPrec.cents;
      totPreventivo += r.totPreventivo.cents;
      totDovuto += r.totDovuto.cents;
    }
    return { byInstallment, saldoPrec: m(saldoPrec), totPreventivo: m(totPreventivo), totDovuto: m(totDovuto) };
  };

  const units = db
    .rows("unit")
    .filter((u) => String(u.accountingPeriodId) === periodId)
    .sort((a, b) => String(a.code ?? "").localeCompare(String(b.code ?? ""), "it"));

  const upByUnit = db.group("unitPeriod", "unitId");
  const resByUp = db.group("unitResident", "unitPeriodId");

  const unitRows: InstallmentRow[] = units.map((u) => {
    const ups = upByUnit.get(String(u.id)) ?? [];

    const resRows: InstallmentRow[] = ups.flatMap((up) =>
      (resByUp.get(String(up.id)) ?? []).map((r) => {
        const byInstallment = blank();
        const mine = itemsByResident.get(String(r.id));
        if (mine) {
          for (const [colId, cents] of mine) {
            byInstallment[colId] = m(cents);
          }
        }
        const totPreventivo = Object.values(byInstallment).reduce((s, x) => s + x.cents, 0);
        const saldoPrec = eur(str(r.startingBalance)).cents;
        const resRow: InstallmentRow = {
          id: `ir${r.id}`,
          kind: "resident",
          unitId: `u${u.id}`,
          label: residentName(db, String(r.masterDataId)),
          role: roleName(db, str(up.unitOwnershipScenarioId), str(r.unitResidentPriorityId)),
          saldoPrec: m(saldoPrec),
          totPreventivo: m(totPreventivo),
          totDovuto: m(saldoPrec + totPreventivo),
          byInstallment,
        };
        return resRow;
      }),
    );

    const agg = sumRows(resRows);
    const unitRow: InstallmentRow = {
      id: `iu${u.id}`,
      kind: "unit",
      unitId: `u${u.id}`,
      label: str(u.code) ?? "?",
      ...agg,
      children: resRows, // residents nested unconditionally (uniform group→unit→resident shape)
    };
    return unitRow;
  });

  const groupAgg = sumRows(unitRows);
  const group: InstallmentRow = {
    id: `ig${periodId}`,
    kind: "group",
    label: labelYear(db, periodId),
    ...groupAgg,
    children: unitRows,
  };

  return { columns, rows: [group] };
}
