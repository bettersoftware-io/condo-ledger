import type { Observable } from "rxjs";

import type { ManualDeadline } from "#/entities/deadline.ts";
import type { Added, Result, ResultOf } from "#/entities/result.ts";
import type { DeadlineDraft } from "#/useCases/calendar/validateDeadline.ts";

/**
 * The deadlines people typed in. Each write is judged by `validateDeadline`
 * and answers its verdict; the list emits again after an accepted one, and
 * not after a refused one. A write that names an id the port does not have
 * rejects.
 */
export interface CalendarPort {
  /** By date, then time (none first), then the id's number. */
  deadlines(): Observable<ManualDeadline[]>;
  /** The new deadline's id is `ce` and the number after the highest held. */
  addDeadline(draft: DeadlineDraft): Promise<ResultOf<Added>>;
  editDeadline(id: string, draft: DeadlineDraft): Promise<Result>;
  deleteDeadline(id: string): Promise<Result>;
}
