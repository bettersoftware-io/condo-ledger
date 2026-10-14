import {
  type Account,
  type EntryDraft,
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
import {
  type AddEntry,
  createWizardMachine,
  type Derived,
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

/** What the wizard works on: the books, and the account paid from. */
interface Paying {
  books: Books;
  paidFrom: Account;
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
  const paying = payingOf(kind, books);
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

/** The books and the account the kind pays from, or null when there are no books or the period has no such account. */
function payingOf(kind: DirectPaymentKind, books: Books | null): Paying | null {
  if (books === null) {
    return null;
  }

  const paidFrom = roleAccount(
    books,
    kind === "directPaymentCash" ? "cash" : "bank",
  );

  return paidFrom === null ? null : { books, paidFrom };
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

  const { books, paidFrom } = paying;
  const draft: EntryDraft = {
    kind,
    description: form.description,
    postings: [
      {
        accountId: target.key,
        debit: amount,
        credit: ZERO_CENTS,
        counterpart: null,
      },
      {
        accountId: paidFrom.id,
        debit: ZERO_CENTS,
        credit: amount,
        counterpart: null,
      },
    ],
  };

  const preview = [
    { path: target.label, debit: amount, credit: ZERO_CENTS },
    { path: shortPath(books, paidFrom.id), debit: ZERO_CENTS, credit: amount },
  ];
  const verdict = validateEntry(draft, books.accounts);

  return verdict.ok
    ? { preview, verdict, draft }
    : { preview, verdict, draft: null };
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
