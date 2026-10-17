import type { Observable } from "rxjs";

import type { Invoice } from "#/entities/invoice.ts";
import type { EntryDraft, JournalEntry } from "#/entities/journal.ts";
import type { Result, ResultOf } from "#/entities/result.ts";

/** What addEntry answers with when it is done: the new entry's id. */
export interface EntryAdded {
  id: string;
}

/**
 * A period's journal and the invoices its registrations wrote: an entry more,
 * one less, one rewritten. The port numbers and stamps an entry; nothing
 * above it does. A registration and its invoice are written together.
 */
export interface JournalPort {
  /** In number order. Errors with "missing: the period <id>" for a period the port does not have. */
  entries(periodId: string): Observable<JournalEntry[]>;
  /** The period's invoices, registered and paid or not. Errors as entries() does. */
  invoices(periodId: string): Observable<Invoice[]>;
  /** Refused with validateEntry's reason; accepted with the new entry's id, numbered max + 1 and stamped now. A registration creates its invoice, which the entry names. Rejects for a period the port does not have. */
  addEntry(periodId: string, draft: EntryDraft): Promise<ResultOf<EntryAdded>>;
  /** Rewrites an entry in place: same id, number and stamp; a registration's invoice takes the draft's terms. Refused with canEditEntry's reason, `kind-changed` when the draft's kind differs, or validateEntry's reason judged with the entry itself left out. Rejects for an entry the port does not have. */
  replaceEntry(entryId: string, draft: EntryDraft): Promise<Result>;
  /** Refused with canDeleteEntry's reason; a registration takes its invoice with it, and every later entry of the period moves down one number. Rejects for an entry the port does not have. */
  deleteEntry(entryId: string): Promise<Result>;
}
