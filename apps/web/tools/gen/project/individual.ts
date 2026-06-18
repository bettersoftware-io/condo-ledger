import type { Db } from "../db.ts";
import { eur } from "../amounts.ts";

const str = (v: unknown): string | undefined =>
  v === null || v === undefined || String(v).trim() === "" ? undefined : String(v).trim();

/**
 * Per-resident directly-attributed individual expenses for a period, keyed by legacy
 * unitResidentId. These are expenses-kind ledger entries carrying a unitResidentId
 * (e.g. postal/reminder fees charged to specific residents) — NOT part of any riparto
 * linked subtree, so the generator folds them into consuntivo on top of the riparto share.
 * `recomputePeriod` does not model them, so they are seeded separately for the live app.
 */
export function projectIndividual(db: Db, periodId: string): Record<string, number> {
  const txInPeriod = new Set(
    db
      .rows("ledgerTransaction")
      .filter((t) => String(t.accountingPeriodId) === periodId)
      .map((t) => String(t.id)),
  );
  const accountKindById = new Map<string, string>(
    db.rows("ledgerAccount").map((a) => [String(a.id), String(a.kind ?? "")]),
  );
  const out: Record<string, number> = {};
  for (const e of db.rows("ledgerEntry")) {
    if (!txInPeriod.has(String(e.ledgerTransactionId))) continue;
    if (String(e.type) === "unitResidentTakings") continue;
    const ur = str(e.unitResidentId);
    if (!ur) continue;
    if (accountKindById.get(String(e.postingAccountId)) !== "expenses") continue;
    out[ur] = (out[ur] ?? 0) + eur(str(e.amount)).cents;
  }
  return out;
}
