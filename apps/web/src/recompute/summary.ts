import { fromCents } from "@cl/domain";
import type { LedgerAccountRow, PeriodSummary, UnitRow } from "@cl/application";

const zero = fromCents(0);

function findByLabel(rows: LedgerAccountRow[], re: RegExp): LedgerAccountRow | null {
  for (const r of rows) {
    if (re.test(r.label)) return r;
    if (r.children) { const hit = findByLabel(r.children, re); if (hit) return hit; }
  }
  return null;
}

/** Naive Dati-grid aggregates (replaced by @cl/domain later): money positions from the
 * account tree by label convention, dovuto/preventivo figures from the units root group. */
export function periodSummary(accounts: LedgerAccountRow[], units: UnitRow[]): PeriodSummary {
  const liquid = findByLabel(accounts, /liquidità|cassa/i);
  const fondi = findByLabel(accounts, /fond/i);
  const root = units[0] ?? null;
  return {
    liquidita: liquid?.saldo ?? zero,
    fondi: fondi?.saldo ?? zero,
    preventivo: root?.preventivo ?? zero,
    consuntivo: root?.consuntivo ?? zero,
    saldoPrec: root?.saldoPrec ?? zero,
    totDovuto: root?.totDovuto ?? zero,
  };
}
