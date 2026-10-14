import type { Cents } from "./cents.ts";

export type Counterpart =
  | { kind: "supplier"; id: string }
  | { kind: "owner"; id: string };

/** One line of a journal entry: an amount on an account, with whom when the account is a control account. */
export interface Posting {
  accountId: string;
  debit: Cents;
  credit: Cents;
  counterpart: Counterpart | null;
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
}

/** What a wizard hands the port: the port adds the id, the number and the stamp. */
export interface EntryDraft {
  kind: EntryKind;
  description: string;
  postings: Posting[];
}
