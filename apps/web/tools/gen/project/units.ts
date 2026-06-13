import type { UnitRow } from "@cl/application";
import type { Money } from "@cl/domain";
import type { Db } from "../db.ts";
import { eur } from "../amounts.ts";

const str = (v: unknown): string | undefined =>
  v === null || v === undefined || String(v).trim() === "" ? undefined : String(v).trim();

const m = (c: number): Money => ({ cents: c });

function formatPct(raw: string | undefined): string {
  const n = parseFloat(raw ?? "100");
  if (!Number.isFinite(n)) return "100";
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

function residentName(db: Db, masterDataId: string): string {
  const p = db.by("person", "masterDataId").get(masterDataId);
  if (p) return [str(p.lastName), str(p.firstName)].filter(Boolean).join(" ");
  const c = db.by("company", "masterDataId").get(masterDataId);
  return c ? String(c.name) : `Anagrafica ${masterDataId}`;
}

function roleAbbrev(db: Db, scenarioId: string | undefined, priorityId: string | undefined): string {
  const role = db.rows("unitResidentRole").find(
    (r) => String(r.unitOwnershipScenarioId) === scenarioId && String(r.unitResidentPriorityId) === priorityId,
  );
  return role ? String(role.abbreviation) : "PR";
}

function unitTypeName(db: Db, unitTypeId: string | undefined): string | undefined {
  if (!unitTypeId) return undefined;
  const base = db.by("unitType", "id").get(unitTypeId);
  const i18n = (db.group("unitTypeI18n", "unitTypeId").get(unitTypeId) ?? []).find((r) =>
    String(r.localeCode).startsWith("it"),
  );
  return str(i18n?.translation) ?? str(base?.name);
}

function restrictionLabel(start?: string, end?: string): string | undefined {
  if (!start && !end) return undefined;
  const f = (d?: string) => (d ? d.split(" ")[0]!.split("-").reverse().join("/") : "");
  return `${f(start)} - ${f(end)}`;
}

function labelYear(db: Db, periodId: string): string {
  const p = db.rows("accountingPeriod").find((x) => String(x.id) === periodId);
  return p ? String(p.name) : periodId;
}

export function projectUnits(db: Db, periodId: string): UnitRow[] {
  const cond = db.condominiums.find((c) =>
    db.periodsOf(String(c.id)).some((p) => String(p.id) === periodId),
  );

  const units = db
    .rows("unit")
    .filter((u) => String(u.accountingPeriodId) === periodId)
    .sort((a, b) => String(a.code ?? "").localeCompare(String(b.code ?? ""), "it"));

  const upByUnit = db.group("unitPeriod", "unitId");
  const resByUnitPeriod = db.group("unitResident", "unitPeriodId");

  // Build per-resident ledger aggregates for this period
  const txInPeriod = new Set(
    db
      .rows("ledgerTransaction")
      .filter((t) => String(t.accountingPeriodId) === periodId)
      .map((t) => String(t.id)),
  );
  const byResident = new Map<string, { individualExpense: number; takings: number }>();
  for (const e of db.rows("ledgerEntry")) {
    if (!txInPeriod.has(String(e.ledgerTransactionId))) continue;
    const ur = str(e.unitResidentId);
    if (!ur) continue;
    const acc = byResident.get(ur) ?? { individualExpense: 0, takings: 0 };
    const cents = eur(str(e.amount)).cents;
    if (String(e.type) === "individualExpense") acc.individualExpense += cents;
    else if (String(e.type) === "unitResidentTakings") acc.takings += cents;
    byResident.set(ur, acc);
  }

  // Build per-resident installmentItem totals for this period
  const instInPeriod = new Set(
    db
      .rows("installment")
      .filter((i) => String(i.accountingPeriodId) === periodId)
      .map((i) => String(i.id)),
  );
  const instByResident = new Map<string, number>();
  for (const ii of db.rows("installmentItem")) {
    if (!instInPeriod.has(String(ii.installmentId))) continue;
    const ur = str(ii.unitResidentId);
    if (!ur) continue;
    instByResident.set(ur, (instByResident.get(ur) ?? 0) + eur(str(ii.amount)).cents);
  }

  const sumField = (rows: UnitRow[], k: keyof Pick<UnitRow, "saldoPrec" | "preventivo" | "consuntivo" | "totDovuto" | "versato">): Money =>
    m(rows.reduce((a, r) => a + r[k].cents, 0));

  const unitRows: UnitRow[] = units.map((u) => {
    const unitPeriods = upByUnit.get(String(u.id)) ?? [];
    const residents = unitPeriods.flatMap((up) =>
      (resByUnitPeriod.get(String(up.id)) ?? []).map((r) => ({ r, up })),
    );

    const resRows: UnitRow[] = residents.map(({ r, up }) => {
      const mdId = String(r.masterDataId);
      const name = residentName(db, mdId);
      const pct = formatPct(str(r.percentage));
      const abbr = roleAbbrev(db, str(up.unitOwnershipScenarioId), str(r.unitResidentPriorityId));
      const agg = byResident.get(String(r.id)) ?? { individualExpense: 0, takings: 0 };
      const saldoPrec = eur(str(r.startingBalance)).cents;
      const preventivo = instByResident.get(String(r.id)) ?? 0;
      const consuntivo = agg.individualExpense;
      // takings credit the resident (negative in the ledger); negate to get paid-in positive
      const versato = -agg.takings;
      return {
        id: `r${r.id}`,
        kind: "resident" as const,
        label: `${name} (${abbr} ${pct}%)`,
        saldoPrec: m(saldoPrec),
        preventivo: m(preventivo),
        consuntivo: m(consuntivo),
        totDovuto: m(saldoPrec + preventivo),
        versato: m(versato),
      };
    });

    const names = resRows
      .map((rr) => rr.label.replace(/ \(.*\)$/, ""))
      .join(", ");
    const restriction = restrictionLabel(
      str(u.periodRestrictionStartDate),
      str(u.periodRestrictionEndDate),
    );

    const unitRow: UnitRow = {
      id: `u${u.id}`,
      kind: "unit",
      label: `${str(u.code) ?? "?"} - ${names || str(u.name) || ""}`.trim(),
      unitType: unitTypeName(db, str(u.unitTypeId)),
      floor: str(u.floor) ?? "—",
      inner: str(u.innerNumber) ?? "—",
      sub: str(u.subordinateNumber) ?? "—",
      ...(restriction ? { restriction } : {}),
      saldoPrec: sumField(resRows, "saldoPrec"),
      preventivo: sumField(resRows, "preventivo"),
      consuntivo: sumField(resRows, "consuntivo"),
      totDovuto: sumField(resRows, "totDovuto"),
      versato: sumField(resRows, "versato"),
      children: resRows,
    };
    return unitRow;
  });

  const groupLabel = cond ? `${cond.name} / ${labelYear(db, periodId)}` : "Condominio";
  const group: UnitRow = {
    id: `g${periodId}`,
    kind: "group",
    label: groupLabel,
    saldoPrec: sumField(unitRows, "saldoPrec"),
    preventivo: sumField(unitRows, "preventivo"),
    consuntivo: sumField(unitRows, "consuntivo"),
    totDovuto: sumField(unitRows, "totDovuto"),
    versato: sumField(unitRows, "versato"),
    children: unitRows,
  };
  return [group];
}
