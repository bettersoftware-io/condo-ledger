import {
  type Account,
  type AccountNode,
  type AccountRole,
  type EntryContext,
  NONE,
  PATH_SEPARATOR,
  type PostingScope,
  pathOf,
} from "@cl/domain";

import type { Books } from "#/presenters/booksPresenter.ts";

import type { WizardChoice } from "./wizard.ts";

/** A row of the tree that owns postings, as a choice, with what a posting on it is. */
interface PostingRow {
  choice: WizardChoice;
  scope: PostingScope;
}

/** The period's regular accounts `keep` accepts, in tree order: keyed by account id, labelled by path, grouped under their top-level account. */
export function leafChoices(
  books: Books,
  keep: (account: Account) => boolean,
): WizardChoice[] {
  const kept = new Set(
    books.accounts
      .filter((account) => {
        return account.type === "regular" && keep(account);
      })
      .map((account) => {
        return account.id;
      }),
  );

  return postingRows(books)
    .filter((row) => {
      return row.scope.kind === "account" && kept.has(row.scope.accountId);
    })
    .map(choiceOf);
}

/**
 * Every row of the tree a posting can land on, in tree order: keyed by node,
 * so a control account's row names its party. A grouping with nothing under
 * it is a row of the tree, and no leaf; a control account's row of postings
 * that name no party is one no new posting may join (it needs a party).
 */
export function rowChoices(books: Books): WizardChoice[] {
  const groupings = new Set(
    books.accounts
      .filter((account) => {
        return account.type === "grouping";
      })
      .map((account) => {
        return account.id;
      }),
  );

  return postingRows(books)
    .filter((row) => {
      return !groupings.has(row.scope.accountId) && namesItsParty(row.scope);
    })
    .map(choiceOf);
}

/** What the domain judges a wizard's draft against: the books as they stand, and the entry an edit rewrites. */
export function contextOf(
  books: Books,
  replacing: string | null,
): EntryContext {
  return {
    accounts: books.accounts,
    parties: books.parties,
    withholdingTaxes: books.withholdingTaxes,
    invoices: books.invoices,
    entries: books.entries,
    replacing,
  };
}

/** What a payment wizard works on: the books, and the account paid from. */
export interface Paying {
  books: Books;
  paidFrom: Account;
}

/** The books and their regular account with the role, or null when there are no books or the period has no such account. */
export function payingOf(
  books: Books | null,
  role: AccountRole,
): Paying | null {
  const paidFrom = books === null ? null : roleAccount(books, role);

  return books === null || paidFrom === null ? null : { books, paidFrom };
}

/** The regular account with the role, or null. */
export function roleAccount(books: Books, role: AccountRole): Account | null {
  return (
    books.accounts.find((account) => {
      return account.type === "regular" && account.role === role;
    }) ?? null
  );
}

/** A cost account: what a purchase debits. */
export function isExpenseLeaf(account: Account): boolean {
  return account.nature === "expenses";
}

/** The node's path without Total, as the pickers and the preview show it. */
export function shortPath(books: Books, key: string): string {
  return pathOf(books.tree, key).slice(
    books.tree.label.length + PATH_SEPARATOR.length,
  );
}

function postingRows(books: Books): PostingRow[] {
  const rows: PostingRow[] = [];

  function underLevel(node: AccountNode, above: string[]): void {
    for (const child of node.children) {
      if (child.accountId === null) {
        underLevel(child, [...above, child.label]);
      } else {
        underAccount(child, above, child.label);
      }
    }
  }

  function underAccount(
    node: AccountNode,
    above: string[],
    group: string,
  ): void {
    const labels = [...above, node.label];

    if (node.scope !== null) {
      rows.push({
        choice: { key: node.key, label: labels.join(PATH_SEPARATOR), group },
        scope: node.scope,
      });
    }

    for (const child of node.children) {
      underAccount(child, labels, group);
    }
  }

  underLevel(books.tree, []);

  return rows;
}

/** Whether a posting on this row has its party: always on a plain account's, never on a control account's row of postings without one. */
function namesItsParty(scope: PostingScope): boolean {
  switch (scope.kind) {
    case "account":
      return true;
    case "supplier":
      return scope.supplierId !== NONE;
    case "residency":
      return scope.residentId !== NONE;
  }
}

function choiceOf(row: PostingRow): WizardChoice {
  return row.choice;
}
