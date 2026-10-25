import {
  addCents,
  budgetSharesOf,
  type Cents,
  defaultPercentages,
  dueDates,
  type InstallmentsDraft,
  isCalendarDate,
  type OwnerParty,
  ok,
  type PlannedInstallment,
  planBudgetInstallments,
  planInputOf,
  type Result,
  rejected,
  validateCreate,
  ZERO_CENTS,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import type { Books } from "#/presenters/booksPresenter.ts";
import { scheduleContextOf } from "#/presenters/installmentSchedulePresenter.ts";

import {
  createWizardMachine,
  type Derived,
  refused,
  type WizardMachine,
} from "./wizard.ts";

/** One new installment as step 2 shows it: its due date is derived from step 1. */
export interface InstallmentRowForm {
  name: string;
  /** Of the budget, en-US with up to two decimals: "33.33". */
  percentage: string;
}

/** What the person types for a batch of budget installments: the numbers as text, read in core. */
export interface BudgetInstallmentsForm {
  /** "Number of installments", 1–12. */
  count: string;
  /** "Due date of the first", "YYYY-MM-DD". */
  firstDue: string;
  /** "Months between installments", 1–5. */
  months: string;
  wholeEuros: boolean;
  /** One per installment: they follow the number. */
  rows: InstallmentRowForm[];
}

/** One resident in step 3's review. */
export interface ReviewRow {
  residentId: string;
  /** "{unit} {name}". */
  label: string;
  /** Total budget: the budget allocation entry's share. */
  budget: Cents;
  /** Prev. bal. */
  previousBalance: Cents;
  /** Total due: Prev. bal. + Total budget. */
  due: Cents;
  /** One per new installment, in row order. */
  items: Cents[];
  /** Total inst.: the new items' sum. */
  total: Cents;
}

/** What the wizard shows beyond the contract. */
export interface BudgetInstallmentsSummary {
  /** One per row; none while step 1's date or months are refused. */
  dueDates: string[];
  /** Every owner of the period, as Save will write them; none while the form is refused. */
  review: ReviewRow[];
  /** What the new items add up to. */
  total: Cents;
}

const DEFAULT_COUNT = 3;
const DEFAULT_MONTHS = 4;
const MAX_COUNT = 12;
const MAX_MONTHS = 5;
const HUNDREDTHS = 100;

/**
 * The Create Budget Installments wizard: step 1 "Number and dates", step 2
 * "Installments", step 3 "Review". The rows follow the number: a number in
 * range that the rows do not have resets the percentages to
 * `defaultPercentages` and keeps the names typed, a new row named
 * `Installment {k}` after the period's installments.
 *
 * The review plans the batch from the books exactly as the port will, so Save
 * writes what step 3 shows. After a refused save the wizard reads the books
 * again through `latest`, and judges the form against them.
 */
export function createBudgetInstallmentsWizard(
  books: Books | null,
  write: (draft: InstallmentsDraft) => Promise<Result>,
  latest: () => Books | null = (): Books | null => {
    return books;
  },
): WizardMachine<BudgetInstallmentsForm, BudgetInstallmentsSummary, Result> {
  let read = books;

  const machine = createWizardMachine<
    BudgetInstallmentsForm,
    BudgetInstallmentsSummary,
    InstallmentsDraft,
    Result
  >(
    {
      initial: {
        count: String(DEFAULT_COUNT),
        firstDue: "",
        months: String(DEFAULT_MONTHS),
        wholeEuros: false,
        rows: rowsFor(books, DEFAULT_COUNT, []),
      },
      stepCount: 3,
      choices: [],
      derive: (form: BudgetInstallmentsForm): Derived<InstallmentsDraft> => {
        return derive(read, form);
      },
      summarize: (form: BudgetInstallmentsForm): BudgetInstallmentsSummary => {
        return summaryOf(read, form);
      },
      stepVerdict: (form: BudgetInstallmentsForm, step: number): Result => {
        return step === 1
          ? numberAndDatesVerdict(read, form)
          : derive(read, form).verdict;
      },
    },
    write,
  );

  function edit(patch: Partial<BudgetInstallmentsForm>): void {
    machine.intents.edit(
      followingCount(read, machine.state$.getValue().form, patch),
    );
  }

  async function save(): Promise<Result> {
    const result = await machine.intents.save();

    if (!result.ok) {
      read = latest();
      // The definition reads `read`: an empty edit has the machine judge the
      // form again over the books as they stand now.
      machine.intents.edit({});
    }

    return result;
  }

  return { ...machine, intents: { ...machine.intents, edit, save } };
}

/** The patch, with new rows when it sets the number to one in range that the rows do not have. */
function followingCount(
  books: Books | null,
  form: BudgetInstallmentsForm,
  patch: Partial<BudgetInstallmentsForm>,
): Partial<BudgetInstallmentsForm> {
  if (patch.count === undefined) {
    return patch;
  }

  const count = wholeNumberUpTo(patch.count, MAX_COUNT);
  const rows = patch.rows ?? form.rows;

  return count === null || count === rows.length
    ? patch
    : { ...patch, rows: rowsFor(books, count, rows) };
}

/** `count` rows on the default percentages, keeping the names of `previous`. */
function rowsFor(
  books: Books | null,
  count: number,
  previous: InstallmentRowForm[],
): InstallmentRowForm[] {
  const existing = books?.installments.length ?? 0;

  return defaultPercentages(count).map((percentage, index) => {
    return {
      name: previous[index]?.name ?? `Installment ${existing + index + 1}`,
      percentage: percentText(percentage),
    };
  });
}

/** Step 1's rules: a budget allocation to share, a number 1–12, months 1–5 and a first due date that is a day. */
function numberAndDatesVerdict(
  books: Books | null,
  form: BudgetInstallmentsForm,
): Result {
  if (books === null || !budgetSharesOf(books.entries, books.accounts).found) {
    return rejected("no-budget-allocation");
  }

  if (wholeNumberUpTo(form.count, MAX_COUNT) === null) {
    return rejected("count-out-of-range");
  }

  if (wholeNumberUpTo(form.months, MAX_MONTHS) === null) {
    return rejected("months-out-of-range");
  }

  return isCalendarDate(form.firstDue) ? ok() : rejected("invalid-due-date");
}

/** Step 1's rules, then every percentage read, then the domain's rules on the batch. */
function derive(
  books: Books | null,
  form: BudgetInstallmentsForm,
): Derived<InstallmentsDraft> {
  const first = numberAndDatesVerdict(books, form);

  if (!first.ok) {
    return refused(first.reason);
  }

  const installments = plannedOf(form);

  if (installments === null) {
    return refused("not-a-percentage");
  }

  const verdict = validateCreate(
    scheduleContextOf(must(books, "the books of a budget allocation")),
    installments,
  );

  return verdict.ok
    ? {
        preview: [],
        verdict,
        draft: { installments, wholeEuros: form.wholeEuros },
      }
    : { preview: [], verdict, draft: null };
}

function summaryOf(
  books: Books | null,
  form: BudgetInstallmentsForm,
): BudgetInstallmentsSummary {
  const { draft } = derive(books, form);
  const review = books === null || draft === null ? [] : reviewOf(books, draft);

  return {
    dueDates: dueDatesOf(form),
    review,
    total: review.reduce((sum, row) => {
      return addCents(sum, row.total);
    }, ZERO_CENTS),
  };
}

/** Each owner's items on the batch, planned from the books as the port plans them. */
function reviewOf(books: Books, draft: InstallmentsDraft): ReviewRow[] {
  const input = planInputOf(draft, books);
  const planned = planBudgetInstallments(input);

  return input.residents.map((residentId) => {
    const items = planned
      .filter((item) => {
        return item.residentId === residentId;
      })
      .map((item) => {
        return item.amount;
      });
    const budget = input.shares.get(residentId) ?? ZERO_CENTS;
    const previousBalance =
      input.previousBalances.get(residentId) ?? ZERO_CENTS;

    return {
      residentId,
      label: labelOf(books, residentId),
      budget,
      previousBalance,
      due: addCents(previousBalance, budget),
      items,
      total: items.reduce(addCents, ZERO_CENTS),
    };
  });
}

/** The rows as the batch's installments; null while a percentage is not one. */
function plannedOf(form: BudgetInstallmentsForm): PlannedInstallment[] | null {
  const dates = dueDatesOf(form);
  const planned: PlannedInstallment[] = [];

  for (const [index, row] of form.rows.entries()) {
    const percentage = parsePercentage(row.percentage);

    if (percentage === null) {
      return null;
    }

    planned.push({
      name: row.name,
      dueDate: must(dates[index], `the due date of row ${String(index + 1)}`),
      percentage,
    });
  }

  return planned;
}

/** One date per row, months apart from the first; none while the date or the months are refused. */
function dueDatesOf(form: BudgetInstallmentsForm): string[] {
  const months = wholeNumberUpTo(form.months, MAX_MONTHS);

  return months === null || !isCalendarDate(form.firstDue)
    ? []
    : dueDates(form.firstDue, form.rows.length, months);
}

/** "{unit} {name}" of an owner of the books. */
function labelOf(books: Books, residentId: string): string {
  const owner = must(
    books.parties.find((party): party is OwnerParty => {
      return party.kind === "owner" && party.id === residentId;
    }),
    `the owner ${residentId}`,
  );

  return `${owner.unitCode} ${owner.name}`;
}

/** The text as a whole number from 1 to `max`; null for any other text. */
function wholeNumberUpTo(text: string, max: number): number | null {
  if (!/^\d+$/.test(text.trim())) {
    return null;
  }

  const value = Number(text.trim());

  return value >= 1 && value <= max ? value : null;
}

/**
 * "33.33" as 3333 hundredths of a percent, read digit by digit so no
 * floating-point rounding comes in; a leading "-" negates it. Null for any
 * other text, more than two decimals included.
 */
function parsePercentage(text: string): number | null {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text.trim());

  if (match === null) {
    return null;
  }

  const [, sign, whole, fraction = ""] = match;
  const value =
    Number(must(whole, "the whole part")) * HUNDREDTHS +
    Number(fraction.padEnd(2, "0"));

  return sign === "-" ? 0 - value : value;
}

/** A default percentage, a whole percent in hundredths, as its text: 3400 as "34". */
function percentText(hundredths: number): string {
  return String(hundredths / HUNDREDTHS);
}
