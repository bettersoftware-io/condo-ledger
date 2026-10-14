import type { EntryKind, JournalEntry } from "../entities/journal.ts";
import { ok, type Result, rejected } from "../entities/result.ts";

/**
 * The kinds the Journal may delete: the ones M2a writes. The legacy delete had
 * side effects this app does not model yet (the invoice behind a registration
 * or a payment, the installments behind a collection), and the opening,
 * closing, allocation and individual-expense entries belong to flows M2b
 * builds, which loosen this list kind by kind.
 */
export const DELETABLE_KINDS: readonly EntryKind[] = [
  "generic",
  "directPaymentCash",
  "directPaymentBank",
  "withholdingPayment",
];

export function canDeleteEntry(entry: JournalEntry): Result {
  return DELETABLE_KINDS.includes(entry.kind)
    ? ok()
    : rejected("kind-not-deletable");
}
