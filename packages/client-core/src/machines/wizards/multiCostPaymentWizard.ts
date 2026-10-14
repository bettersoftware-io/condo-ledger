import {
  type Account,
  addCents,
  type Cents,
  type EntryDraft,
  type Posting,
  validateEntry,
  ZERO_CENTS,
} from "@cl/domain";

import { parseAmount } from "#/amounts.ts";
import type { Books } from "#/presenters/booksPresenter.ts";

import {
  isExpenseLeaf,
  leafChoices,
  roleAccount,
  shortPath,
} from "./choices.ts";
import { DIRECT_PAYMENT_DESCRIPTIONS } from "./directPaymentWizard.ts";
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

/** A cost line resolved: the leaf chosen and its amount. */
interface Cost {
  choice: WizardChoice;
  amount: Cents;
}

/** A cost line as read: the leaf, when one offered is chosen, and the amount, when it reads. */
interface ReadLine {
  choice: WizardChoice | undefined;
  amount: Cents | null;
}

/** What the wizard works on: the books, and the bank account paid from. */
interface Paying {
  books: Books;
  paidFrom: Account;
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
  const paidFrom = books === null ? null : roleAccount(books, "bank");
  const paying =
    books === null || paidFrom === null ? null : { books, paidFrom };
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
            paidFrom: paidFrom?.name ?? null,
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

  const { books } = paying;
  const draft: EntryDraft = {
    kind: "directPaymentBank",
    description: form.description,
    postings: [
      ...costs.map((cost): Posting => {
        return {
          accountId: cost.choice.key,
          debit: cost.amount,
          credit: ZERO_CENTS,
          counterpart: null,
        };
      }),
      {
        accountId: paying.paidFrom.id,
        debit: ZERO_CENTS,
        credit: paid,
        counterpart: null,
      },
    ],
  };

  const preview = [
    ...costs.map((cost) => {
      return {
        path: cost.choice.label,
        debit: cost.amount,
        credit: ZERO_CENTS,
      };
    }),
    {
      path: shortPath(books, paying.paidFrom.id),
      debit: ZERO_CENTS,
      credit: paid,
    },
  ];
  const verdict = validateEntry(draft, books.accounts);

  return verdict.ok
    ? { preview, verdict, draft }
    : { preview, verdict, draft: null };
}

function isCost(line: ReadLine): line is Cost {
  return line.choice !== undefined && line.amount !== null;
}

function linesTotal(lines: CostLine[]): Cents {
  return lines.reduce((total, line) => {
    return addCents(total, parseAmount(line.amount) ?? ZERO_CENTS);
  }, ZERO_CENTS);
}
