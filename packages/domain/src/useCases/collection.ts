import type { Account } from "../entities/account.ts";
import { type Cents, cents } from "../entities/cents.ts";
import type { InstallmentItem } from "../entities/installment.ts";
import type { Posting } from "../entities/journal.ts";
import { accepted, type ResultOf, rejected } from "../entities/result.ts";
import type { ItemBalance } from "./installments.ts";

/** What one collection pays on one item. */
export interface Settlement {
  item: InstallmentItem;
  amount: Cents;
}

/** Pays each open item its remaining, in the order given, until the amount is spent; the last may be partial. */
export function settleOldestFirst(
  amount: Cents,
  open: ItemBalance[],
): ResultOf<Settlement[]> {
  const settlements: Settlement[] = [];
  let left: number = amount;

  for (const balance of open) {
    if (left <= 0) {
      break;
    }

    const pays = Math.min(left, balance.remaining);

    settlements.push({ item: balance.item, amount: cents(pays) });
    left -= pays;
  }

  if (left > 0) {
    return rejected("over-owed");
  }

  return accepted(settlements);
}

/** The lines of a collection: the account debited with the total, then one owner credit per settlement on the owners account of the account's period. */
export function collectionPostings(
  accountId: string,
  settlements: Settlement[],
  accounts: Account[],
): ResultOf<Posting[]> {
  const periodId = accounts.find((account) => {
    return account.id === accountId;
  })?.periodId;

  const owners = accounts.find((account) => {
    return account.role === "owners" && account.periodId === periodId;
  });

  if (periodId === undefined || owners === undefined) {
    return rejected("no-owners-account");
  }

  let total = 0;

  for (const settlement of settlements) {
    total += settlement.amount;
  }

  const debit: Posting = {
    accountId,
    debit: cents(total),
    credit: cents(0),
    counterpart: null,
  };

  const credits = settlements.map((settlement): Posting => {
    return {
      accountId: owners.id,
      debit: cents(0),
      credit: settlement.amount,
      counterpart: { kind: "owner", id: settlement.item.residentId },
      installmentItemId: settlement.item.id,
    };
  });

  return accepted([debit, ...credits]);
}
