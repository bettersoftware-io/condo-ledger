import type { Account, AccountNature } from "../entities/account.ts";
import {
  addCents,
  type Cents,
  subtractCents,
  ZERO_CENTS,
} from "../entities/cents.ts";
import type { JournalEntry, Posting } from "../entities/journal.ts";
import type { OwnerParty, Party, SupplierParty } from "../entities/party.ts";
import { listFor, must } from "../support/must.ts";

export type NodeIcon =
  | "folder"
  | "document"
  | "cash"
  | "bank"
  | "suppliers"
  | "owners"
  | "roundings"
  | "tax";

export type PostingScope =
  | { kind: "account"; accountId: string }
  | { kind: "supplier"; accountId: string; supplierId: string }
  | { kind: "residency"; accountId: string; residentId: string };

/** One row of the Accounts screen's tree, with everything the screen shows already decided. */
export interface AccountNode {
  key: string;
  label: string;
  accountId: string | null;
  nature: AccountNature | null;
  icon: NodeIcon;
  debit: Cents;
  credit: Cents;
  balance: Cents;
  budget: Cents | null;
  scope: PostingScope | null;
  children: AccountNode[];
}

export const ROOT_KEY = "total";

const LEVEL_LABELS = {
  patrimonial: "Patrimonial",
  assets: "(Assets)",
  liabilities: "(Liabilities)",
  costs: "Costs",
  revenue: "Revenue",
} as const;

type Side = "assets" | "liabilities";

interface Sums {
  debit: Cents;
  credit: Cents;
}

/** Everything indexed once, so the walk below is plain lookups. */
interface Books {
  byId: Map<string, Account>;
  childrenOf: Map<string, Account[]>;
  postingsOf: Map<string, Posting[]>;
  suppliers: Map<string, SupplierParty>;
  owners: Map<string, OwnerParty>;
}

/**
 * The legacy report's chart of accounts for one period: Total over
 * Patrimonial (Assets, Liabilities), Costs and Revenue; every amount the gross
 * sum of the postings beneath; a control account split per supplier or per
 * person and residency, each on the side its balance has.
 */
export function buildAccountTree(
  accounts: Account[],
  entries: JournalEntry[],
  parties: Party[],
): AccountNode {
  const books = index(accounts, entries, parties);
  const roots = ordered(
    accounts.filter((account) => {
      return account.parentId === null;
    }),
  );

  const assets = level(
    "assets",
    LEVEL_LABELS.assets,
    "assets",
    sideNodes(books, roots, "assets"),
  );

  const liabilities = level(
    "liabilities",
    LEVEL_LABELS.liabilities,
    "liabilities",
    sideNodes(books, roots, "liabilities"),
  );

  const patrimonial = level("patrimonial", LEVEL_LABELS.patrimonial, null, [
    assets,
    liabilities,
  ]);

  const costs = level(
    "costs",
    LEVEL_LABELS.costs,
    "expenses",
    natureNodes(books, roots, "expenses"),
  );

  const revenue = level(
    "revenue",
    LEVEL_LABELS.revenue,
    "income",
    natureNodes(books, roots, "income"),
  );

  return level(ROOT_KEY, "Total", null, [patrimonial, costs, revenue]);
}

/** The node with this key, anywhere under `root`. */
export function findNode(
  root: AccountNode,
  key: string,
): AccountNode | undefined {
  if (root.key === key) {
    return root;
  }

  for (const child of root.children) {
    const found = findNode(child, key);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

function index(
  accounts: Account[],
  entries: JournalEntry[],
  parties: Party[],
): Books {
  const byId = new Map(
    accounts.map((account) => {
      return [account.id, account];
    }),
  );
  const childrenOf = new Map<string, Account[]>();
  const postingsOf = new Map<string, Posting[]>();
  const suppliers = new Map<string, SupplierParty>();
  const owners = new Map<string, OwnerParty>();

  for (const account of accounts) {
    if (account.parentId !== null) {
      must(byId.get(account.parentId), `the account ${account.parentId}`);
      listFor(childrenOf, account.parentId).push(account);
    }
  }

  for (const entry of entries) {
    for (const posting of entry.postings) {
      must(byId.get(posting.accountId), `the account ${posting.accountId}`);
      listFor(postingsOf, posting.accountId).push(posting);
    }
  }

  for (const party of parties) {
    if (party.kind === "supplier") {
      suppliers.set(party.id, party);
    } else {
      owners.set(party.id, party);
    }
  }

  return { byId, childrenOf, postingsOf, suppliers, owners };
}

/** Pure-nature accounts of this side first, then the control accounts, each in legacy order. */
function sideNodes(books: Books, roots: Account[], side: Side): AccountNode[] {
  const pure = roots
    .filter((account) => {
      return account.nature === side;
    })
    .map((account) => {
      return fixedNatureNode(books, account);
    });

  const controls = roots
    .filter((account) => {
      return account.nature === "assetsOrLiabilities";
    })
    .map((account) => {
      return controlNode(books, account, side);
    })
    .filter((node) => {
      return node !== undefined;
    });

  return [...pure, ...controls];
}

/** Costs or revenue: pure accounts first, then the per-person control accounts, in legacy order. */
function natureNodes(
  books: Books,
  roots: Account[],
  nature: "expenses" | "income",
): AccountNode[] {
  const ofNature = roots.filter((account) => {
    return account.nature === nature;
  });

  const pure = ofNature
    .filter((account) => {
      return account.type === "regular" || account.type === "grouping";
    })
    .map((account) => {
      return accountNode(books, account);
    });

  const controls = ofNature.filter(isControl).map((account) => {
    return must(
      controlNode(books, account, null),
      `the control account ${account.id}`,
    );
  });

  return [...pure, ...controls];
}

/** A plain account: its own postings plus its children's, in legacy order. A control account among the children splits per counterpart, with no side. */
function accountNode(books: Books, account: Account): AccountNode {
  const children = ordered(books.childrenOf.get(account.id) ?? []).map(
    (child) => {
      return fixedNatureNode(books, child);
    },
  );
  const own = sumOf(books.postingsOf.get(account.id) ?? []);
  const sums = children.reduce(addSums, own);

  return node({
    key: account.id,
    label: account.name,
    accountId: account.id,
    nature: account.nature,
    icon: iconOf(account, children.length > 0),
    sums,
    budget: children.length === 0 ? account.budget : rollUp(children),
    scope:
      children.length === 0 ? { kind: "account", accountId: account.id } : null,
    children,
  });
}

/** An account of a fixed nature: a plain account, or a control account split per counterpart with no side. */
function fixedNatureNode(books: Books, account: Account): AccountNode {
  return isControl(account)
    ? must(
        controlNode(books, account, null),
        `the control account ${account.id}`,
      )
    : accountNode(books, account);
}

/**
 * A control account splits per counterpart wherever it sits: one row per
 * supplier, or one per person holding one per residency. The side split
 * (`@assets`/`@liabilities`) applies only when its nature is
 * `assetsOrLiabilities`; a fixed-nature control account's rows carry no
 * side (side null). On a side, only the rows whose balance has that sign. The assets side is always
 * there, at zero with no rows when none has a debit or zero balance, as in
 * the legacy report; the liabilities side is undefined when it has no row.
 */
function controlNode(
  books: Books,
  account: Account,
  side: Side | null,
): AccountNode | undefined {
  if (books.childrenOf.has(account.id)) {
    throw new Error(`a control account has child accounts: ${account.id}`);
  }

  const key = side === null ? account.id : `${account.id}@${side}`;
  const rows =
    account.type === "control"
      ? supplierRows(books, account, key)
      : personRows(books, account, key);

  const onSide = rows.filter((row) => {
    return side === null || sideOf(row.balance) === side;
  });

  if (side === "liabilities" && onSide.length === 0) {
    return undefined;
  }

  return node({
    key,
    label: account.name,
    accountId: account.id,
    nature: account.nature,
    icon: iconOf(account, true),
    sums: onSide.reduce(addSums, zeroSums()),
    budget: account.budget,
    scope: null,
    children: onSide,
  });
}

function supplierRows(
  books: Books,
  account: Account,
  parentKey: string,
): AccountNode[] {
  const byCounterpart = new Map<string, Posting[]>();

  for (const posting of books.postingsOf.get(account.id) ?? []) {
    listFor(byCounterpart, counterpartId(posting)).push(posting);
  }

  return [...byCounterpart.entries()]
    .map(([supplierId, postings]) => {
      const label =
        supplierId === NONE
          ? NO_COUNTERPART
          : must(books.suppliers.get(supplierId), `the supplier ${supplierId}`)
              .name;

      return node({
        key: `${parentKey}/${supplierId}`,
        label,
        accountId: account.id,
        nature: account.nature,
        icon: "document",
        sums: sumOf(postings),
        budget: null,
        scope: { kind: "supplier", accountId: account.id, supplierId },
        children: [],
      });
    })
    .sort(byLabel);
}

function personRows(
  books: Books,
  account: Account,
  parentKey: string,
): AccountNode[] {
  const byResidency = new Map<string, Posting[]>();

  for (const posting of books.postingsOf.get(account.id) ?? []) {
    listFor(byResidency, counterpartId(posting)).push(posting);
  }

  const byPerson = new Map<string, AccountNode[]>();
  const personNames = new Map<string, string>();

  for (const [residentId, postings] of byResidency) {
    const owner =
      residentId === NONE
        ? undefined
        : must(books.owners.get(residentId), `the owner ${residentId}`);
    const personId = owner?.personId ?? NONE;
    personNames.set(personId, owner?.name ?? NO_COUNTERPART);
    listFor(byPerson, personId).push(
      node({
        key: `${parentKey}/${personId}/${residentId}`,
        label: owner?.unitCode ?? NO_COUNTERPART,
        accountId: account.id,
        nature: account.nature,
        icon: "document",
        sums: sumOf(postings),
        budget: null,
        scope: { kind: "residency", accountId: account.id, residentId },
        children: [],
      }),
    );
  }

  return [...byPerson.entries()]
    .map(([personId, residencies]) => {
      const children = residencies.slice().sort(byLabel);

      return node({
        key: `${parentKey}/${personId}`,
        label: must(personNames.get(personId), `the person ${personId}`),
        accountId: account.id,
        nature: account.nature,
        icon: "folder",
        sums: children.reduce(addSums, zeroSums()),
        budget: null,
        scope: null,
        children,
      });
    })
    .sort(byLabel);
}

function level(
  key: string,
  label: string,
  nature: AccountNature | null,
  children: AccountNode[],
): AccountNode {
  return node({
    key,
    label,
    accountId: null,
    nature,
    icon: "folder",
    sums: children.reduce(addSums, zeroSums()),
    budget: rollUp(children),
    scope: null,
    children,
  });
}

interface NodeParts {
  key: string;
  label: string;
  accountId: string | null;
  nature: AccountNature | null;
  icon: NodeIcon;
  sums: Sums;
  budget: Cents | null;
  scope: PostingScope | null;
  children: AccountNode[];
}

function node(parts: NodeParts): AccountNode {
  const { sums, ...rest } = parts;

  return {
    ...rest,
    debit: sums.debit,
    credit: sums.credit,
    balance: subtractCents(sums.debit, sums.credit),
  };
}

const NONE = "none";
const NO_COUNTERPART = "(no counterpart)";

function counterpartId(posting: Posting): string {
  return posting.counterpart?.id ?? NONE;
}

function isControl(account: Account): boolean {
  return account.type === "control" || account.type === "controlUnitResident";
}

function iconOf(account: Account, hasChildren: boolean): NodeIcon {
  if (account.role !== null) {
    return account.role;
  }

  return hasChildren ? "folder" : "document";
}

function sideOf(balance: Cents): Side {
  return balance < 0 ? "liabilities" : "assets";
}

function rollUp(children: AccountNode[]): Cents | null {
  const budgets = children
    .map((child) => {
      return child.budget;
    })
    .filter((budget) => {
      return budget !== null;
    });

  return budgets.length === 0 ? null : budgets.reduce(addCents, ZERO_CENTS);
}

function ordered(accounts: Account[]): Account[] {
  return accounts.slice().sort((a, b) => {
    return a.order - b.order;
  });
}

function byLabel(a: AccountNode, b: AccountNode): number {
  return a.label.localeCompare(b.label, "it");
}

function zeroSums(): Sums {
  return { debit: ZERO_CENTS, credit: ZERO_CENTS };
}

function addSums(total: Sums, child: Sums): Sums {
  return {
    debit: addCents(total.debit, child.debit),
    credit: addCents(total.credit, child.credit),
  };
}

function sumOf(postings: Posting[]): Sums {
  return postings.reduce(addSums, zeroSums());
}
