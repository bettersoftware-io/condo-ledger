import { type DefaultedStateObservable, state } from "@rx-state/core";
import {
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  type Observable,
  of,
  Subject,
  startWith,
  switchMap,
} from "rxjs";

import {
  type Account,
  type AccountNature,
  type AccountNode,
  type AccountsPort,
  appliedLinksOf,
  type Cents,
  findNode,
  type Ledger,
  ledgerOf,
  pathOf,
  type Result,
  ROOT_KEY,
  type RoleShares,
  type TableLink,
  type ThousandthTable,
} from "@cl/domain";

import type { Books } from "./booksPresenter.ts";

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
  /** The thousandth tables that allocate the account; none for a node of no account. */
  allocationTables: AllocationTables;
}

/** The thousandth tables that allocate an account, as Account Details lists them. */
interface AllocationTables {
  rows: AllocationTableRow[];
  /** The rows are the nearest ancestor's: the account has no link of its own. */
  inherited: boolean;
  /** Some link serves only the budget or only the final balance. */
  separate: boolean;
}

/** One link of an account's allocation tables. */
export interface AllocationTableRow {
  /** The link's id. */
  id: string;
  /** The table's share of the account, in hundredths of a percent; null when empty. */
  percentage: number | null;
  /** The table's name; blank while the period's tables do not hold it. */
  table: string;
  /** Each role priority's percentage, in hundredths of a percent; null when blank or without a row. */
  roles: RoleShares;
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

/** Everything the screen shows for one period and one selected key, worked out together. */
interface View {
  tree: AccountNode;
  key: string;
  node: AccountNode;
  ledger: Ledger;
  /** The period's accounts: their links decide the allocation tables. */
  accounts: Account[];
}

/**
 * The Accounts screen: the tree of the selected period, the selected node,
 * its ledger and its details. The details name each allocation table by its
 * name in `tables$`, the selected period's tables.
 */
export function createAccountsPresenter(
  books$: Observable<Books | null>,
  accounts: AccountsPort,
  tables$: Observable<ThousandthTable[]>,
): AccountsPresenter {
  const chosenKey$ = new Subject<string>();
  const periodId$ = books$.pipe(
    map((books) => {
      return books?.periodId ?? null;
    }),
    distinctUntilChanged(),
  );

  // The key restarts at Total on every period change; the books of that
  // period and the key are then combined, so no reader sees a new period's
  // tree with the last period's key.
  const view$ = state(
    periodId$.pipe(
      switchMap((periodId): Observable<View | null> => {
        if (periodId === null) {
          return of(null);
        }

        return combineLatest([
          books$.pipe(
            filter((books): books is Books => {
              return books !== null && books.periodId === periodId;
            }),
          ),
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
        distinctUntilChanged(),
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
      combineLatest([view$, tables$]).pipe(
        map(([view, tables]) => {
          return view === null ? null : detailsOf(view, tables);
        }),
      ),
      null,
    ),
    select: (key: string): void => {
      chosenKey$.next(key);
    },
    setBudget: (accountId: string, budget: Cents): Promise<Result> => {
      return accounts.setBudget(accountId, budget);
    },
  };
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
    accounts: books.accounts,
  };
}

function detailsOf(view: View, tables: ThousandthTable[]): AccountDetails {
  const { tree, node } = view;

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
    allocationTables: allocationTablesOf(view.accounts, node, tables),
  };
}

/** The links that apply to the node's account, each with its table's name. */
function allocationTablesOf(
  accounts: Account[],
  node: AccountNode,
  tables: ThousandthTable[],
): AllocationTables {
  const { links, inherited } =
    node.accountId === null
      ? { links: [], inherited: false }
      : appliedLinksOf(accounts, node.accountId);

  return {
    rows: links.map((link) => {
      return {
        id: link.id,
        percentage: link.percentage,
        table:
          tables.find((table) => {
            return table.id === link.tableId;
          })?.name ?? "",
        roles: rolesOf(link),
      };
    }),
    inherited,
    separate: links.some((link) => {
      return link.use !== "both";
    }),
  };
}

/** A role's percentage where the link has a row for it; null elsewhere. */
function rolesOf(link: TableLink): RoleShares {
  return {
    1: link.present[1] ? link.roles[1] : null,
    2: link.present[2] ? link.roles[2] : null,
    3: link.present[3] ? link.roles[3] : null,
    4: link.present[4] ? link.roles[4] : null,
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
