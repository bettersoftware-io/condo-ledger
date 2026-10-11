import type { Db } from "#/db.ts";
import { eur } from "#/amounts.ts";

const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

function txIdsInPeriod(db: Db, periodId: string, type?: string): Set<string> {
  return new Set(
    db.rows("ledgerTransaction")
      .filter((t) => String(t.accountingPeriodId) === periodId && (type === undefined || String(t.type) === type))
      .map((t) => String(t.id)),
  );
}

/** Σ signed entry cents over the period's transactions (raw trial balance). */
export function rawTrialBalanceCents(db: Db, periodId: string): number {
  const tx = txIdsInPeriod(db, periodId);
  let sum = 0;
  for (const e of db.rows("ledgerEntry")) if (tx.has(String(e.ledgerTransactionId))) sum += eur(str(e.amount)).cents;
  return sum;
}

/** Count of posted entries in the period. */
export function entryCount(db: Db, periodId: string): number {
  const tx = txIdsInPeriod(db, periodId);
  let n = 0;
  for (const e of db.rows("ledgerEntry")) if (tx.has(String(e.ledgerTransactionId))) n++;
  return n;
}

/** Per-resident preventivo as the LEGACY posted it (estimateDistribution entries). Map<unitResidentId, cents>. */
export function estimateDistributionByResident(db: Db, periodId: string): Map<string, number> {
  const tx = txIdsInPeriod(db, periodId, "estimateDistribution");
  const m = new Map<string, number>();
  for (const e of db.rows("ledgerEntry")) {
    if (!tx.has(String(e.ledgerTransactionId))) continue;
    const ur = str(e.unitResidentId);
    if (!ur) continue;
    m.set(ur, (m.get(ur) ?? 0) + eur(str(e.amount)).cents);
  }
  return m;
}

/** unitResident.startingBalance per resident (legacy stored), for residents in this period. */
export function startingBalanceByResident(db: Db, periodId: string): Map<string, number> {
  const unitIds = new Set(db.rows("unit").filter((u) => String(u.accountingPeriodId) === periodId).map((u) => String(u.id)));
  const upIds = new Set(db.rows("unitPeriod").filter((up) => unitIds.has(String(up.unitId))).map((up) => String(up.id)));
  const m = new Map<string, number>();
  for (const r of db.rows("unitResident")) {
    if (!upIds.has(String(r.unitPeriodId))) continue;
    m.set(String(r.id), eur(str(r.startingBalance)).cents);
  }
  return m;
}

/** Σ installmentItem.amount cents for the period's installments. */
export function installmentItemTotalCents(db: Db, periodId: string): number {
  const instIds = new Set(db.rows("installment").filter((i) => String(i.accountingPeriodId) === periodId).map((i) => String(i.id)));
  let sum = 0;
  for (const it of db.rows("installmentItem")) if (instIds.has(String(it.installmentId))) sum += eur(str(it.amount)).cents;
  return sum;
}
