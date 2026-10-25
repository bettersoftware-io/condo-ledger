import { type Cents, cents, subtractCents } from "../entities/cents.ts";
import type { Installment, InstallmentItem } from "../entities/installment.ts";
import type { JournalEntry } from "../entities/journal.ts";
import type { OwnerParty, Party } from "../entities/party.ts";

/** One installment item with what the collections have paid on it and what it still owes. */
export interface ItemBalance {
  item: InstallmentItem;
  installment: Installment;
  paid: Cents;
  remaining: Cents;
}

/** Every item with its balance: paid is the sum of the credits of the collection entries' lines that name it. */
export function itemBalances(
  items: InstallmentItem[],
  installments: Installment[],
  entries: JournalEntry[],
): ItemBalance[] {
  const paidByItem = new Map<string, number>();

  for (const entry of entries) {
    if (entry.kind !== "collection") {
      continue;
    }

    for (const posting of entry.postings) {
      if (posting.installmentItemId === undefined) {
        continue;
      }

      const before = paidByItem.get(posting.installmentItemId) ?? 0;

      paidByItem.set(posting.installmentItemId, before + posting.credit);
    }
  }

  return items.flatMap((item) => {
    const installment = installments.find((candidate) => {
      return candidate.id === item.installmentId;
    });

    if (installment === undefined) {
      return [];
    }

    const paid = cents(paidByItem.get(item.id) ?? 0);

    return [
      { item, installment, paid, remaining: subtractCents(item.amount, paid) },
    ];
  });
}

/** The open items (remaining above zero) of every residency of the person, oldest first: due date, then installment number, then unit code. */
export function owedBy(
  personId: string,
  parties: Party[],
  balances: ItemBalance[],
): ItemBalance[] {
  const residencies = new Map<string, OwnerParty>();

  for (const party of parties) {
    if (party.kind === "owner" && party.personId === personId) {
      residencies.set(party.id, party);
    }
  }

  return balances
    .filter((balance) => {
      return balance.remaining > 0 && residencies.has(balance.item.residentId);
    })
    .sort((a, b) => {
      return (
        compareText(a.installment.dueDate, b.installment.dueDate) ||
        a.installment.number - b.installment.number ||
        compareText(unitOf(a, residencies), unitOf(b, residencies))
      );
    });
}

function unitOf(
  balance: ItemBalance,
  residencies: Map<string, OwnerParty>,
): string {
  return residencies.get(balance.item.residentId)?.unitCode ?? "";
}

function compareText(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  return a > b ? 1 : 0;
}
