import {
  type Account,
  type Cents,
  type EntryDraft,
  type EntryKind,
  type Posting,
  ZERO_CENTS,
} from "@cl/domain";

import { parseAmount } from "#/amounts.ts";
import type { Books } from "#/presenters/booksPresenter.ts";

import {
  isExpenseLeaf,
  leafChoices,
  type Paying,
  payingOf,
  shortPath,
} from "./choices.ts";
import {
  type AddEntry,
  createWizardMachine,
  type Derived,
  judged,
  refused,
  type WizardChoice,
  type WizardMachine,
} from "./wizard.ts";

export type DirectPaymentKind =
  | "directPaymentCash"
  | "directPaymentBank"
  | "withholdingPayment";

export interface DirectPaymentForm {
  description: string;
  targetId: string | null;
  amount: string;
}

/** What the direct-payment wizards show beyond the contract. */
export interface DirectPaymentSummary {
  /** The name of the account the payment comes from: the "Paid from" line. Null when the period has none. */
  paidFrom: string | null;
}

export const DIRECT_PAYMENT_DESCRIPTIONS: Record<DirectPaymentKind, string> = {
  directPaymentCash: "Direct cash purchase",
  directPaymentBank: "Direct purchase via bank account",
  withholdingPayment: "Withholding payment",
};

/** A leaf a payment debits: the one chosen, and its amount. */
export interface Debit {
  choice: WizardChoice;
  amount: Cents;
}

/**
 * One target leaf debited, the cash or bank account credited: the three
 * one-step wizards of the design. A withholding's description names the tax
 * account chosen, until the person edits it.
 */
export function createDirectPaymentWizard(
  kind: DirectPaymentKind,
  books: Books | null,
  addEntry: AddEntry,
): WizardMachine<DirectPaymentForm, DirectPaymentSummary> {
  const paying = payingOf(
    books,
    kind === "directPaymentCash" ? "cash" : "bank",
  );

  const choices =
    books === null
      ? []
      : leafChoices(
          books,
          kind === "withholdingPayment" ? isTaxLeaf : isExpenseLeaf,
        );
  const accounts = books?.accounts ?? [];
  const machine = createWizardMachine<DirectPaymentForm, DirectPaymentSummary>(
    {
      initial: {
        description: DIRECT_PAYMENT_DESCRIPTIONS[kind],
        targetId: null,
        amount: "",
      },
      stepCount: 1,
      choices,
      derive: (form: DirectPaymentForm): Derived => {
        return derive(kind, paying, choices, form);
      },
      summarize: (): DirectPaymentSummary => {
        return { paidFrom: paying?.paidFrom.name ?? null };
      },
    },
    addEntry,
  );
  let descriptionEdited = false;

  function edit(patch: Partial<DirectPaymentForm>): void {
    if (patch.description !== undefined) {
      descriptionEdited = true;
    }

    if (descriptionEdited) {
      machine.intents.edit(patch);

      return;
    }

    const targetId =
      patch.targetId === undefined
        ? machine.state$.getValue().form.targetId
        : patch.targetId;

    machine.intents.edit({
      ...patch,
      description: prefill(kind, accounts, targetId),
    });
  }

  return { ...machine, intents: { ...machine.intents, edit } };
}

function derive(
  kind: DirectPaymentKind,
  paying: Paying | null,
  choices: WizardChoice[],
  form: DirectPaymentForm,
): Derived {
  if (paying === null) {
    return refused("no-paid-from-account");
  }

  const target = choices.find((choice) => {
    return choice.key === form.targetId;
  });

  if (target === undefined) {
    return refused("no-target");
  }

  const amount = parseAmount(form.amount);

  if (amount === null) {
    return refused("not-an-amount");
  }

  return judgedPayment(
    kind,
    form.description,
    paying,
    [{ choice: target, amount }],
    amount,
  );
}

/**
 * A payment's draft: each debit on its leaf, then the account paid from
 * credited with the amount paid; previewed in that order, and judged.
 */
export function judgedPayment(
  kind: EntryKind,
  description: string,
  paying: Paying,
  debits: Debit[],
  paid: Cents,
): Derived {
  const { books, paidFrom } = paying;
  const draft: EntryDraft = {
    kind,
    description,
    postings: [
      ...debits.map((debit): Posting => {
        return {
          accountId: debit.choice.key,
          debit: debit.amount,
          credit: ZERO_CENTS,
          counterpart: null,
        };
      }),
      {
        accountId: paidFrom.id,
        debit: ZERO_CENTS,
        credit: paid,
        counterpart: null,
      },
    ],
  };

  const preview = [
    ...debits.map((debit) => {
      return {
        path: debit.choice.label,
        debit: debit.amount,
        credit: ZERO_CENTS,
      };
    }),
    { path: shortPath(books, paidFrom.id), debit: ZERO_CENTS, credit: paid },
  ];

  return judged(preview, draft, books.accounts);
}

/** The description the wizard proposes: a withholding names the tax account chosen. */
function prefill(
  kind: DirectPaymentKind,
  accounts: Account[],
  targetId: string | null,
): string {
  const base = DIRECT_PAYMENT_DESCRIPTIONS[kind];
  const target = accounts.find((account) => {
    return account.id === targetId;
  });

  return kind !== "withholdingPayment" || target === undefined
    ? base
    : `${base} (${target.name})`;
}

function isTaxLeaf(account: Account): boolean {
  return account.role === "tax";
}
