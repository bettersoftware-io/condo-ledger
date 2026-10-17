import {
  type Account,
  type AccountRole,
  addCents,
  type Cents,
  type EntryDraft,
  type EntryKind,
  type JournalEntry,
  type Posting,
  type Result,
  ZERO_CENTS,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import { amountText, parseAmount } from "#/amounts.ts";
import type { Books } from "#/presenters/booksPresenter.ts";

import {
  contextOf,
  isExpenseLeaf,
  leafChoices,
  type Paying,
  payingOf,
  roleAccount,
  shortPath,
} from "./choices.ts";
import {
  createWizardMachine,
  type Derived,
  judged,
  refused,
  type WizardChoice,
  type WizardMachine,
  type WriteEntry,
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

const DIRECT_PAYMENT_KINDS: readonly DirectPaymentKind[] = [
  "directPaymentCash",
  "directPaymentBank",
  "withholdingPayment",
];

/** The role of the account each kind pays from. */
const ROLES: Record<DirectPaymentKind, AccountRole> = {
  directPaymentCash: "cash",
  directPaymentBank: "bank",
  withholdingPayment: "bank",
};

/** The leaves each kind pays for. */
const TARGETS: Record<DirectPaymentKind, (account: Account) => boolean> = {
  directPaymentCash: isExpenseLeaf,
  directPaymentBank: isExpenseLeaf,
  withholdingPayment: isTaxLeaf,
};

/** A leaf a payment debits: the one chosen, and its amount. */
export interface Debit {
  choice: WizardChoice;
  amount: Cents;
}

/**
 * One target leaf debited, the cash or bank account credited: the three
 * one-step wizards of the design. A withholding's description names the tax
 * account chosen, until the person edits it. Editing an entry, the form is
 * its description, its debit line and that line's amount.
 */
export function createDirectPaymentWizard(
  kind: DirectPaymentKind,
  books: Books | null,
  write: WriteEntry,
  editing: JournalEntry | null,
): WizardMachine<DirectPaymentForm, DirectPaymentSummary> {
  const paying = payingOf(books, ROLES[kind]);

  const choices = books === null ? [] : leafChoices(books, TARGETS[kind]);
  const accounts = books?.accounts ?? [];
  const replacing = editing?.id ?? null;

  function derived(form: DirectPaymentForm): Derived {
    return derive(kind, paying, choices, form, replacing);
  }

  const machine = createWizardMachine<DirectPaymentForm, DirectPaymentSummary>(
    {
      initial: editing === null ? emptyForm(kind) : formOf(editing),
      stepCount: 1,
      choices,
      derive: derived,
      summarize: (): DirectPaymentSummary => {
        return { paidFrom: paying?.paidFrom.name ?? null };
      },
      stepVerdict: (form: DirectPaymentForm): Result => {
        return derived(form).verdict;
      },
      editing: replacing,
    },
    write,
  );
  // An edited entry's description is the person's already.
  let descriptionEdited = editing !== null;

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

/** Whether the direct-payment wizard can write this entry's postings: one debit on a leaf it offers, then its amount credited to the account its kind pays from. */
export function fitsDirectPayment(entry: JournalEntry, books: Books): boolean {
  const kind = DIRECT_PAYMENT_KINDS.find((candidate) => {
    return candidate === entry.kind;
  });

  return (
    kind !== undefined &&
    paymentDebits(entry, books, ROLES[kind], TARGETS[kind])?.length === 1
  );
}

/**
 * The debits of an entry written as a payment's wizard writes it: each on a
 * leaf `keep` accepts, then one credit of their sum to the regular account
 * with the role, and no party anywhere. Null when the entry is not so written.
 */
export function paymentDebits(
  entry: JournalEntry,
  books: Books,
  role: AccountRole,
  keep: (account: Account) => boolean,
): Posting[] | null {
  const paidFrom = roleAccount(books, role);
  const offered = new Set(
    leafChoices(books, keep).map((choice) => {
      return choice.key;
    }),
  );
  const debits = entry.postings.slice(0, -1);
  const credit = entry.postings.at(-1);
  const sum = debits.reduce((total, posting) => {
    return addCents(total, posting.debit);
  }, ZERO_CENTS);

  const written =
    paidFrom !== null &&
    credit !== undefined &&
    credit.accountId === paidFrom.id &&
    credit.debit === ZERO_CENTS &&
    credit.counterpart === null &&
    credit.credit === sum &&
    debits.length > 0 &&
    debits.every((posting) => {
      return (
        offered.has(posting.accountId) &&
        posting.debit > ZERO_CENTS &&
        posting.credit === ZERO_CENTS &&
        posting.counterpart === null
      );
    });

  return written ? debits : null;
}

function emptyForm(kind: DirectPaymentKind): DirectPaymentForm {
  return {
    description: DIRECT_PAYMENT_DESCRIPTIONS[kind],
    targetId: null,
    amount: "",
  };
}

/** The form an entry was written from: its description, and its first debit line with that line's amount. */
function formOf(entry: JournalEntry): DirectPaymentForm {
  const debit = must(
    entry.postings.find((posting) => {
      return posting.debit > ZERO_CENTS;
    }),
    `a debit of the entry ${entry.id}`,
  );

  return {
    description: entry.description,
    targetId: debit.accountId,
    amount: amountText(debit.debit),
  };
}

function derive(
  kind: DirectPaymentKind,
  paying: Paying | null,
  choices: WizardChoice[],
  form: DirectPaymentForm,
  replacing: string | null,
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
    replacing,
  );
}

/**
 * A payment's draft: each debit on its leaf, then the account paid from
 * credited with the amount paid; previewed in that order, and judged with the
 * entry it rewrites, if any, left out.
 */
export function judgedPayment(
  kind: EntryKind,
  description: string,
  paying: Paying,
  debits: Debit[],
  paid: Cents,
  replacing: string | null,
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

  return judged(preview, draft, contextOf(books, replacing));
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
