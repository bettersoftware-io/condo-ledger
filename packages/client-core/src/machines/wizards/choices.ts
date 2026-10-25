import {
  type Account,
  type AccountNode,
  type AccountRole,
  type EntryContext,
  NONE,
  PATH_SEPARATOR,
  type Posting,
  type PostingScope,
  pathOf,
  scopeOwns,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

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
  return offeredRows(books).map(choiceOf);
}

/** The key of the row `rowChoices` offers that owns the posting: where the generic wizard shows a line it did not write. Null when no row offered owns it. */
export function rowKeyOf(books: Books, posting: Posting): string | null {
  const row = offeredRows(books).find((candidate) => {
    return scopeOwns(candidate.scope, posting);
  });

  return row?.choice.key ?? null;
}

/** A posting as a preview shows it: the path of the row it lands on; for a supplier with no row yet, its account's path and its name. */
export function previewPath(books: Books, posting: Posting): string {
  const row = rowKeyOf(books, posting);

  if (row !== null) {
    return shortPath(books, row);
  }

  const supplier = must(
    books.parties.find((party) => {
      return party.id === posting.counterpart?.id;
    }),
    `the supplier of a posting on ${posting.accountId}`,
  );

  const account = must(
    keyOfAccount(books.tree, posting.accountId),
    `the node of ${posting.accountId}`,
  );

  return `${shortPath(books, account)}${PATH_SEPARATOR}${supplier.name}`;
}

/**
 * The movable liquidity accounts a payment may come from: the regular
 * `assets` leaves under the group that holds the cash-role account, or the
 * bank-role account when the period has no cash role. None with neither.
 */
export function liquidityChoices(books: Books): WizardChoice[] {
  const holder = roleAccount(books, "cash") ?? roleAccount(books, "bank");
  const group = holder?.parentId ?? null;

  if (group === null) {
    return [];
  }

  const parents = new Map(
    books.accounts.map((account) => {
      return [account.id, account.parentId];
    }),
  );

  return leafChoices(books, (account) => {
    return account.nature === "assets" && isUnder(parents, account.id, group);
  });
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
    installments: books.installments,
    installmentItems: books.installmentItems,
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

/** The rows a new posting may land on: not a grouping, and with its party. */
function offeredRows(books: Books): PostingRow[] {
  const groupings = new Set(
    books.accounts
      .filter((account) => {
        return account.type === "grouping";
      })
      .map((account) => {
        return account.id;
      }),
  );

  return postingRows(books).filter((row) => {
    return !groupings.has(row.scope.accountId) && namesItsParty(row.scope);
  });
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

/** The key of the first node of the account, in tree order: a control account's own node, on its first side. */
function keyOfAccount(node: AccountNode, accountId: string): string | null {
  if (node.accountId === accountId) {
    return node.key;
  }

  for (const child of node.children) {
    const key = keyOfAccount(child, accountId);

    if (key !== null) {
      return key;
    }
  }

  return null;
}

/** Whether the account lies below the group, at any depth. */
function isUnder(
  parents: Map<string, string | null>,
  accountId: string,
  group: string,
): boolean {
  let parent = parents.get(accountId) ?? null;

  while (parent !== null) {
    if (parent === group) {
      return true;
    }

    parent = parents.get(parent) ?? null;
  }

  return false;
}
