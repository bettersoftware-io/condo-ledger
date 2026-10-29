import {
  addCents,
  type Cents,
  type JournalEntry,
  type Result,
  ZERO_CENTS,
} from "@cl/domain";

import type { AmountTexts } from "#/amounts.ts";
import type { Books } from "#/presenters/booksPresenter.ts";

import {
  type Debit,
  isExpenseLeaf,
  judgedPayment,
  leafChoices,
  type Paying,
  payingOf,
} from "./choices.ts";
import {
  DIRECT_PAYMENT_DESCRIPTIONS,
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
 * its credits paid. Amounts are read and written through `texts`, in the
 * session's locale.
 */
export function createMultiCostPaymentWizard(
  texts: AmountTexts,
  books: Books | null,
  write: WriteEntry,
  editing: JournalEntry | null,
): WizardMachine<MultiCostPaymentForm, MultiCostPaymentSummary> {
  const paying = payingOf(books, "bank");
  const choices = books === null ? [] : leafChoices(books, isExpenseLeaf);
  const replacing = editing?.id ?? null;

  function derived(form: MultiCostPaymentForm): Derived {
    return derive(texts, paying, choices, form, replacing);
  }

  return keepingOneLine(
    createWizardMachine<MultiCostPaymentForm, MultiCostPaymentSummary>(
      {
        initial: editing === null ? EMPTY_FORM : formOf(texts, editing),
        stepCount: 1,
        choices,
        derive: derived,
        summarize: (form: MultiCostPaymentForm): MultiCostPaymentSummary => {
          return {
            paidFrom: paying?.paidFrom.name ?? null,
            linesTotal: linesTotal(texts, form.lines),
          };
        },
        stepVerdict: (form: MultiCostPaymentForm): Result => {
          return derived(form).verdict;
        },
        editing: replacing,
      },
      write,
      texts.changed$,
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
function formOf(texts: AmountTexts, entry: JournalEntry): MultiCostPaymentForm {
  const lines: CostLine[] = [];
  let paid = ZERO_CENTS;

  for (const posting of entry.postings) {
    paid = addCents(paid, posting.credit);

    if (posting.debit > ZERO_CENTS) {
      lines.push({
        accountId: posting.accountId,
        amount: texts.text(posting.debit),
      });
    }
  }

  return { description: entry.description, amount: texts.text(paid), lines };
}

function derive(
  texts: AmountTexts,
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
      amount: texts.parse(line.amount),
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
  const paid = texts.parse(form.amount);

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

function linesTotal(texts: AmountTexts, lines: CostLine[]): Cents {
  return lines.reduce((total, line) => {
    return addCents(total, texts.parse(line.amount) ?? ZERO_CENTS);
  }, ZERO_CENTS);
}
