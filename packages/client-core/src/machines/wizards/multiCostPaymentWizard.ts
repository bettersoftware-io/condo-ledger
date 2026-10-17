import {
  addCents,
  type Cents,
  type JournalEntry,
  type Result,
  ZERO_CENTS,
} from "@cl/domain";

import { amountText, parseAmount } from "#/amounts.ts";
import type { Books } from "#/presenters/booksPresenter.ts";

import {
  isExpenseLeaf,
  leafChoices,
  type Paying,
  payingOf,
} from "./choices.ts";
import {
  type Debit,
  DIRECT_PAYMENT_DESCRIPTIONS,
  judgedPayment,
  paymentDebits,
} from "./directPaymentWizard.ts";
import {
  createWizardMachine,
  type Derived,
  keepingOneLine,
  refused,
  type WizardChoice,
  type WizardMachine,
  type WriteEntry,
} from "./wizard.ts";

/** One cost of the purchase: the expense leaf debited and its amount, as typed. */
interface CostLine {
  accountId: string | null;
  amount: string;
}

export interface MultiCostPaymentForm {
  description: string;
  /** The amount paid from the bank, as typed. */
  amount: string;
  lines: CostLine[];
}

/** What the multi-cost wizard shows beyond the contract. */
export interface MultiCostPaymentSummary {
  /** The name of the bank account the purchase is paid from. Null when the period has none. */
  paidFrom: string | null;
  /** The sum of the cost lines whose amount reads: the lines grid's footer. */
  linesTotal: Cents;
}

/** A cost line as read: the leaf, when one offered is chosen, and the amount, when it reads. */
interface ReadLine {
  choice: WizardChoice | undefined;
  amount: Cents | null;
}

const EMPTY_LINE: CostLine = { accountId: null, amount: "" };

const EMPTY_FORM: MultiCostPaymentForm = {
  description: DIRECT_PAYMENT_DESCRIPTIONS.directPaymentBank,
  amount: "",
  lines: [EMPTY_LINE],
};

/**
 * A bank purchase split over several costs: each line's expense leaf debited,
 * the bank credited with the amount paid, which the lines must sum to.
 * Editing an entry, the form is its description, its debit lines and what
 * its credits paid.
 */
export function createMultiCostPaymentWizard(
  books: Books | null,
  write: WriteEntry,
  editing: JournalEntry | null,
): WizardMachine<MultiCostPaymentForm, MultiCostPaymentSummary> {
  const paying = payingOf(books, "bank");
  const choices = books === null ? [] : leafChoices(books, isExpenseLeaf);
  const replacing = editing?.id ?? null;

  function derived(form: MultiCostPaymentForm): Derived {
    return derive(paying, choices, form, replacing);
  }

  return keepingOneLine(
    createWizardMachine<MultiCostPaymentForm, MultiCostPaymentSummary>(
      {
        initial: editing === null ? EMPTY_FORM : formOf(editing),
        stepCount: 1,
        choices,
        derive: derived,
        summarize: (form: MultiCostPaymentForm): MultiCostPaymentSummary => {
          return {
            paidFrom: paying?.paidFrom.name ?? null,
            linesTotal: linesTotal(form.lines),
          };
        },
        stepVerdict: (form: MultiCostPaymentForm): Result => {
          return derived(form).verdict;
        },
        editing: replacing,
      },
      write,
    ),
    EMPTY_LINE,
  );
}

/** Whether the multi-cost wizard can write this entry's postings: a bank purchase of one expense leaf or several, credited to the bank. */
export function fitsMultiCost(entry: JournalEntry, books: Books): boolean {
  return (
    entry.kind === "directPaymentBank" &&
    paymentDebits(entry, books, "bank", isExpenseLeaf) !== null
  );
}

/** The form an entry was written from: its description, its credits as the amount paid, a line per debit. */
function formOf(entry: JournalEntry): MultiCostPaymentForm {
  const lines: CostLine[] = [];
  let paid = ZERO_CENTS;

  for (const posting of entry.postings) {
    paid = addCents(paid, posting.credit);

    if (posting.debit > ZERO_CENTS) {
      lines.push({
        accountId: posting.accountId,
        amount: amountText(posting.debit),
      });
    }
  }

  return { description: entry.description, amount: amountText(paid), lines };
}

function derive(
  paying: Paying | null,
  choices: WizardChoice[],
  form: MultiCostPaymentForm,
  replacing: string | null,
): Derived {
  if (paying === null) {
    return refused("no-paid-from-account");
  }

  const read = form.lines.map((line): ReadLine => {
    return {
      choice: choices.find((choice) => {
        return choice.key === line.accountId;
      }),
      amount: parseAmount(line.amount),
    };
  });

  if (
    read.some((line) => {
      return line.choice === undefined;
    })
  ) {
    return refused("no-target");
  }

  const costs = read.filter(isCost);
  const paid = parseAmount(form.amount);

  if (paid === null || costs.length < read.length) {
    return refused("not-an-amount");
  }

  const sum = costs.reduce((total, cost) => {
    return addCents(total, cost.amount);
  }, ZERO_CENTS);

  if (sum !== paid) {
    return refused("lines-do-not-sum");
  }

  return judgedPayment(
    "directPaymentBank",
    form.description,
    paying,
    costs,
    paid,
    replacing,
  );
}

function isCost(line: ReadLine): line is Debit {
  return line.choice !== undefined && line.amount !== null;
}

function linesTotal(lines: CostLine[]): Cents {
  return lines.reduce((total, line) => {
    return addCents(total, parseAmount(line.amount) ?? ZERO_CENTS);
  }, ZERO_CENTS);
}
