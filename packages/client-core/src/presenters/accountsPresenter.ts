import { type DefaultedStateObservable, state } from "@rx-state/core";
import {
  combineLatest,
  distinctUntilChanged,
  map,
  type Observable,
  of,
  Subject,
  startWith,
  switchMap,
} from "rxjs";

import {
  type AccountNature,
  type AccountNode,
  type AccountsPort,
  buildAccountTree,
  type Cents,
  findNode,
  type JournalEntry,
  type JournalPort,
  type Ledger,
  ledgerOf,
  pathOf,
  type Result,
  ROOT_KEY,
} from "@cl/domain";

import type { PeriodSelection } from "./buildingsPresenter.ts";

export interface AccountDetails {
  path: string;
  typeLabel: string;
  natureLabel: string;
  isCost: boolean;
  debit: Cents;
  credit: Cents;
  balance: Cents;
  budget: Cents | null;
  systemId: string;
}

export interface AccountsPresenterPorts {
  accounts: AccountsPort;
  journal: JournalPort;
}

export interface AccountsPresenter {
  tree$: DefaultedStateObservable<AccountNode | null>;
  selectedKey$: DefaultedStateObservable<string>;
  selectedNode$: DefaultedStateObservable<AccountNode | null>;
  ledger$: DefaultedStateObservable<Ledger | null>;
  details$: DefaultedStateObservable<AccountDetails | null>;
  select: (key: string) => void;
  setBudget: (accountId: string, budget: Cents) => Promise<Result>;
}

const NATURE_LABELS: Record<AccountNature, string> = {
  assets: "Asset",
  liabilities: "Liability",
  assetsOrLiabilities: "Asset/Liability",
  expenses: "Cost",
  income: "Revenue",
};

const NO_VALUE = "—";

/** A period's raw books, read together so the tree is built from one consistent set. */
interface Books {
  tree: AccountNode;
  entries: JournalEntry[];
}

/** Everything the screen shows for one period and one selected key, worked out together. */
interface View {
  tree: AccountNode;
  key: string;
  node: AccountNode;
  ledger: Ledger;
  details: AccountDetails;
}

/** The Accounts screen: the tree of the selected period, the selected node, its ledger and its details. */
export function createAccountsPresenter(
  ports: AccountsPresenterPorts,
  selected$: Observable<PeriodSelection | null>,
): AccountsPresenter {
  const chosenKey$ = new Subject<string>();
  const periodId$ = selected$.pipe(
    map((selection) => {
      return selection?.periodId ?? null;
    }),
    distinctUntilChanged(),
  );

  // The books and the key switch together, so no reader ever sees a new
  // period's tree with the last period's key. Every period change starts the
  // selection again at Total.
  const view$ = state(
    periodId$.pipe(
      switchMap((periodId): Observable<View | null> => {
        if (periodId === null) {
          return of(null);
        }

        return combineLatest([
          booksOf(ports, periodId),
          chosenKey$.pipe(startWith(ROOT_KEY)),
        ]).pipe(
          map(([books, key]) => {
            return viewOf(books, key);
          }),
        );
      }),
    ),
    null,
  );

  return {
    tree$: state(
      view$.pipe(
        map((view) => {
          return view?.tree ?? null;
        }),
      ),
      null,
    ),
    selectedKey$: state(
      view$.pipe(
        map((view) => {
          return view?.key ?? ROOT_KEY;
        }),
      ),
      ROOT_KEY,
    ),
    selectedNode$: state(
      view$.pipe(
        map((view) => {
          return view?.node ?? null;
        }),
      ),
      null,
    ),
    ledger$: state(
      view$.pipe(
        map((view) => {
          return view?.ledger ?? null;
        }),
      ),
      null,
    ),
    details$: state(
      view$.pipe(
        map((view) => {
          return view?.details ?? null;
        }),
      ),
      null,
    ),
    select: (key: string): void => {
      chosenKey$.next(key);
    },
    setBudget: (accountId: string, budget: Cents): Promise<Result> => {
      return ports.accounts.setBudget(accountId, budget);
    },
  };
}

function booksOf(
  ports: AccountsPresenterPorts,
  periodId: string,
): Observable<Books> {
  return combineLatest([
    ports.accounts.accounts(periodId),
    ports.journal.entries(periodId),
    ports.accounts.parties(periodId),
  ]).pipe(
    map(([accounts, entries, parties]) => {
      return { tree: buildAccountTree(accounts, entries, parties), entries };
    }),
  );
}

/** Errors, naming the key, for a key the tree does not have: the key comes from a row of this tree. */
function viewOf(books: Books, key: string): View {
  const node = findNode(books.tree, key);

  if (node === undefined) {
    throw new Error(`missing: the node ${key}`);
  }

  return {
    tree: books.tree,
    key,
    node,
    ledger: ledgerOf(books.tree, key, books.entries),
    details: detailsOf(books.tree, node),
  };
}

function detailsOf(tree: AccountNode, node: AccountNode): AccountDetails {
  return {
    path: pathOf(tree, node.key),
    typeLabel: typeLabelOf(node),
    natureLabel: node.nature === null ? NO_VALUE : NATURE_LABELS[node.nature],
    isCost: node.nature === "expenses",
    debit: node.debit,
    credit: node.credit,
    balance: node.balance,
    budget: node.budget,
    systemId:
      node.accountId === null ? NO_VALUE : node.accountId.replace(/^la/, ""),
  };
}

function typeLabelOf(node: AccountNode): string {
  if (node.scope?.kind === "supplier") {
    return "Non-movable / subledger";
  }

  if (node.scope?.kind === "residency") {
    return "Non-movable / owner subledger";
  }

  return node.children.length > 0 || node.scope === null
    ? "Non-movable / grouping"
    : "Movable";
}
