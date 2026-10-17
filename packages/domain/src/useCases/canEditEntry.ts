import type { EntryKind, JournalEntry } from "../entities/journal.ts";
import { ok, type Result, rejected } from "../entities/result.ts";

/** The kinds a wizard of M2a or M2b writes, and so can rewrite. */
const EDITABLE_KINDS: readonly EntryKind[] = [
  "generic",
  "directPaymentCash",
  "directPaymentBank",
  "withholdingPayment",
  "invoice",
  "invoicePayment",
  "openingBalances",
];

export function canEditEntry(entry: JournalEntry): Result {
  return EDITABLE_KINDS.includes(entry.kind)
    ? ok()
    : rejected("kind-not-editable");
}
