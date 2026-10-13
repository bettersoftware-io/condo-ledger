import type { Account } from "#/entities/account.ts";
import type { Building } from "#/entities/building.ts";
import { cents } from "#/entities/cents.ts";
import type { Counterpart, JournalEntry } from "#/entities/journal.ts";
import type { Party } from "#/entities/party.ts";

/** What the four M1 simulators answer from: the legacy periods that have books, pseudonymised, as the generator emits them. */
export interface LegacySeed {
  buildings: Building[];
  accounts: Account[];
  entries: JournalEntry[];
  parties: Party[];
}

/** The same, as plain numbers: the shape of the generated module. */
export interface AccountData extends Omit<Account, "budget"> {
  budget: number | null;
}

export interface PostingData {
  accountId: string;
  debit: number;
  credit: number;
  counterpart: Counterpart | null;
}

export interface JournalEntryData extends Omit<JournalEntry, "postings"> {
  postings: PostingData[];
}

export interface LegacySeedData {
  buildings: Building[];
  accounts: AccountData[];
  entries: JournalEntryData[];
  parties: Party[];
}

/** Brands every amount. A fraction in the generated file fails here, once, instead of somewhere in a sum. */
export function loadLegacySeed(data: LegacySeedData): LegacySeed {
  return {
    buildings: data.buildings,
    accounts: data.accounts.map((account) => {
      return {
        ...account,
        budget: account.budget === null ? null : cents(account.budget),
      };
    }),
    entries: data.entries.map((entry) => {
      return {
        ...entry,
        postings: entry.postings.map((posting) => {
          return {
            ...posting,
            debit: cents(posting.debit),
            credit: cents(posting.credit),
          };
        }),
      };
    }),
    parties: data.parties,
  };
}
