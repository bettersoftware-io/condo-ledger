import { fromCents } from "@cl/domain";
import type { Id, LedgerAccountRow } from "@cl/application";

export interface EntryDelta { accountId: Id; dareCents: number; avereCents: number; }

/** Apply deltas to leaf accounts; ancestors of changed leaves absorb the summed
 * child deltas. Unchanged subtrees are returned by reference. */
export function applyEntryDeltas(rows: LedgerAccountRow[], deltas: EntryDelta[]): LedgerAccountRow[] {
  const byAccount = new Map<Id, { dare: number; avere: number }>();
  for (const d of deltas) {
    const cur = byAccount.get(d.accountId) ?? { dare: 0, avere: 0 };
    byAccount.set(d.accountId, { dare: cur.dare + d.dareCents, avere: cur.avere + d.avereCents });
  }
  const walk = (row: LedgerAccountRow): { row: LedgerAccountRow; dareDelta: number; avereDelta: number } => {
    if (row.children?.length) {
      const results = row.children.map(walk);
      const dareDelta = results.reduce((a, r) => a + r.dareDelta, 0);
      const avereDelta = results.reduce((a, r) => a + r.avereDelta, 0);
      if (dareDelta === 0 && avereDelta === 0) return { row, dareDelta: 0, avereDelta: 0 };
      const dare = row.dare.cents + dareDelta;
      const avere = row.avere.cents + avereDelta;
      return {
        row: { ...row, children: results.map((r) => r.row), dare: fromCents(dare), avere: fromCents(avere), saldo: fromCents(dare - avere) },
        dareDelta, avereDelta,
      };
    }
    const d = byAccount.get(row.id);
    if (!d) return { row, dareDelta: 0, avereDelta: 0 };
    const dare = row.dare.cents + d.dare;
    const avere = row.avere.cents + d.avere;
    return {
      row: { ...row, dare: fromCents(dare), avere: fromCents(avere), saldo: fromCents(dare - avere) },
      dareDelta: d.dare, avereDelta: d.avere,
    };
  };
  return rows.map((r) => walk(r).row);
}
