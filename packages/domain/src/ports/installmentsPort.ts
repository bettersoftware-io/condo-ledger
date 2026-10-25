import type { Observable } from "rxjs";

import type { Installment, InstallmentItem } from "#/entities/installment.ts";

/**
 * A period's installment schedule, read only: what each resident owes on each
 * installment. What the collections have paid on it is read from the journal.
 */
export interface InstallmentsPort {
  /** Errors with "missing: the period <id>" for a period the port does not have. */
  installments(periodId: string): Observable<Installment[]>;
  /** The items of the period's installments. Errors as installments() does. */
  items(periodId: string): Observable<InstallmentItem[]>;
}
