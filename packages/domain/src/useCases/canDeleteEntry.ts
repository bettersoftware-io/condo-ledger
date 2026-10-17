import type { EntryKind, JournalEntry } from "../entities/journal.ts";
import { ok, type Result, rejected } from "../entities/result.ts";

/**
 * The kinds the Journal may delete: the ones M2a and M2b write. The legacy
 * delete of a collection had side effects this app does not model yet (the
 * installments behind it), and the closing, allocation and individual-expense
 * entries belong to flows not built yet.
 */
export const DELETABLE_KINDS: readonly EntryKind[] = [
  "generic",
  "directPaymentCash",
  "directPaymentBank",
  "withholdingPayment",
  "invoice",
  "invoicePayment",
  "openingBalances",
];

/** Whether the entry may go from these, its period's entries: a registration only while no payment names its invoice. */
export function canDeleteEntry(
  entry: JournalEntry,
  entries: JournalEntry[],
): Result {
  if (!DELETABLE_KINDS.includes(entry.kind)) {
    return rejected("kind-not-deletable");
  }

  const paid =
    entry.kind === "invoice" &&
    entry.invoiceId !== null &&
    entries.some((candidate) => {
      return (
        candidate.kind === "invoicePayment" &&
        candidate.invoiceId === entry.invoiceId
      );
    });

  return paid ? rejected("invoice-has-payments") : ok();
}
