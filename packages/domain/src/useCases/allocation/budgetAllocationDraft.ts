import type { Account, AccountRole } from "#/entities/account.ts";
import { type Cents, cents, ZERO_CENTS } from "#/entities/cents.ts";
import type {
  Counterpart,
  EntryDraft,
  JournalEntry,
  Posting,
} from "#/entities/journal.ts";
import { accepted, type ResultOf, rejected } from "#/entities/result.ts";

import type { Allocation, AllocationRow } from "./allocation.ts";

/**
 * The journal entry a budget allocation posts, from the period's budget-mode
 * allocation, its entries and its accounts: one line per resident on the
 * owners' account, in row order and 0.00 included; the allocation's
 * Roundings on the roundings account, charged to the first resident (left
 * out when 0); and the budget credited to the budget allocation revenue.
 *
 * It refuses, in this order: a period that already has one
 * (`allocation-exists`); a period without one of the three accounts
 * (`missing-account`, the role in the detail); a budget of 0 (`no-budget`);
 * an account whose budget nothing allocates (`unallocated-budget`, the first
 * such account in the detail).
 */
export function budgetAllocationDraftOf(
  allocation: Allocation,
  entries: JournalEntry[],
  accounts: Account[],
  description: string,
): ResultOf<EntryDraft> {
  const exists = entries.some((entry) => {
    return entry.kind === "budgetAllocation";
  });

  if (exists) {
    return rejected("allocation-exists");
  }

  const owners = accountOf(accounts, "owners");
  const roundings = accountOf(accounts, "roundings");
  const revenue = accountOf(accounts, "budgetAllocation");

  if (owners === undefined) {
    return rejected("missing-account", "owners");
  }

  if (roundings === undefined) {
    return rejected("missing-account", "roundings");
  }

  if (revenue === undefined) {
    return rejected("missing-account", "budgetAllocation");
  }

  const budget = allocation.root.total;

  if (budget === 0) {
    return rejected("no-budget");
  }

  const unallocated = allocation.unallocated[0];

  if (unallocated !== undefined) {
    return rejected("unallocated-budget", unallocated);
  }

  const residents = residentRowsOf(allocation.root);
  const roundingsTotal = allocation.root.children
    .filter((row) => {
      return row.kind === "roundings";
    })
    .reduce((sum, row) => {
      return cents(sum + row.total);
    }, ZERO_CENTS);
  const first = residents[0];

  return accepted({
    kind: "budgetAllocation",
    description,
    postings: [
      ...residents.map((row) => {
        return lineOf(owners.id, ownerOf(row), row.total);
      }),
      ...(roundingsTotal === 0 || first === undefined
        ? []
        : [lineOf(roundings.id, ownerOf(first), roundingsTotal)]),
      lineOf(revenue.id, null, cents(-budget)),
    ],
  });
}

/** The first account with the role, by the accounts' order. */
function accountOf(
  accounts: Account[],
  role: AccountRole,
): Account | undefined {
  return accounts.find((account) => {
    return account.role === role;
  });
}

/** The resident rows under the row, depth first: the allocation's row order. */
function residentRowsOf(row: AllocationRow): AllocationRow[] {
  if (row.kind === "resident") {
    return [row];
  }

  return row.children.flatMap(residentRowsOf);
}

function ownerOf(row: AllocationRow): Counterpart {
  return { kind: "owner", id: row.key.slice(RESIDENT_KEY.length) };
}

/** A line of the amount: a debit when it is positive, a credit when it is negative. */
function lineOf(
  accountId: string,
  counterpart: Counterpart | null,
  amount: Cents,
): Posting {
  return {
    accountId,
    debit: amount > 0 ? amount : ZERO_CENTS,
    credit: amount < 0 ? cents(-amount) : ZERO_CENTS,
    counterpart,
  };
}

/** A resident row's key is this and the resident's id. */
const RESIDENT_KEY = "resident:";
