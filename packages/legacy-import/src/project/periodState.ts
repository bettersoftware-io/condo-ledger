import type { PeriodState } from "@cl/domain";
import type { Db } from "../db.ts";
import { eur } from "../amounts.ts";
import { dbToRipartoInput } from "./ripartoInput.ts";

/**
 * Adapt one legacy accounting period into the pure cascade's PeriodState.
 * riparto: reuse dbToRipartoInput. plan: EMPTY — the generator keeps legacy
 * installments (projectInstallments reads installmentItem), so recomputePeriod's
 * derived installments are intentionally unused here. opening: per-resident
 * startingBalance cents. paid: per-resident versato = -(unitResidentTakings),
 * reproducing units.ts exactly so computeBalances yields identical saldoPrec/versato.
 */
export function dbToPeriodState(db: Db, periodId: string): PeriodState {
  const riparto = dbToRipartoInput(db, periodId);

  // opening: startingBalance per resident (same enumeration as dbToRipartoInput.residents)
  const upById = db.by("unitPeriod", "id");
  const opening: Record<string, number> = {};

  for (const r of db.rows("unitResident")) {
    const up = upById.get(String(r.unitPeriodId));
    if (!up) continue;
    opening[String(r.id)] = eur(str(r.startingBalance) ?? null).cents;
  }

  // paid: versato = -(takings) per resident, from this period's ledger entries
  const txInPeriod = new Set(
    db
      .rows("ledgerTransaction")
      .filter((t) => {return String(t.accountingPeriodId) === periodId})
      .map((t) => {return String(t.id)}),
  );
  const takingsByResident = new Map<string, number>();

  for (const e of db.rows("ledgerEntry")) {
    if (!txInPeriod.has(String(e.ledgerTransactionId))) continue;
    if (String(e.type) !== "unitResidentTakings") continue;
    const ur = str(e.unitResidentId);
    if (!ur) continue;
    takingsByResident.set(ur, (takingsByResident.get(ur) ?? 0) + eur(str(e.amount)).cents);
  }

  const paid: Record<string, number> = {};
  for (const [ur, cents] of takingsByResident) paid[ur] = -cents;

  return { riparto, plan: { installmentIds: [], overrides: [] }, opening, paid };
}

function str(v: unknown): string | undefined {
  return v === null || v === undefined || String(v).trim() === "" ? undefined : String(v).trim();
}
