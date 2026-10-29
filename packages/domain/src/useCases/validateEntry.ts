import type { Account } from "../entities/account.ts";
import { addCents, type Cents, cents, ZERO_CENTS } from "../entities/cents.ts";
import type { Installment, InstallmentItem } from "../entities/installment.ts";
import type {
  Invoice,
  InvoiceTerms,
  Rate,
  WithholdingTax,
} from "../entities/invoice.ts";
import type {
  EntryDraft,
  EntryKind,
  JournalEntry,
  Posting,
} from "../entities/journal.ts";
import type { Party } from "../entities/party.ts";
import { ok, type Result, rejected } from "../entities/result.ts";
import { type ItemBalance, itemBalances } from "./installments.ts";
import { invoicePostings, invoiceTotals } from "./invoice.ts";
import { paidOn } from "./openInvoices.ts";

/**
 * What a draft is judged against: the period's books as they stand. `replacing`
 * is the entry an edit rewrites, left out of `entries` for every rule.
 */
export interface EntryContext {
  accounts: Account[];
  parties: Party[];
  withholdingTaxes: WithholdingTax[];
  invoices: Invoice[];
  entries: JournalEntry[];
  installments: Installment[];
  installmentItems: InstallmentItem[];
  replacing: string | null;
}

/**
 * Whether a draft may be written to the period the context describes. The
 * reasons are checked in this order, and the first one found is answered.
 */
export function validateEntry(
  draft: EntryDraft,
  context: EntryContext,
): Result {
  const reason =
    linesReason(draft, context.accounts) ??
    kindReason(draft, {
      ...context,
      entries: context.entries.filter((entry) => {
        return entry.id !== context.replacing;
      }),
    });

  return reason === null ? ok() : rejected(reason);
}

/** M2a's rules: a description, lines on leaves with their parties, balanced. */
function linesReason(draft: EntryDraft, accounts: Account[]): string | null {
  if (draft.description.trim() === "") {
    return "blank-description";
  }

  if (draft.postings.length === 0) {
    return "no-postings";
  }

  const byId = new Map(
    accounts.map((account) => {
      return [account.id, account];
    }),
  );

  for (const posting of draft.postings) {
    const reason = lineReason(posting, byId, draft.kind);

    if (reason !== null) {
      return reason;
    }
  }

  const debit = draft.postings.reduce((sum, posting) => {
    return addCents(sum, posting.debit);
  }, ZERO_CENTS);

  const credit = draft.postings.reduce((sum, posting) => {
    return addCents(sum, posting.credit);
  }, ZERO_CENTS);

  return debit === credit ? null : "unbalanced";
}

/** The rules of a registration, a payment and an opening, over entries the edited one is already out of. */
function kindReason(draft: EntryDraft, context: EntryContext): string | null {
  const terms = draft.invoice;
  const invoiceId = draft.invoiceId;

  if (
    (draft.kind === "invoice" && terms === undefined) ||
    (draft.kind === "invoicePayment" && invoiceId === undefined)
  ) {
    return "invoice-required";
  }

  if (
    (draft.kind !== "invoice" && terms !== undefined) ||
    (draft.kind !== "invoicePayment" && invoiceId !== undefined)
  ) {
    return "invoice-not-allowed";
  }

  if (terms !== undefined) {
    return registrationReason(draft.postings, terms, context);
  }

  if (invoiceId !== undefined) {
    return paymentReason(draft.postings, invoiceId, context);
  }

  const opened = context.entries.some((entry) => {
    return entry.kind === "openingBalances";
  });

  if (draft.kind === "openingBalances" && opened) {
    return "opening-exists";
  }

  return itemReason(draft, context);
}

/** The rules of the installment items a collection's lines name, checked one rule across all the lines before the next. */
function itemReason(draft: EntryDraft, context: EntryContext): string | null {
  const owners = new Set(
    context.accounts
      .filter((account) => {
        return account.role === "owners";
      })
      .map((account) => {
        return account.id;
      }),
  );

  function credits(posting: Posting): boolean {
    return (
      draft.kind === "collection" &&
      owners.has(posting.accountId) &&
      posting.credit > 0
    );
  }

  if (
    draft.postings.some((posting) => {
      return posting.installmentItemId !== undefined && !credits(posting);
    })
  ) {
    return "item-not-allowed";
  }

  if (
    draft.postings.some((posting) => {
      return posting.installmentItemId === undefined && credits(posting);
    })
  ) {
    return "item-required";
  }

  const named = draft.postings.filter((posting) => {
    return posting.installmentItemId !== undefined;
  });

  if (named.length === 0) {
    return null;
  }

  const balances = itemBalances(
    context.installmentItems,
    context.installments,
    context.entries,
  );

  return namedItemReason(named, balances);
}

function namedItemReason(
  named: Posting[],
  balances: ItemBalance[],
): string | null {
  function balanceOf(posting: Posting): ItemBalance | undefined {
    return balances.find((balance) => {
      return balance.item.id === posting.installmentItemId;
    });
  }

  if (
    named.some((posting) => {
      return balanceOf(posting) === undefined;
    })
  ) {
    return "unknown-item";
  }

  if (
    named.some((posting) => {
      const counterpart = posting.counterpart;

      return (
        counterpart?.kind !== "owner" ||
        counterpart.id !== balanceOf(posting)?.item.residentId
      );
    })
  ) {
    return "wrong-resident";
  }

  const paying = new Map<string, number>();

  for (const posting of named) {
    const id = posting.installmentItemId ?? "";

    paying.set(id, (paying.get(id) ?? 0) + posting.credit);
  }

  for (const balance of balances) {
    if ((paying.get(balance.item.id) ?? 0) > balance.remaining) {
      return "over-remaining-item";
    }
  }

  return null;
}

function registrationReason(
  postings: Posting[],
  terms: InvoiceTerms,
  context: EntryContext,
): string | null {
  const supplier = context.parties.some((party) => {
    return party.kind === "supplier" && party.id === terms.supplierId;
  });

  if (!supplier) {
    return "unknown-supplier";
  }

  const catalogued = context.withholdingTaxes.some((candidate) => {
    return candidate.code === terms.withholdingCode;
  });

  if (terms.withholdingCode !== null && !catalogued) {
    return "unknown-withholding";
  }

  const expected = invoicePostings(
    terms,
    context.withholdingTaxes,
    context.accounts,
  );

  if (!expected.ok || !samePostings(expected.value, postings)) {
    return "postings-disagree";
  }

  const edited = context.invoices.find((invoice) => {
    return invoice.entryId === context.replacing;
  });

  if (edited === undefined) {
    return null;
  }

  const paid = paidOn(edited.id, context.entries);
  const named = context.entries.some((entry) => {
    return entry.kind === "invoicePayment" && entry.invoiceId === edited.id;
  });

  if (named && terms.supplierId !== edited.supplierId) {
    return "supplier-has-payments";
  }

  const owed = invoiceTotals(terms, rateOf(terms, context));

  return owed.dueToSupplier < paid ? "below-paid" : null;
}

function paymentReason(
  postings: Posting[],
  invoiceId: string,
  context: EntryContext,
): string | null {
  const invoice = context.invoices.find((candidate) => {
    return candidate.id === invoiceId;
  });

  if (invoice === undefined) {
    return "unknown-invoice";
  }

  const paying = postings.filter((posting) => {
    return posting.counterpart?.kind === "supplier" && posting.debit > 0;
  });

  const right = paying.every((posting) => {
    return posting.counterpart?.id === invoice.supplierId;
  });

  if (paying.length === 0 || !right) {
    return "wrong-supplier";
  }

  return amountOf(paying) > remainingOf(invoice, context)
    ? "over-remaining"
    : null;
}

/** What the invoice still owes its supplier, its payments in the context deducted. */
function remainingOf(invoice: Invoice, context: EntryContext): Cents {
  const owed = invoiceTotals(invoice, rateOf(invoice, context));

  return cents(owed.dueToSupplier - paidOn(invoice.id, context.entries));
}

/** The rate of the terms' withholding code in the period's catalogue; none with no code. */
function rateOf(terms: InvoiceTerms, context: EntryContext): Rate | null {
  return (
    context.withholdingTaxes.find((candidate) => {
      return candidate.code === terms.withholdingCode;
    })?.rate ?? null
  );
}

function amountOf(postings: Posting[]): Cents {
  return postings.reduce((sum, posting) => {
    return addCents(sum, posting.debit);
  }, ZERO_CENTS);
}

function samePostings(expected: Posting[], actual: Posting[]): boolean {
  return (
    expected.length === actual.length &&
    expected.every((posting, index) => {
      const other = actual[index];

      return (
        other !== undefined &&
        posting.accountId === other.accountId &&
        posting.debit === other.debit &&
        posting.credit === other.credit &&
        posting.counterpart?.kind === other.counterpart?.kind &&
        posting.counterpart?.id === other.counterpart?.id
      );
    })
  );
}

/** A budget allocation keeps a 0.00 line for a resident whose share is 0, as the legacy entry has them; every other kind refuses an empty line. */
function lineReason(
  posting: Posting,
  byId: Map<string, Account>,
  kind: EntryKind,
): string | null {
  const account = byId.get(posting.accountId);

  if (account === undefined) {
    return "unknown-account";
  }

  if (account.type === "grouping") {
    return "not-a-leaf";
  }

  if (
    posting.debit === 0 &&
    posting.credit === 0 &&
    kind !== "budgetAllocation"
  ) {
    return "empty-line";
  }

  if (posting.debit !== 0 && posting.credit !== 0) {
    return "both-sides";
  }

  if (posting.debit < 0 || posting.credit < 0) {
    return "negative";
  }

  const control =
    account.type === "control" || account.type === "controlUnitResident";

  if (control && posting.counterpart === null) {
    return "counterpart-required";
  }

  if (!control && posting.counterpart !== null) {
    return "counterpart-not-allowed";
  }

  if (control && posting.counterpart !== null) {
    const expected = counterpartKindOf(account);

    if (expected !== null && posting.counterpart.kind !== expected) {
      return "counterpart-mismatch";
    }
  }

  return null;
}

/** The kind of party a control account's role names: suppliers, or owners; null for any other control account. */
function counterpartKindOf(account: Account): "supplier" | "owner" | null {
  if (account.role === "suppliers") {
    return "supplier";
  }

  return account.role === "owners" ? "owner" : null;
}
