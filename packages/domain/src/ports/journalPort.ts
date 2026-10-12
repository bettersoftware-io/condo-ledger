import type { Observable } from "rxjs";

import type { JournalEntry } from "#/entities/journal.ts";

/** A period's journal entries. */
export interface JournalPort {
  /** In number order. Errors with "missing: the period <id>" for a period the port does not have. */
  entries(periodId: string): Observable<JournalEntry[]>;
}
