import {
  type Cents,
  type ClockPort,
  type EntryDraft,
  type JournalEntry,
  type OpenInvoice,
  ok,
  openInvoices,
  type Posting,
  paidOn,
  type Result,
  rejected,
  ZERO_CENTS,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import { amountText, parseAmount } from "#/amounts.ts";
import type { Books } from "#/presenters/booksPresenter.ts";
import { todayOf } from "#/today.ts";

import {
  contextOf,
  liquidityChoices,
  previewPath,
  roleAccount,
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

/** What the person picks and types for a payment: the amount as text, read in core. */
export interface InvoicePaymentForm {
  invoiceId: string | null;
  /** The liquidity account the payment comes from. */
  accountId: string | null;
  amount: string;
  description: string;
  /** The fields the person changed: the amount and the description stop following the invoice once they are here. */
  edited: string[];
}

/** One row of step 1's grid: an invoice that still owes its supplier something. Dates are "YYYY-MM-DD". */
export interface OpenInvoiceRow {
  id: string;
  number: string;
  reason: string;
  date: string;
  dueDate: string | null;
  /** The supplier's name. */
  supplier: string;
  remaining: Cents;
  /** Due before today: the due date shows in `--neg`. */
  overdue: boolean;
}

/** What the invoice payment wizard shows beyond the contract. */
export interface InvoicePaymentSummary {
  /** The invoices waiting to be paid, by due date (none last), then date, then number. */
  open: OpenInvoiceRow[];
  /** What the chosen invoice still owes, the edited payment's own amount added back: the most this payment may be. Null with no open invoice chosen. */
  remaining: Cents | null;
}

/** Every field of the form the person can change: an edited payment's are all the person's already. */
const FIELDS: readonly (keyof InvoicePaymentForm)[] = [
  "invoiceId",
  "accountId",
  "amount",
  "description",
];

/**
 * What step 2 is judged with in place of the description, which is step 3's:
 * the domain only asks that one is not blank, so any other text gives the
 * verdict the payment will have once it is written.
 */
const DESCRIPTION_ASIDE = "the description, step 3's";

/** What the wizard reads the form against. */
interface PaymentBooks {
  books: Books | null;
  /** The open invoices, the edited payment left out of what they have been paid. */
  open: OpenInvoice[];
  liquidity: WizardChoice[];
  /** The id of the payment the wizard rewrites; null for a new one. */
  replacing: string | null;
}

/**
 * The Invoice payment wizard: step 1 "Select invoice", step 2 "Liquidity
 * account and amount", step 3 "Description". Choosing an invoice fills the
 * amount with what it still owes and the description with "Payment of invoice
 * {number} — {supplier}", until the person types either. Editing, the wizard
 * starts at step 2 on the payment's invoice, which stays put, and the most it
 * may pay is what the invoice owes plus the payment's own amount.
 */
export function createInvoicePaymentWizard(
  books: Books | null,
  clock: ClockPort,
  write: WriteEntry,
  editing: JournalEntry | null,
): WizardMachine<InvoicePaymentForm, InvoicePaymentSummary> {
  const replacing = editing?.id ?? null;
  const read: PaymentBooks = {
    books,
    open:
      books === null
        ? []
        : openInvoices(
            books.invoices,
            books.entries.filter((entry) => {
              return entry.id !== replacing;
            }),
            books.withholdingTaxes,
          ),
    liquidity: books === null ? [] : liquidityChoices(books),
    replacing,
  };

  const today = todayOf(clock);
  const rows = read.open.map((open) => {
    return rowOf(read, open, today);
  });

  const machine = createWizardMachine<
    InvoicePaymentForm,
    InvoicePaymentSummary
  >(
    {
      initial: editing === null ? emptyForm(books) : formOf(editing),
      firstStep: editing === null ? 1 : 2,
      stepCount: 3,
      choices: read.liquidity,
      derive: (form: InvoicePaymentForm): Derived => {
        return derive(read, form);
      },
      summarize: (form: InvoicePaymentForm): InvoicePaymentSummary => {
        return {
          open: rows,
          remaining: openOf(read, form.invoiceId)?.remaining ?? null,
        };
      },
      stepVerdict: (form: InvoicePaymentForm, step: number): Result => {
        return verdictAt(read, form, step);
      },
      editing: replacing,
    },
    write,
  );

  function edit(patch: Partial<InvoicePaymentForm>): void {
    const { invoiceId, ...rest } = patch;
    const allowed = editing === null || invoiceId === undefined ? patch : rest;

    machine.intents.edit(
      applied(read, machine.state$.getValue().form, allowed),
    );
  }

  return { ...machine, intents: { ...machine.intents, edit } };
}

/** The rules of one step: step 1 the invoice; step 2 the account, the amount and the domain on the payment, its description aside; step 3 the whole verdict. */
function verdictAt(
  read: PaymentBooks,
  form: InvoicePaymentForm,
  step: number,
): Result {
  if (step === 1) {
    return openOf(read, form.invoiceId) === null
      ? rejected("no-invoice")
      : ok();
  }

  return step === 2
    ? derive(read, { ...form, description: DESCRIPTION_ASIDE }).verdict
    : derive(read, form).verdict;
}

/** The form after the person's patch: the fields it names are theirs from now on; the amount and the description follow the invoice until they are. */
function applied(
  read: PaymentBooks,
  form: InvoicePaymentForm,
  patch: Partial<InvoicePaymentForm>,
): InvoicePaymentForm {
  const next: InvoicePaymentForm = {
    ...form,
    ...patch,
    edited: [
      ...new Set([
        ...form.edited,
        ...FIELDS.filter((field) => {
          return field in patch;
        }),
      ]),
    ],
  };
  const open = openOf(read, next.invoiceId);

  return {
    ...next,
    amount: next.edited.includes("amount") ? next.amount : owedText(open),
    description: next.edited.includes("description")
      ? next.description
      : describe(read, open),
  };
}

/** What an open invoice still owes, as the form holds an amount; blank for none. */
function owedText(open: OpenInvoice | null): string {
  return open === null ? "" : amountText(open.remaining);
}

function derive(read: PaymentBooks, form: InvoicePaymentForm): Derived {
  const open = openOf(read, form.invoiceId);

  if (open === null) {
    return refused("no-invoice");
  }

  const account = read.liquidity.find((choice) => {
    return choice.key === form.accountId;
  });

  if (account === undefined) {
    return refused("no-liquidity-account");
  }

  const amount = parseAmount(form.amount);

  if (amount === null || amount <= 0) {
    return refused("not-an-amount");
  }

  // An invoice is open: there are books.
  const books = must(read.books, "the books");
  const suppliers = books.accounts.find((candidate) => {
    return candidate.role === "suppliers";
  });

  if (suppliers === undefined) {
    return refused("no-suppliers-account");
  }

  const postings: Posting[] = [
    {
      accountId: suppliers.id,
      debit: amount,
      credit: ZERO_CENTS,
      counterpart: { kind: "supplier", id: open.invoice.supplierId },
    },
    {
      accountId: account.key,
      debit: ZERO_CENTS,
      credit: amount,
      counterpart: null,
    },
  ];

  const draft: EntryDraft = {
    kind: "invoicePayment",
    description: form.description,
    postings,
    invoiceId: open.invoice.id,
  };

  const preview = postings.map((posting) => {
    return {
      path: previewPath(books, posting),
      debit: posting.debit,
      credit: posting.credit,
    };
  });

  return judged(preview, draft, contextOf(books, read.replacing));
}

/** The open invoice with this id; null for none, or for one already settled. */
function openOf(
  read: PaymentBooks,
  invoiceId: string | null,
): OpenInvoice | null {
  return (
    read.open.find((open) => {
      return open.invoice.id === invoiceId;
    }) ?? null
  );
}

/** "Payment of invoice {number} — {supplier}" for an open invoice; blank for none. */
function describe(read: PaymentBooks, open: OpenInvoice | null): string {
  return open === null
    ? ""
    : `Payment of invoice ${open.invoice.number} — ${supplierName(read, open.invoice.supplierId)}`;
}

function rowOf(
  read: PaymentBooks,
  open: OpenInvoice,
  today: string,
): OpenInvoiceRow {
  const { invoice } = open;

  return {
    id: invoice.id,
    number: invoice.number,
    reason: invoice.reason,
    date: invoice.date,
    dueDate: invoice.dueDate,
    supplier: supplierName(read, invoice.supplierId),
    remaining: open.remaining,
    overdue: invoice.dueDate !== null && invoice.dueDate < today,
  };
}

/** A new payment: no invoice yet, the bank-role account chosen. */
function emptyForm(books: Books | null): InvoicePaymentForm {
  return {
    invoiceId: null,
    accountId: books === null ? null : (roleAccount(books, "bank")?.id ?? null),
    amount: "",
    description: "",
    edited: [],
  };
}

/** The form a payment was written from: its invoice, the account it credits, what it pays the supplier, and its description. */
function formOf(entry: JournalEntry): InvoicePaymentForm {
  const invoiceId = must(
    entry.invoiceId,
    `the invoice of the entry ${entry.id}`,
  );

  const credited = entry.postings.find((posting) => {
    return posting.credit > 0;
  });

  return {
    invoiceId,
    accountId: credited?.accountId ?? null,
    amount: amountText(paidOn(invoiceId, [entry])),
    description: entry.description,
    edited: [...FIELDS],
  };
}

function supplierName(read: PaymentBooks, supplierId: string): string {
  return must(
    read.books?.parties.find((party) => {
      return party.id === supplierId;
    }),
    `the supplier ${supplierId}`,
  ).name;
}
