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

export interface JournalEntry {
  id: string;
  periodId: string;
  number: number;
  at: string;
  description: string;
  postings: Posting[];
}
