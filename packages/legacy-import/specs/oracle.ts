import { eur } from "#/amounts.ts";
import type { Db } from "#/db.ts";

function txIdsInPeriod(db: Db, periodId: string, type?: string): Set<string> {
  return new Set(
    db
      .rows("ledgerTransaction")
      .filter((t) => {
        return (
          String(t.accountingPeriodId) === periodId &&
          (type === undefined || String(t.type) === type)
        );
      })
      .map((t) => {
        return String(t.id);
      }),
  );
}

/** Σ signed entry cents over the period's transactions (raw trial balance). */
export function rawTrialBalanceCents(db: Db, periodId: string): number {
  const tx = txIdsInPeriod(db, periodId);
  let sum = 0;

  for (const e of db.rows("ledgerEntry")) {
    if (tx.has(String(e.ledgerTransactionId))) {
      sum += eur(str(e.amount)).cents;
    }
  }

  return sum;
}

/** Count of posted entries in the period. */
export function entryCount(db: Db, periodId: string): number {
  const tx = txIdsInPeriod(db, periodId);
  let n = 0;

  for (const e of db.rows("ledgerEntry")) {
    if (tx.has(String(e.ledgerTransactionId))) {
      n++;
    }
  }

  return n;
}

/** Σ installmentItem.amount cents for the period's installments. */
export function installmentItemTotalCents(db: Db, periodId: string): number {
  const instIds = new Set(
    db
      .rows("installment")
      .filter((i) => {
        return String(i.accountingPeriodId) === periodId;
      })
      .map((i) => {
        return String(i.id);
      }),
  );
  let sum = 0;

  for (const it of db.rows("installmentItem")) {
    if (instIds.has(String(it.installmentId))) {
      sum += eur(str(it.amount)).cents;
    }
  }

  return sum;
}

function str(v: unknown): string | null {
  return v === null || v === undefined ? null : String(v);
}
