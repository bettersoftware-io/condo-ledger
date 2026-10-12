import { type Money, recomputePeriod } from "@cl/domain";

import type { UnitRow } from "#/seedTypes.ts";

import type { Db } from "../db.ts";
import { projectIndividual } from "./individual.ts";
import { dbToPeriodState } from "./periodState.ts";

function formatPct(raw: string | undefined): string {
  const n = parseFloat(raw ?? "100");

  if (!Number.isFinite(n)) {
    return "100";
  }

  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

function residentName(db: Db, masterDataId: string): string {
  const p = db.by("person", "masterDataId").get(masterDataId);

  if (p) {
    return [str(p.lastName), str(p.firstName)].filter(Boolean).join(" ");
  }

  const c = db.by("company", "masterDataId").get(masterDataId);
  return c ? String(c.name) : `Anagrafica ${masterDataId}`;
}

function roleAbbrev(
  db: Db,
  scenarioId: string | undefined,
  priorityId: string | undefined,
): string {
  const role = db.rows("unitResidentRole").find((r) => {
    return (
      String(r.unitOwnershipScenarioId) === scenarioId &&
      String(r.unitResidentPriorityId) === priorityId
    );
  });
  return role ? String(role.abbreviation) : "PR";
}

function unitTypeName(
  db: Db,
  unitTypeId: string | undefined,
): string | undefined {
  if (!unitTypeId) {
    return undefined;
  }

  const base = db.by("unitType", "id").get(unitTypeId);
  const i18n = (
    db.group("unitTypeI18n", "unitTypeId").get(unitTypeId) ?? []
  ).find((r) => {
    return String(r.localeCode).startsWith("it");
  });
  return str(i18n?.translation) ?? str(base?.name);
}

function restrictionLabel(start?: string, end?: string): string | undefined {
  if (!start && !end) {
    return undefined;
  }

  function f(d?: string): string {
    return d ? d.split(" ")[0]!.split("-").reverse().join("/") : "";
  }

  return `${f(start)} - ${f(end)}`;
}

function labelYear(db: Db, periodId: string): string {
  const p = db.rows("accountingPeriod").find((x) => {
    return String(x.id) === periodId;
  });
  return p ? String(p.name) : periodId;
}

export function projectUnits(db: Db, periodId: string): UnitRow[] {
  const cond = db.condominiums.find((c) => {
    return db.periodsOf(String(c.id)).some((p) => {
      return String(p.id) === periodId;
    });
  });

  const units = db
    .rows("unit")
    .filter((u) => {
      return String(u.accountingPeriodId) === periodId;
    })
    .sort((a, b) => {
      return String(a.code ?? "").localeCompare(String(b.code ?? ""), "it");
    });

  const upByUnit = db.group("unitPeriod", "unitId");
  const resByUnitPeriod = db.group("unitResident", "unitPeriodId");

  // Directly-attributed individual expenses per resident (expenses-kind entries carrying a
  // unitResidentId). Shared with the seed's individualByPeriod via projectIndividual.
  const individualByResident = projectIndividual(db, periodId);

  // Per-resident balances via the pure cascade. We use only the riparto-derived
  // preventivo/consuntivo/saldoPrec/versato; consuntivo gets the individual-expense
  // fold below and totDovuto stays saldoPrec + preventivo (generator semantics).
  const balancesById = new Map(
    recomputePeriod(dbToPeriodState(db, periodId)).balances.map((b) => {
      return [b.residentId, b];
    }),
  );

  function sumField(
    rows: UnitRow[],
    k: keyof Pick<
      UnitRow,
      "saldoPrec" | "preventivo" | "consuntivo" | "totDovuto" | "versato"
    >,
  ): Money {
    return m(
      rows.reduce((a, r) => {
        return a + r[k].cents;
      }, 0),
    );
  }

  const unitRows: UnitRow[] = units.map((u) => {
    const unitPeriods = upByUnit.get(String(u.id)) ?? [];
    const residents = unitPeriods.flatMap((up) => {
      return (resByUnitPeriod.get(String(up.id)) ?? []).map((r) => {
        return { r, up };
      });
    });

    const resRows: UnitRow[] = residents.map(({ r, up }) => {
      const mdId = String(r.masterDataId);
      const name = residentName(db, mdId);
      const pct = formatPct(str(r.percentage));
      const abbr = roleAbbrev(
        db,
        str(up.unitOwnershipScenarioId),
        str(r.unitResidentPriorityId),
      );
      const bal = balancesById.get(String(r.id));
      const saldoPrec = bal?.saldoPrecCents ?? 0;
      const preventivo = bal?.preventivoCents ?? 0;
      const consuntivo =
        (bal?.consuntivoCents ?? 0) + (individualByResident[String(r.id)] ?? 0);
      const versato = bal?.versatoCents ?? 0;
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
      .map((rr) => {
        return rr.label.replace(/ \(.*\)$/, "");
      })
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

  const groupLabel = cond
    ? `${cond.name} / ${labelYear(db, periodId)}`
    : "Condominio";

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

function str(v: unknown): string | undefined {
  return v === null || v === undefined || String(v).trim() === ""
    ? undefined
    : String(v).trim();
}

function m(c: number): Money {
  return { cents: c };
}
