import type { Account, AccountRole } from "../entities/account.ts";
import { type Cents, cents, ZERO_CENTS } from "../entities/cents.ts";
import type { EntryKind, JournalEntry, Posting } from "../entities/journal.ts";
import type { Party } from "../entities/party.ts";

/** What the period's budget allocation entry gives each resident, and what it posts to roundings. */
export interface BudgetShares {
  /** By resident: the owners-account lines, debit − credit. */
  shares: Map<string, Cents>;
  /** The roundings-account lines, debit − credit. */
  roundings: Cents;
  /** False when the period has no budget allocation entry. */
  found: boolean;
}

/** Each resident's share of the budget, read from the stored budget allocation entry. */
export function budgetSharesOf(
  entries: JournalEntry[],
  accounts: Account[],
): BudgetShares {
  const entry = entryOfKind(entries, "budgetAllocation");

  if (entry === undefined) {
    return { shares: new Map(), roundings: ZERO_CENTS, found: false };
  }

  const roundingsAccounts = accountsWithRole(accounts, "roundings");
  const roundings = entry.postings
    .filter((posting) => {
      return roundingsAccounts.has(posting.accountId);
    })
    .reduce((total, posting) => {
      return total + net(posting);
    }, 0);

  return {
    shares: ownerLines(entry, accounts, new Map()),
    roundings: cents(roundings),
    found: true,
  };
}

/** Each owner's balance at the start of the period: the opening entry's owners-account lines, else the party's starting balance. */
export function previousBalancesOf(
  entries: JournalEntry[],
  accounts: Account[],
  parties: Party[],
): Map<string, Cents> {
  const entry = entryOfKind(entries, "openingBalances");
  const balances = new Map<string, Cents>();

  for (const party of parties) {
    if (party.kind === "owner") {
      balances.set(
        party.id,
        entry === undefined ? party.startingBalance : ZERO_CENTS,
      );
    }
  }

  return entry === undefined ? balances : ownerLines(entry, accounts, balances);
}

function entryOfKind(
  entries: JournalEntry[],
  kind: EntryKind,
): JournalEntry | undefined {
  return entries.find((entry) => {
    return entry.kind === kind;
  });
}

/** Adds the entry's owners-account lines, debit − credit, to each resident's amount in `into`. */
function ownerLines(
  entry: JournalEntry,
  accounts: Account[],
  into: Map<string, Cents>,
): Map<string, Cents> {
  const ownersAccounts = accountsWithRole(accounts, "owners");

  for (const posting of entry.postings) {
    const counterpart = posting.counterpart;

    if (
      !ownersAccounts.has(posting.accountId) ||
      counterpart?.kind !== "owner"
    ) {
      continue;
    }

    const before = into.get(counterpart.id) ?? 0;

    into.set(counterpart.id, cents(before + net(posting)));
  }

  return into;
}

function accountsWithRole(accounts: Account[], role: AccountRole): Set<string> {
  return new Set(
    accounts
      .filter((account) => {
        return account.role === role;
      })
      .map((account) => {
        return account.id;
      }),
  );
}

function net(posting: Posting): number {
  return posting.debit - posting.credit;
}
