import { eur } from "./amounts.ts";
import type { Db } from "./db.ts";

export interface PeriodStatus {
  hasBooks: boolean;
  reconciles: boolean;
}

export function reconcilePeriods(db: Db): Record<string, PeriodStatus> {
  const txPeriod = new Map(
    db.rows("ledgerTransaction").map((t) => {
      return [String(t.id), String(t.accountingPeriodId)];
    }),
  );
  const sum = new Map<string, number>(); // periodId -> Σ signed cents
  const count = new Map<string, number>(); // periodId -> entry count

  for (const e of db.rows("ledgerEntry")) {
    const period = txPeriod.get(String(e.ledgerTransactionId));

    if (!period) {
      continue;
    }

    sum.set(
      period,
      (sum.get(period) ?? 0) +
        eur(e.amount == null ? null : String(e.amount)).cents,
    );
    count.set(period, (count.get(period) ?? 0) + 1);
  }

  const out: Record<string, PeriodStatus> = {};

  for (const c of db.condominiums) {
    for (const p of db.periodsOf(String(c.id))) {
      const id = String(p.id);
      const n = count.get(id) ?? 0;
      const hasBooks = n > 0;
      const reconciles = !hasBooks || Math.abs(sum.get(id) ?? 0) <= 1;
      out[id] = { hasBooks, reconciles };
    }
  }

  return out;
}
