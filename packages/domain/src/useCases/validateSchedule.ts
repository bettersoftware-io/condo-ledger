import type { Cents } from "../entities/cents.ts";
import type { Installment, InstallmentItem } from "../entities/installment.ts";
import type { JournalEntry } from "../entities/journal.ts";
import { ok, type Result, rejected } from "../entities/result.ts";
import { type ItemBalance, itemBalances } from "./installments.ts";
import type { PlannedInstallment } from "./planInstallments.ts";

/** What a schedule write is judged against: the period's schedule and books as they stand. */
export interface ScheduleContext {
  installments: Installment[];
  items: InstallmentItem[];
  entries: JournalEntry[];
  /** Whether the period holds a budget allocation entry. */
  budgetFound: boolean;
}

/** The fields of an installment an edit may change. */
export interface InstallmentPatch {
  name?: string;
  /** "YYYY-MM-DD". */
  dueDate?: string;
  locked?: boolean;
}

const WHOLE = 10_000;

/**
 * Whether a batch of budget installments may be created. The reasons are
 * checked in this order, and the first one found is answered.
 */
export function validateCreate(
  context: ScheduleContext,
  planned: PlannedInstallment[],
): Result {
  if (!context.budgetFound) {
    return rejected("no-budget-allocation");
  }

  if (planned.length === 0) {
    return rejected("no-installments");
  }

  if (
    planned.some((installment) => {
      return installment.name.trim() === "";
    })
  ) {
    return rejected("blank-name");
  }

  const taken = new Set(
    context.installments.map((installment) => {
      return installment.name.trim();
    }),
  );

  for (const installment of planned) {
    const name = installment.name.trim();

    if (taken.has(name)) {
      return rejected("name-taken");
    }

    taken.add(name);
  }

  if (
    planned.some((installment) => {
      return installment.percentage < 0;
    })
  ) {
    return rejected("negative-percentage");
  }

  const total = planned.reduce((sum, installment) => {
    return sum + installment.percentage;
  }, 0);

  return total === WHOLE ? ok() : rejected("percentages-not-100");
}

/**
 * Whether an installment may be edited: a name not blank and not another's, a
 * due date that is a day of the calendar written YYYY-MM-DD. A locked one
 * takes no new name or due date, but may be unlocked. Throws for an id the
 * context does not hold.
 */
export function validateUpdate(
  context: ScheduleContext,
  installmentId: string,
  patch: InstallmentPatch,
): Result {
  const installment = installmentOf(context, installmentId);

  if (patch.name !== undefined) {
    const name = patch.name.trim();

    if (name === "") {
      return rejected("blank-name");
    }

    const taken = context.installments.some((other) => {
      return other.id !== installmentId && other.name.trim() === name;
    });

    if (taken) {
      return rejected("name-taken");
    }
  }

  if (patch.dueDate !== undefined && !isCalendarDate(patch.dueDate)) {
    return rejected("invalid-due-date");
  }

  const changes =
    (patch.name !== undefined && patch.name !== installment.name) ||
    (patch.dueDate !== undefined && patch.dueDate !== installment.dueDate);

  return installment.locked && changes ? rejected("installment-locked") : ok();
}

/**
 * Whether an installment may be deleted: not locked, and none of its items
 * paid by a collection. Throws for an id the context does not hold.
 */
export function validateDelete(
  context: ScheduleContext,
  installmentId: string,
): Result {
  if (installmentOf(context, installmentId).locked) {
    return rejected("installment-locked");
  }

  const paid = balancesOf(context).some((balance) => {
    return balance.installment.id === installmentId && balance.paid > 0;
  });

  return paid ? rejected("installment-paid") : ok();
}

/**
 * Whether an item may be set to an amount: not negative, its installment not
 * locked, no collection naming it. Throws for an id the context does not hold.
 */
export function validateItemAmount(
  context: ScheduleContext,
  itemId: string,
  amount: Cents,
): Result {
  const balance = balancesOf(context).find((candidate) => {
    return candidate.item.id === itemId;
  });

  if (balance === undefined) {
    throw new Error(`missing: the installment item ${itemId}`);
  }

  if (amount < 0) {
    return rejected("negative-amount");
  }

  if (balance.installment.locked) {
    return rejected("installment-locked");
  }

  return balance.paid > 0 ? rejected("item-paid") : ok();
}

/** "YYYY-MM-DD" naming a day that exists: not 2011-02-30, not 2011-13-01. */
function isCalendarDate(text: string): boolean {
  const time = Date.parse(`${text}T00:00:00Z`);

  return (
    /^\d{4}-\d{2}-\d{2}$/.test(text) &&
    !Number.isNaN(time) &&
    new Date(time).toISOString().slice(0, 10) === text
  );
}

function installmentOf(
  context: ScheduleContext,
  installmentId: string,
): Installment {
  const installment = context.installments.find((candidate) => {
    return candidate.id === installmentId;
  });

  if (installment === undefined) {
    throw new Error(`missing: the installment ${installmentId}`);
  }

  return installment;
}

function balancesOf(context: ScheduleContext): ItemBalance[] {
  return itemBalances(context.items, context.installments, context.entries);
}
