import { fromCents, type Money } from "@cl/domain";
import type { Id, LedgerTxnRow } from "@cl/application";

export interface MastrinoRow {
  id: string; date: string; code: number; description: string;
  dare: Money; avere: Money; saldo: Money;
}

/** The selected account's ledger card: its entries across all transactions, date-ordered, with running saldo. */
export function mastrino(txns: LedgerTxnRow[], accountId: Id): MastrinoRow[] {
  const hits = txns
    .flatMap((t) => t.entries
      .filter((e) => e.accountId === accountId)
      .map((e, i) => ({ id: `${t.id}-m${i}`, date: t.date, code: t.code, description: t.description, dare: e.dare, avere: e.avere })))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.code - b.code));
  let run = 0;
  return hits.map((h) => { run += h.dare.cents - h.avere.cents; return { ...h, saldo: fromCents(run) }; });
}
