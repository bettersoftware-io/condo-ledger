import type { Observable } from "rxjs";

import type { EntryDraft, JournalEntry } from "#/entities/journal.ts";
import type { Result, ResultOf } from "#/entities/result.ts";

/** What addEntry answers with when it is done: the new entry's id. */
export interface EntryAdded {
  id: string;
}

/** A period's journal: its entries, one more, one less. The port numbers and stamps an entry; nothing above it does. */
export interface JournalPort {
  /** In number order. Errors with "missing: the period <id>" for a period the port does not have. */
  entries(periodId: string): Observable<JournalEntry[]>;
  /** Refused with validateEntry's reason; accepted with the new entry's id, numbered max + 1 and stamped now. Rejects for a period the port does not have. */
  addEntry(periodId: string, draft: EntryDraft): Promise<ResultOf<EntryAdded>>;
  /** Refused with canDeleteEntry's reason; every later entry of the period moves down one number. Rejects for an entry the port does not have. */
  deleteEntry(entryId: string): Promise<Result>;
}
