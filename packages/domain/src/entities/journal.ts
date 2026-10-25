import type { Cents } from "./cents.ts";
import type { InvoiceTerms } from "./invoice.ts";

export type Counterpart =
  | { kind: "supplier"; id: string }
  | { kind: "owner"; id: string };

/** One line of a journal entry: an amount on an account, with whom when the account is a control account. */
export interface Posting {
  accountId: string;
  debit: Cents;
  credit: Cents;
  counterpart: Counterpart | null;
  /** On a collection's owner credit line, the installment item it pays; absent on every other line. */
  installmentItemId?: string;
}

export type EntryKind =
  | "openingBalances"
  | "closingBalances"
  | "invoice"
  | "invoicePayment"
  | "collection"
  | "budgetAllocation"
  | "individualExpense"
  | "directPaymentCash"
  | "directPaymentBank"
  | "withholdingPayment"
  | "generic";

export interface JournalEntry {
  id: string;
  periodId: string;
  number: number;
  at: string;
  /** The legacy transaction type, in domain words; an untyped legacy entry is generic. */
  kind: EntryKind;
  description: string;
  postings: Posting[];
  /** The invoice a registration created or a payment pays; null on every other kind. */
  invoiceId: string | null;
}

/** What a wizard hands the port: the port adds the id, the number and the stamp. */
export interface EntryDraft {
  kind: EntryKind;
  description: string;
  postings: Posting[];
  /** A registration's terms. */
  invoice?: InvoiceTerms;
  /** The invoice a payment pays. */
  invoiceId?: string;
}
