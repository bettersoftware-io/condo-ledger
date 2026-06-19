// apps/web/src/mock/cascade.ts
import type { DistributionColumn, DistributionRow, DistributionTable, LedgerAccountRow, UnitRow } from "@cl/application";
import type { Mode, Money, PeriodState, RipartoEngine, ResidentBalance } from "@cl/domain";

type Dist = { columns: DistributionColumn[]; rows: DistributionRow[] };
const m = (cents: number): Money => ({ cents });

/** Recover a legacy id from a prefixed DTO id (la../dt../u../r..). */
const strip = (prefix: string, id: string): string => (id.startsWith(prefix) ? id.slice(prefix.length) : id);

/** Flatten an account tree to a by-DTO-id map. */
function flattenAccounts(rows: LedgerAccountRow[]): Map<string, LedgerAccountRow> {
  const out = new Map<string, LedgerAccountRow>();
  const walk = (r: LedgerAccountRow): void => {
    out.set(r.id, r);
    (r.children ?? []).forEach(walk);
  };
  rows.forEach(walk);
  return out;
}

/**
 * Assemble a live PeriodState by overriding the seeded engine input with the current
 * editable subjects. Only the editable fields change (coefficients, own estimate, own
 * actuals, paid); the static riparto structure, plan and opening stay seeded.
 * Estimate/actual are overridden per seeded key (the authoritative own-account set), so
 * grouping rows never double-count; a missing account keeps the seeded value.
 */
export function liveState(
  seeded: PeriodState,
  tables: DistributionTable[],
  accounts: LedgerAccountRow[],
  paid: Record<string, number>,
): PeriodState {
  const tableItems = tables.flatMap((t) =>
    t.items.map((it) => ({ tableId: strip("dt", t.id), unitId: strip("u", it.unitId), coefficient: it.coefficient })),
  );
  const byId = flattenAccounts(accounts);
  const estimateCentsByAccount: Record<string, number> = {};
  for (const key of Object.keys(seeded.riparto.estimateCentsByAccount)) {
    estimateCentsByAccount[key] = byId.get(`la${key}`)?.preventivo?.cents ?? seeded.riparto.estimateCentsByAccount[key]!;
  }
  const actualCentsByAccount: Record<string, number> = {};
  for (const key of Object.keys(seeded.riparto.actualCentsByAccount)) {
    actualCentsByAccount[key] = byId.get(`la${key}`)?.saldo.cents ?? seeded.riparto.actualCentsByAccount[key]!;
  }
  return {
    ...seeded,
    riparto: { ...seeded.riparto, tableItems, estimateCentsByAccount, actualCentsByAccount },
    paid,
  };
}

/** Overlay engine per-unit money onto a seeded distribution skeleton for one mode. */
export function overlayDistribution(engine: RipartoEngine, skeleton: Dist, mode: Mode): Dist {
  const overlayUnitRow = (row: DistributionRow): DistributionRow => {
    const amounts: Record<string, Money> = {};
    let total = 0;
    for (const col of skeleton.columns) {
      const cents = engine.perUnitAmount(strip("la", col.accountId), mode, strip("u", row.unitId ?? ""));
      amounts[col.accountId] = m(cents);
      total += cents;
    }
    return { ...row, amounts, total: m(total) };
  };
  const rows = skeleton.rows.map((group) => {
    if (!group.children?.length) return group;
    const children = group.children.map(overlayUnitRow);
    const amounts: Record<string, Money> = {};
    for (const col of skeleton.columns) {
      amounts[col.accountId] = m(children.reduce((s, c) => s + (c.amounts[col.accountId]?.cents ?? 0), 0));
    }
    const total = m(children.reduce((s, c) => s + c.total.cents, 0));
    return { ...group, amounts, total, children };
  });
  return { columns: skeleton.columns, rows };
}

/** Overlay engine balances (+ directly-attributed individual expenses) onto a seeded unit skeleton. */
export function overlayUnits(
  balances: ResidentBalance[],
  skeleton: UnitRow[],
  individual: Record<string, number>,
): UnitRow[] {
  const byResident = new Map(balances.map((b) => [b.residentId, b]));
  const sum = (rows: UnitRow[], k: "saldoPrec" | "preventivo" | "consuntivo" | "totDovuto" | "versato"): Money =>
    m(rows.reduce((a, r) => a + r[k].cents, 0));
  const walk = (r: UnitRow): UnitRow => {
    if (r.kind === "resident") {
      const rid = strip("r", r.id);
      const b = byResident.get(rid);
      const saldoPrec = b?.saldoPrecCents ?? 0;
      const preventivo = b?.preventivoCents ?? 0;
      const consuntivo = (b?.consuntivoCents ?? 0) + (individual[rid] ?? 0);
      const versato = b?.versatoCents ?? 0;
      return {
        ...r,
        saldoPrec: m(saldoPrec), preventivo: m(preventivo), consuntivo: m(consuntivo),
        totDovuto: m(saldoPrec + preventivo), versato: m(versato),
      };
    }
    const children = (r.children ?? []).map(walk);
    return {
      ...r, children,
      saldoPrec: sum(children, "saldoPrec"), preventivo: sum(children, "preventivo"),
      consuntivo: sum(children, "consuntivo"), totDovuto: sum(children, "totDovuto"),
      versato: sum(children, "versato"),
    };
  };
  return skeleton.map(walk);
}
