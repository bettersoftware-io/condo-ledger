import { type Account, buildAccountTree } from "@cl/domain";
import { createSmallBooks } from "@cl/domain/testing/createSmallBooks.ts";

import type { Books } from "../presenters/booksPresenter.ts";

/** The small books of p1 as the books presenter hands them out, over these accounts: the small books' own unless a test brings others. 2013 is the period; it has no invoices and no withholding catalogue. */
export function createBooks(
  accounts: Account[] = createSmallBooks().accounts,
): Books {
  const small = createSmallBooks();

  return {
    periodId: small.periodId,
    period: { start: "2013-01-01", end: "2013-12-31" },
    tree: buildAccountTree(accounts, small.entries, small.parties),
    accounts,
    parties: small.parties,
    entries: small.entries,
    invoices: [],
    withholdingTaxes: [],
    installments: [],
    installmentItems: [],
  };
}

/** The small books' accounts and a tax grouping, Erario (la24), holding two withholding leaves: la25 and la26. */
export function createAccountsWithTax(): Account[] {
  return [
    ...createSmallBooks().accounts,
    createTaxAccount("la24", null, "Erario", "grouping"),
    createTaxAccount("la25", "la24", "Ritenute 1040", "regular"),
    createTaxAccount("la26", "la24", "Ritenute 1019", "regular"),
  ];
}

function createTaxAccount(
  id: string,
  parentId: string | null,
  name: string,
  type: "grouping" | "regular",
): Account {
  return {
    id,
    periodId: "p1",
    parentId,
    name,
    order: Number(id.slice(2)),
    nature: "liabilities",
    type,
    role: "tax",
    budget: null,
  };
}
