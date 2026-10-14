import { addCents, type Cents, ZERO_CENTS } from "@cl/domain";

import { parseAmount } from "#/amounts.ts";
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
} from "./directPaymentWizard.ts";
import {
  type AddEntry,
  createWizardMachine,
  type Derived,
  keepingOneLine,
  refused,
  type WizardChoice,
  type WizardMachine,
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

/**
 * A bank purchase split over several costs: each line's expense leaf debited,
 * the bank credited with the amount paid, which the lines must sum to.
 */
export function createMultiCostPaymentWizard(
  books: Books | null,
  addEntry: AddEntry,
): WizardMachine<MultiCostPaymentForm, MultiCostPaymentSummary> {
  const paying = payingOf(books, "bank");
  const choices = books === null ? [] : leafChoices(books, isExpenseLeaf);

  return keepingOneLine(
    createWizardMachine<MultiCostPaymentForm, MultiCostPaymentSummary>(
      {
        initial: {
          description: DIRECT_PAYMENT_DESCRIPTIONS.directPaymentBank,
          amount: "",
          lines: [EMPTY_LINE],
        },
        stepCount: 1,
        choices,
        derive: (form: MultiCostPaymentForm): Derived => {
          return derive(paying, choices, form);
        },
        summarize: (form: MultiCostPaymentForm): MultiCostPaymentSummary => {
          return {
            paidFrom: paying?.paidFrom.name ?? null,
            linesTotal: linesTotal(form.lines),
          };
        },
      },
      addEntry,
    ),
    EMPTY_LINE,
  );
}

function derive(
  paying: Paying | null,
  choices: WizardChoice[],
  form: MultiCostPaymentForm,
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
