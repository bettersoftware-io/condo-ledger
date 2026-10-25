import type { Observable } from "rxjs";

import type { Cents } from "#/entities/cents.ts";
import type { Installment, InstallmentItem } from "#/entities/installment.ts";
import type { Result } from "#/entities/result.ts";
import type { PlannedInstallment } from "#/useCases/planInstallments.ts";
import type { InstallmentPatch } from "#/useCases/validateSchedule.ts";

/** A batch of budget installments to create: the port plans each resident's items itself. */
export interface InstallmentsDraft {
  installments: PlannedInstallment[];
  /** Items 2…n rounded to whole euros, item 1 taking the rest. */
  wholeEuros: boolean;
}

/**
 * A period's installment schedule: what each resident owes on each
 * installment. What the collections have paid on it is read from the journal,
 * and a write is judged against the journal as it stands. An installment's
 * number is its rank in the period by due date, then by id, after every
 * write. The reads emit again after an accepted write.
 */
export interface InstallmentsPort {
  /** In number order. Errors with "missing: the period <id>" for a period the port does not have. */
  installments(periodId: string): Observable<Installment[]>;
  /** The items of the period's installments. Errors as installments() does. */
  items(periodId: string): Observable<InstallmentItem[]>;
  /** Plans the batch's items with planBudgetInstallments from the period's books and schedule, and saves them with the installments. Refused with validateCreate's reason. Rejects for a period the port does not have. */
  createInstallments(
    periodId: string,
    draft: InstallmentsDraft,
  ): Promise<Result>;
  /** Refused with validateUpdate's reason. Rejects for an installment the port does not have. */
  updateInstallment(
    installmentId: string,
    patch: InstallmentPatch,
  ): Promise<Result>;
  /** Removes the installment and its items. Refused with validateDelete's reason. Rejects for an installment the port does not have. */
  deleteInstallment(installmentId: string): Promise<Result>;
  /** Refused with validateItemAmount's reason. Rejects for an item the port does not have. */
  setItemAmount(itemId: string, amount: Cents): Promise<Result>;
}
